/**
 * Telegram Webhook API Route
 * Обработка входящих обновлений от Telegram
 */

import { NextRequest, NextResponse } from 'next/server';
import { createBot, getBot } from '@/bot';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/telegram/webhook
 * Обработка входящих обновлений от Telegram
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Получаем bot_id из query параметров или заголовка
    const botId = request.nextUrl.searchParams.get('bot_id') || 
                  request.headers.get('x-telegram-bot-id');
    
    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }
    
    // Получаем бота из хранилища или создаем новый экземпляр
    let bot = getBot(botId);
    
    if (!bot) {
      // Получаем токен бота из базы данных
      const botData = await prisma.bot.findUnique({
        where: { id: botId }
      });
      
      if (!botData) {
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
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telegram/webhook
 * Регистрация webhook для бота
 */
export async function GET(request: NextRequest) {
  try {
    const botId = request.nextUrl.searchParams.get('bot_id');
    
    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }
    
    // Получаем данные бота
    const botData = await prisma.bot.findUnique({
      where: { id: botId }
    });
    
    if (!botData) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }
    
    // Формируем URL для webhook
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook?bot_id=${botId}`;
    
    // Создаем временный экземпляр бота для регистрации webhook
    const bot = createBot(botData.token, botId);
    
    // Регистрируем webhook
    await bot.telegram.setWebhook(webhookUrl);
    
    // Получаем информацию о webhook
    const webhookInfo = await bot.telegram.getWebhookInfo();
    
    return NextResponse.json({
      ok: true,
      webhookUrl,
      webhookInfo
    });
    
  } catch (error) {
    console.error('Webhook registration error:', error);
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
    const botData = await prisma.bot.findUnique({
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
    
    return NextResponse.json({
      ok: true,
      message: 'Webhook deleted successfully'
    });
    
  } catch (error) {
    console.error('Webhook deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}