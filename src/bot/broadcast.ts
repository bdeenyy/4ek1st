/**
 * Сервис рассылки заказов
 * Публикация заказов в Telegram каналы и чаты
 */

import { db } from '@/lib/db';
import { getBot, createBot } from './index';

/** Экранирует спецсимволы для Telegram MarkdownV2 */
const esc = (s: string | number | null | undefined): string =>
  String(s ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');



interface OrderData {
  id: string;
  title: string;
  description?: string | null;
  workDate: Date;
  workTime: string;
  workType: string;
  requiredPeople: number;
  pricePerPerson: number;
  district?: string | null;
  street: string;
  houseNumber: string;
  botId: string;
}

/**
 * Публикация заказа во все каналы бота
 */
export async function publishOrder(orderId: string): Promise<{
  success: boolean;
  sentCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sentCount = 0;

  try {
    // Получаем заказ с информацией о боте
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { bot: true }
    });

    if (!order) {
      return { success: false, sentCount: 0, errors: ['Order not found'] };
    }

    if (!order.bot) {
      return { success: false, sentCount: 0, errors: ['Bot not found for this order'] };
    }

    // Получаем или создаем экземпляр бота
    let bot = getBot(order.botId);
    if (!bot) {
      bot = createBot(order.bot.token, order.botId);
    }

    // Получаем все одобренные контакты для рассылки
    // Исключаем менеджера бота из рассылки — он получает только уведомления менеджера
    const contacts = await db.contact.findMany({
      where: {
        botId: order.botId,
        status: 'APPROVED',
        // Не отправляем менеджеру — у него другой канал уведомлений
        ...(order.bot.telegramManagerId
          ? { NOT: { telegramId: order.bot.telegramManagerId } }
          : {})
      }
    });

    console.log(`[Broadcast] Found ${contacts.length} approved contacts (excluding manager).`);

    if (contacts.length === 0) {
      // Обновляем статус даже если нет контактов
      await db.order.update({
        where: { id: orderId },
        data: { status: 'PUBLISHED' }
      });
      return { success: true, sentCount: 0, errors: ['No approved contacts to send to'] };
    }

    // Формируем сообщение
    const message = formatOrderMessage(order);
    const keyboard = createOrderKeyboard(order.id);

    // Отправляем сообщение каждому одобренному контакту и сохраняем messageId
    const broadcastRecords: { orderId: string; chatId: string; messageId: number }[] = [];

    for (const contact of contacts) {
      try {
        const sent = await bot.telegram.sendMessage(contact.telegramId, message, {
          parse_mode: 'MarkdownV2',
          ...keyboard
        });
        broadcastRecords.push({
          orderId: order.id,
          chatId: contact.telegramId,
          messageId: sent.message_id
        });
        sentCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to send to ${contact.telegramId}: ${errorMessage}`);

        // Если пользователь заблокировал бота, помечаем контакт
        if (errorMessage.includes('blocked') || errorMessage.includes('deactivated')) {
          await db.contact.update({
            where: { id: contact.id },
            data: { status: 'BANNED' }
          });
        }
      }
    }

    // Сохраняем все messageId в базу для последующего редактирования
    if (broadcastRecords.length > 0) {
      await db.broadcastMessage.createMany({ data: broadcastRecords });
    }

    // Обновляем статус заказа на PUBLISHED
    await db.order.update({
      where: { id: orderId },
      data: { status: 'PUBLISHED' }
    });

    return { success: true, sentCount, errors };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, sentCount, errors: [errorMessage] };
  }
}

/**
 * Закрытие рассылки заказа — убираем кнопки и показываем статус.
 * Вызывается когда заказ отменён, удалён, или все места заняты.
 */
export async function closeOrderBroadcast(
  orderId: string,
  reason: 'FILLED' | 'CANCELLED' | 'EXPIRED'
): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { bot: true, broadcastMessages: true }
    });

    if (!order || !order.bot || order.broadcastMessages.length === 0) return;

    let bot = getBot(order.botId);
    if (!bot) {
      bot = createBot(order.bot.token, order.botId);
    }

    const statusLine = {
      FILLED:    '\n──────────────\n🔒 *Набор завершён* — все места заняты',
      CANCELLED: '\n──────────────\n❌ *Заказ отменён* менеджером',
      EXPIRED:   '\n──────────────\n⏰ *Заказ устарел* — дата выполнения прошла',
    }[reason];

    const updatedText = formatOrderMessage(order) + statusLine;

    for (const bm of order.broadcastMessages) {
      try {
        await bot.telegram.editMessageText(
          bm.chatId,
          bm.messageId,
          undefined,
          updatedText,
          { parse_mode: 'MarkdownV2' }
        );
      } catch {
        // Сообщение могло быть удалено пользователем — игнорируем
      }
    }

    // Удаляем записи, они больше не нужны
    await db.broadcastMessage.deleteMany({ where: { orderId } });

  } catch (error) {
    console.error('[closeOrderBroadcast] Error:', error);
  }
}

/**
 * Публикация заказа в канал
 */
export async function publishOrderToChannel(
  orderId: string,
  channelId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { bot: true }
    });

    if (!order || !order.bot) {
      return { success: false, error: 'Order or bot not found' };
    }

    let bot = getBot(order.botId);
    if (!bot) {
      bot = createBot(order.bot.token, order.botId);
    }

    const message = formatOrderMessage(order);
    const keyboard = createOrderKeyboard(order.id);

    await bot.telegram.sendMessage(channelId, message, {
      parse_mode: 'MarkdownV2',
      ...keyboard
    });

    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Отложенная публикация заказа
 */
export async function scheduleOrderPublication(
  orderId: string,
  publishAt: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    // Обновляем заказ с отложенной публикацией
    await db.order.update({
      where: { id: orderId },
      data: {
        publishType: 'SCHEDULED',
        publishAt
      }
    });

    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Обработка отложенных публикаций (вызывается по cron)
 */
export async function processScheduledPublications(): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;

  try {
    // Находим заказы, которые нужно опубликовать
    const orders = await db.order.findMany({
      where: {
        publishType: 'SCHEDULED',
        publishAt: { lte: new Date() },
        status: 'DRAFT'
      }
    });

    for (const order of orders) {
      const result = await publishOrder(order.id);
      if (result.success) {
        processed++;
      } else {
        errors.push(`Order ${order.id}: ${result.errors.join(', ')}`);
      }
    }

    return { processed, errors };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { processed, errors: [errorMessage] };
  }
}

/**
 * Отправка напоминания о смене
 */
export async function sendShiftReminder(
  orderId: string,
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { bot: true }
    });

    const employee = await db.employee.findUnique({
      where: { id: employeeId }
    });

    if (!order || !employee || !employee.telegramId) {
      return { success: false, error: 'Order, employee or telegram not found' };
    }

    let bot = getBot(order.botId);
    if (!bot && order.bot) {
      bot = createBot(order.bot.token, order.botId);
    }

    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });

    const message = `
⏰ *Напоминание о смене\\!*

📍 *${esc(order.title)}*

📅 *Дата:* ${esc(dateStr)}
⏰ *Время:* ${esc(order.workTime)}
📍 *Адрес:* ул\\. ${esc(order.street)}, д\\. ${esc(order.houseNumber)}

До начала смены остался 1 час\\!
Пожалуйста, не забудьте нажать кнопку ниже, когда прибудете на место\\.
    `;

    const { Markup } = require('telegraf');
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📍 Я на месте (Чек-ин)', `checkin_${order.id}`)]
    ]);

    await bot.telegram.sendMessage(employee.telegramId, message, {
      parse_mode: 'MarkdownV2',
      ...keyboard
    });

    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Форматирование сообщения заказа
 */
function formatOrderMessage(order: OrderData): string {
  const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `
📢 *Новый заказ\\!*

📍 *${esc(order.title)}*
${order.description ? `\n📝 ${esc(order.description)}` : ''}

📅 *Дата:* ${esc(dateStr)}
⏰ *Время:* ${esc(order.workTime)}
🔧 *Тип работ:* ${esc(order.workType)}
👥 *Требуется:* ${esc(order.requiredPeople)} чел\\.
💰 *Оплата:* ${esc(order.pricePerPerson)} ₽/чел\\.

📍 *Адрес:*
${order.district ? `Район: ${esc(order.district)}\n` : ''}ул\\. ${esc(order.street)}, д\\. ${esc(order.houseNumber)}
  `;
}

/**
 * Создание клавиатуры для заказа
 */
function createOrderKeyboard(orderId: string) {
  const { Markup } = require('telegraf');

  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Откликнуться', `respond_${orderId}`),
      Markup.button.callback('❌ Отказаться', `decline_${orderId}`)
    ]
  ]);
}

export default {
  publishOrder,
  publishOrderToChannel,
  scheduleOrderPublication,
  processScheduledPublications,
  sendShiftReminder,
  closeOrderBroadcast
};
