/**
 * Сервис рассылки заказов
 * Публикация заказов в Telegram каналы и чаты
 */

import { PrismaClient } from '@prisma/client';
import { getBot, createBot } from './index';

const prisma = new PrismaClient();

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
    const order = await prisma.order.findUnique({
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
    const contacts = await prisma.contact.findMany({
      where: {
        botId: order.botId,
        status: 'APPROVED'
      }
    });
    
    if (contacts.length === 0) {
      return { success: true, sentCount: 0, errors: ['No approved contacts to send to'] };
    }
    
    // Формируем сообщение
    const message = formatOrderMessage(order);
    const keyboard = createOrderKeyboard(order.id);
    
    // Отправляем сообщение каждому контакту
    for (const contact of contacts) {
      try {
        await bot.telegram.sendMessage(contact.telegramId, message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
        sentCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to send to ${contact.telegramId}: ${errorMessage}`);
        
        // Если пользователь заблокировал бота, помечаем контакт
        if (errorMessage.includes('blocked') || errorMessage.includes('deactivated')) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { status: 'BANNED' }
          });
        }
      }
    }
    
    // Обновляем статус заказа на PUBLISHED
    await prisma.order.update({
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
 * Публикация заказа в канал
 */
export async function publishOrderToChannel(
  orderId: string,
  channelId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await prisma.order.findUnique({
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
      parse_mode: 'Markdown',
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
    await prisma.order.update({
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
    const orders = await prisma.order.findMany({
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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bot: true }
    });
    
    const employee = await prisma.employee.findUnique({
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
⏰ *Напоминание о смене!*

📍 *${order.title}*

📅 *Дата:* ${dateStr}
⏰ *Время:* ${order.workTime}
📍 *Адрес:* ул. ${order.street}, д. ${order.houseNumber}

До начала смены остался 1 час! 
Пожалуйста, не забудьте нажать кнопку ниже, когда прибудете на место.
    `;
    
    const { Markup } = require('telegraf');
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📍 Я на месте (Чек-ин)', `checkin_${order.id}`)]
    ]);
    
    await bot.telegram.sendMessage(employee.telegramId, message, {
      parse_mode: 'Markdown',
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
📢 *Новый заказ!*

📍 *${order.title}*
${order.description ? `\n📝 ${order.description}` : ''}

📅 *Дата:* ${dateStr}
⏰ *Время:* ${order.workTime}
🔧 *Тип работ:* ${order.workType}
👥 *Требуется:* ${order.requiredPeople} чел.
💰 *Оплата:* ${order.pricePerPerson} ₽/чел.

📍 *Адрес:*
${order.district ? `Район: ${order.district}\n` : ''}ул. ${order.street}, д. ${order.houseNumber}
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
  sendShiftReminder
};