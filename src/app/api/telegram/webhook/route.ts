/**
 * Telegram Webhook API Route
 * Обработка входящих обновлений от Telegram
 */

import { NextRequest, NextResponse } from 'next/server';
import { createBot, getBot } from '@/bot';
import { db } from '@/lib/db';
import crypto from 'crypto';

/**
 * Генерация секретного токена для webhook
 * Используем хэш от bot_id + NEXTAUTH_SECRET для уникальности
 */
function generateSecretToken(botId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'default-secret';
  return crypto.createHash('sha256').update(`${botId}:${secret}`).digest('hex').substring(0, 32);
}

/**
 * POST /api/telegram/webhook
 * Обработка входящих обновлений от Telegram
 */
export async function POST(request: NextRequest) {
  try {
    // Получаем bot_id из query параметров
    const botId = request.nextUrl.searchParams.get('bot_id');
    
    if (!botId) {
      console.warn('[Webhook] Request without bot_id');
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }
    
    // Проверяем secret_token для защиты от подделки запросов
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
    const expectedToken = generateSecretToken(botId);
    
    if (secretToken !== expectedToken) {
      console.warn(`[Webhook] Invalid secret token for bot ${botId}`);
      return NextResponse.json(
        { error: 'Invalid secret token' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // Получаем бота из хранилища или создаем новый экземпляр
    let bot = getBot(botId);
    
    if (!bot) {
      // Получаем токен бота из базы данных
      const botData = await db.bot.findUnique({
        where: { id: botId }
      });
      
      if (!botData) {
        console.warn(`[Webhook] Bot not found: ${botId}`);
        return NextResponse.json(
          { error: 'Bot not found' },
          { status: 404 }
        );
      }
      
      bot = createBot(botData.token, botId);
    }
    
    // Обрабатываем обновление
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telegram/webhook
 * Регистрация webhook для бота или получение информации
 */
export async function GET(request: NextRequest) {
  try {
    const botId = request.nextUrl.searchParams.get('bot_id');
    const action = request.nextUrl.searchParams.get('action'); // 'info' для получения информации
    
    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }
    
    // Получаем данные бота
    const botData = await db.bot.findUnique({
      where: { id: botId }
    });
    
    if (!botData) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }
    
    // Создаем экземпляр бота
    const bot = getBot(botId) || createBot(botData.token, botId);
    
    // Если action=info - только получаем информацию без обновления webhook
    if (action === 'info') {
      try {
        const [botInfo, webhookInfo] = await Promise.all([
          bot.telegram.getMe(),
          bot.telegram.getWebhookInfo()
        ]);
        
        return NextResponse.json({
          ok: true,
          bot: {
            id: botInfo.id,
            username: botInfo.username,
            firstName: botInfo.first_name,
            canJoinGroups: botInfo.can_join_groups,
            canReadAllGroupMessages: botInfo.can_read_all_group_messages,
            supportsInlineQueries: botInfo.supports_inline_queries,
          },
          webhook: {
            url: webhookInfo.url,
            hasCustomCertificate: webhookInfo.has_custom_certificate,
            pendingUpdateCount: webhookInfo.pending_update_count,
            lastErrorDate: webhookInfo.last_error_date,
            lastErrorMessage: webhookInfo.last_error_message,
            maxConnections: webhookInfo.max_connections,
            ipAddress: webhookInfo.ip_address,
          }
        });
      } catch (error: any) {
        return NextResponse.json({
          ok: false,
          error: 'Не удалось получить информацию о боте. Проверьте токен.',
          details: error.message
        }, { status: 400 });
      }
    }
    
    // Формируем URL для webhook
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook?bot_id=${botId}`;
    
    // Генерируем secret_token для этого бота
    const secretToken = generateSecretToken(botId);
    
    try {
      // Получаем информацию о боте
      const botInfo = await bot.telegram.getMe();
      
      // Регистрируем webhook с secret_token
      await bot.telegram.setWebhook(webhookUrl, {
        secret_token: secretToken,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: false // Сохраняем ожидающие обновления
      });
      
      // Получаем информацию о webhook
      const webhookInfo = await bot.telegram.getWebhookInfo();
      
      console.log(`[Webhook] Registered for bot ${botId}: ${webhookUrl}`);
      
      return NextResponse.json({
        ok: true,
        webhookUrl,
        secretTokenConfigured: true,
        bot: {
          id: botInfo.id,
          username: botInfo.username,
          firstName: botInfo.first_name,
        },
        webhookInfo: {
          url: webhookInfo.url,
          pendingUpdateCount: webhookInfo.pending_update_count,
          lastErrorMessage: webhookInfo.last_error_message || null,
        }
      });
    } catch (error: any) {
      console.error('[Webhook] Registration error:', error);
      return NextResponse.json({
        ok: false,
        error: 'Не удалось зарегистрировать webhook',
        details: error.message
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Webhook] Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register webhook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/telegram/webhook
 * Удаление webhook для бота
 */
export async function DELETE(request: NextRequest) {
  try {
    const botId = request.nextUrl.searchParams.get('bot_id');
    
    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }
    
    // Получаем данные бота
    const botData = await db.bot.findUnique({
      where: { id: botId }
    });
    
    if (!botData) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }
    
    // Создаем экземпляр бота
    const bot = getBot(botId) || createBot(botData.token, botId);
    
    // Удаляем webhook
    await bot.telegram.deleteWebhook();
    
    console.log(`[Webhook] Deleted for bot ${botId}`);
    
    return NextResponse.json({
      ok: true,
      message: 'Webhook deleted successfully'
    });
    
  } catch (error) {
    console.error('[Webhook] Deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
