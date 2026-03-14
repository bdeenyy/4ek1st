/**
 * Сервис уведомлений
 * Обработка напоминаний и уведомлений для менеджеров и сотрудников
 */

import { PrismaClient } from '@prisma/client';
import { sendShiftReminder } from '@/bot/broadcast';
import { getBot, createBot } from '@/bot/index';
import { scheduleTask, QUEUES } from './queue';

const prisma = new PrismaClient();

// Интервал напоминания о смене (за сколько минут до начала)
const REMINDER_BEFORE_MINUTES = 60;

/**
 * Вспомогательная функция: отправка сообщения менеджеру через его бот.
 * Приоритет: bot.telegramManagerId (явно заданный) → первый контакт бота в БД
 */
async function sendMessageToManager(
  managerId: string,
  botToken: string,
  botId: string,
  message: string
): Promise<void> {
  // 1. Проверяем явно назначенный Telegram ID менеджера в настройках бота
  const botRecord = await prisma.bot.findUnique({ where: { id: botId } });
  const managerTelegramId = (botRecord as any)?.telegramManagerId;

  if (managerTelegramId) {
    const bot = getBot(botId) ?? createBot(botToken, botId);
    await bot.telegram.sendMessage(managerTelegramId, message, { parse_mode: 'Markdown' });
    return;
  }

  // 2. Fallback: ищем любой Contact в боте (старая логика)
  const managerContact = await prisma.contact.findFirst({ where: { botId } });

  if (!managerContact?.telegramId) {
    console.log('[Notification] No telegramManagerId in bot ' + botId + '. Set it in bot settings. Msg: ' + message);
    return;
  }

  const bot = getBot(botId) ?? createBot(botToken, botId);
  await bot.telegram.sendMessage(managerContact.telegramId, message, { parse_mode: 'Markdown' });
}

/**
 * Отправка уведомления менеджеру о новом отклике
 */
export async function notifyManagerAboutResponse(
  orderId: string,
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bot: true, creator: true }
    });
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });

    if (!order || !employee || !order.bot) {
      return { success: false, error: 'Order, employee or bot not found' };
    }

    const message = `
🔔 *Новый отклик на заказ!*

📋 *Заказ:* ${order.title}
👤 *Сотрудник:* ${employee.firstName} ${employee.lastName}
📞 *Телефон:* ${employee.phone}
${employee.rating > 0 ? `⭐ *Рейтинг:* ${employee.rating.toFixed(1)}` : ''}

Войдите в панель управления для назначения сотрудника.
    `.trim();

    await sendMessageToManager(order.creatorId, order.bot.token, order.botId, message);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Отправка уведомления менеджеру о чек-ине
 */
export async function notifyManagerCheckin(
  orderId: string,
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bot: true, creator: true }
    });
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });

    if (!order || !employee || !order.bot) {
      return { success: false, error: 'Not found' };
    }

    const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const message = `
✅ *Сотрудник прибыл на место!*

📋 *Заказ:* ${order.title}
👤 *Сотрудник:* ${employee.firstName} ${employee.lastName}
🕐 *Время чек-ина:* ${timeStr}
    `.trim();

    await sendMessageToManager(order.creatorId, order.bot.token, order.botId, message);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Отправка уведомления менеджеру о завершении работы
 */
export async function notifyManagerCompletion(
  orderId: string,
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bot: true, creator: true }
    });
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });

    if (!order || !employee || !order.bot) {
      return { success: false, error: 'Not found' };
    }

    const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const message = `
🏁 *Сотрудник завершил работу!*

📋 *Заказ:* ${order.title}
👤 *Сотрудник:* ${employee.firstName} ${employee.lastName}
🕐 *Время завершения:* ${timeStr}

Войдите в панель управления для оценки работы.
    `.trim();

    await sendMessageToManager(order.creatorId, order.bot.token, order.botId, message);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Отправка уведомления менеджеру об отказе после назначения
 */
export async function notifyManagerCancelledByEmployee(
  orderId: string,
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bot: true, creator: true }
    });
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });

    if (!order || !employee || !order.bot) {
      return { success: false, error: 'Not found' };
    }

    const message = `
⚠️ *Сотрудник отказался от смены!*

📋 *Заказ:* ${order.title}
👤 *Сотрудник:* ${employee.firstName} ${employee.lastName}
📞 *Телефон:* ${employee.phone}

Необходимо найти замену. Войдите в панель управления.
    `.trim();

    await sendMessageToManager(order.creatorId, order.bot.token, order.botId, message);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Отправка уведомления сотруднику о назначении на заказ
 */
export async function notifyEmployeeAssigned(
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
    
    if (!order || !employee || !employee.telegramId || !order.bot) {
      return { success: false, error: 'Order, employee or telegram not found' };
    }
    
    let bot = getBot(order.botId);
    if (!bot) {
      bot = createBot(order.bot.token, order.botId);
    }
    
    const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const message = `
🎉 *Вы назначены на заказ!*

📍 *${order.title}*

📅 *Дата:* ${dateStr}
⏰ *Время:* ${order.workTime}
📍 *Адрес:* ул. ${order.street}, д. ${order.houseNumber}
${order.district ? `Район: ${order.district}` : ''}

💰 *Оплата:* ${order.pricePerPerson} ₽

Пожалуйста, подтвердите своё участие!
    `;
    
    const { Markup } = require('telegraf');
    
    await bot.telegram.sendMessage(employee.telegramId, message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Подтверждаю', `confirm_${orderId}`),
          Markup.button.callback('❌ Не могу', `cancel_${orderId}`)
        ]
      ])
    });
    
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Отправка уведомления сотруднику об отклонении отклика
 */
export async function notifyEmployeeRejected(
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
    
    if (!order || !employee || !employee.telegramId || !order.bot) {
      return { success: false, error: 'Order, employee or telegram not found' };
    }
    
    let bot = getBot(order.botId);
    if (!bot) {
      bot = createBot(order.bot.token, order.botId);
    }
    
    const message = `
😔 *Ваш отклик отклонён*

Заказ: *${order.title}*

Не расстраивайтесь! Новые заказы появятся скоро.
    `;
    
    await bot.telegram.sendMessage(employee.telegramId, message, {
      parse_mode: 'Markdown'
    });
    
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Обработка напоминаний о сменах (вызывается по cron)
 * Отправляет напоминания за час до начала смены
 */
export async function processShiftReminders(): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  
  try {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + REMINDER_BEFORE_MINUTES * 60 * 1000);
    
    // Находим заказы, которые начнутся через час
    const orders = await prisma.order.findMany({
      where: {
        status: 'IN_PROGRESS',
        workDate: {
          gte: now,
          lte: reminderTime
        }
      },
      include: {
        responses: {
          where: {
            status: 'ASSIGNED'
          },
          include: {
            employee: true
          }
        }
      }
    });
    
    for (const order of orders) {
      for (const response of order.responses) {
        if (response.employee.telegramId) {
          const result = await sendShiftReminder(order.id, response.employee.id);
          if (result.success) {
            processed++;
          } else {
            errors.push(`Order ${order.id}, Employee ${response.employee.id}: ${result.error}`);
          }
        }
      }
    }
    
    return { processed, errors };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { processed: 0, errors: [errorMessage] };
  }
}

/**
 * Планирование напоминания для заказа
 */
export async function scheduleShiftReminder(
  orderId: string,
  workDate: Date
): Promise<boolean> {
  const reminderTime = new Date(workDate.getTime() - REMINDER_BEFORE_MINUTES * 60 * 1000);
  const now = new Date();
  
  if (reminderTime <= now) {
    // Напоминание уже должно было быть отправлено
    return false;
  }
  
  return scheduleTask('REMINDER', { orderId }, reminderTime);
}

/**
 * Отправка уведомления об отмене заказа
 */
export async function notifyOrderCancelled(
  orderId: string,
  reason?: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  let success = true;
  
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        bot: true,
        responses: {
          where: {
            status: { in: ['ASSIGNED', 'PENDING'] }
          },
          include: {
            employee: true
          }
        }
      }
    });
    
    if (!order || !order.bot) {
      return { success: false, errors: ['Order or bot not found'] };
    }
    
    let bot = getBot(order.botId);
    if (!bot) {
      bot = createBot(order.bot.token, order.botId);
    }
    
    const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
    
    const message = `
❌ *Заказ отменён*

📍 *${order.title}*
📅 *Дата:* ${dateStr}

${reason ? `Причина: ${reason}` : 'Причина не указана'}

Приносим извинения за неудобства.
    `;
    
    for (const response of order.responses) {
      if (response.employee.telegramId) {
        try {
          await bot.telegram.sendMessage(response.employee.telegramId, message, {
            parse_mode: 'Markdown'
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Employee ${response.employee.id}: ${errorMessage}`);
          success = false;
        }
      }
    }
    
    return { success, errors };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, errors: [errorMessage] };
  }
}

/**
 * Отправка уведомления о завершении заказа с запросом рейтинга
 */
export async function requestOrderRating(
  orderId: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  let success = true;
  
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        bot: true,
        responses: {
          where: {
            status: 'COMPLETED'
          },
          include: {
            employee: true
          }
        }
      }
    });
    
    if (!order || !order.bot) {
      return { success: false, errors: ['Order or bot not found'] };
    }
    
    let bot = getBot(order.botId);
    if (!bot) {
      bot = createBot(order.bot.token, order.botId);
    }
    
    const message = `
✅ *Заказ завершён!*

📍 *${order.title}*

Пожалуйста, оцените работу сотрудника(ов):
    `;
    
    const { Markup } = require('telegraf');
    
    for (const response of order.responses) {
      if (response.employee.telegramId) {
        try {
          await bot.telegram.sendMessage(response.employee.telegramId, message, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('⭐ 5', `rate_${orderId}_${response.employee.id}_5`),
                Markup.button.callback('⭐ 4', `rate_${orderId}_${response.employee.id}_4`),
                Markup.button.callback('⭐ 3', `rate_${orderId}_${response.employee.id}_3`)
              ],
              [
                Markup.button.callback('⭐ 2', `rate_${orderId}_${response.employee.id}_2`),
                Markup.button.callback('⭐ 1', `rate_${orderId}_${response.employee.id}_1`)
              ]
            ])
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Employee ${response.employee.id}: ${errorMessage}`);
          success = false;
        }
      }
    }
    
    return { success, errors };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, errors: [errorMessage] };
  }
}

export default {
  notifyManagerAboutResponse,
  notifyManagerCheckin,
  notifyManagerCompletion,
  notifyManagerCancelledByEmployee,
  notifyEmployeeAssigned,
  notifyEmployeeRejected,
  processShiftReminders,
  scheduleShiftReminder,
  notifyOrderCancelled,
  requestOrderRating
};