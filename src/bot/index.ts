/**
 * Telegram Bot Module
 * Основной модуль для работы с Telegram ботами
 */

import { Telegraf, Context, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Типы для бота
interface BotContext extends Context {
  botId?: string;
}

// Хранилище экземпляров ботов
const bots: Map<string, Telegraf<BotContext>> = new Map();

/**
 * Обработка команды /start
 */
async function handleStart(ctx: BotContext) {
  const telegramId = ctx.from?.id.toString();
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  const username = ctx.from?.username;
  
  if (!telegramId || !ctx.botId) {
    return ctx.reply('Ошибка авторизации. Попробуйте позже.');
  }
  
  try {
    // Проверяем, существует ли контакт
    let contact = await prisma.contact.findUnique({
      where: { telegramId }
    });
    
    if (!contact) {
      // Создаем новый контакт
      contact = await prisma.contact.create({
        data: {
          telegramId,
          firstName: firstName || null,
          lastName: lastName || null,
          username: username || null,
          botId: ctx.botId,
          status: 'NEW'
        }
      });
      
      await ctx.reply(
        `👋 Добро пожаловать, ${firstName || 'друг'}!\n\n` +
        `Вы успешно зарегистрированы в системе.\n` +
        `Ожидайте подтверждения от менеджера.`,
        Markup.keyboard([['📋 Мои заказы', '👤 Профиль']]).resize()
      );
    } else {
      // Обновляем информацию
      await prisma.contact.update({
        where: { telegramId },
        data: {
          firstName: firstName || null,
          lastName: lastName || null,
          username: username || null
        }
      });
      
      await ctx.reply(
        `👋 С возвращением, ${firstName || 'друг'}!`,
        Markup.keyboard([['📋 Мои заказы', '👤 Профиль']]).resize()
      );
    }
  } catch (error) {
    console.error('Error in /start handler:', error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Обработка команды /help
 */
async function handleHelp(ctx: BotContext) {
  const helpText = `
📖 *Справка по использованию бота*

📋 *Доступные команды:*
/start - Регистрация в системе
/help - Показать эту справку

💡 *Как это работает:*
1. Вы получаете уведомления о новых заказах
2. Нажимаете кнопку "Откликнуться"
3. Менеджер рассматривает вашу кандидатуру
4. Получаете уведомление о назначении

📞 *Поддержка:* Свяжитесь с менеджером
  `;
  
  await ctx.reply(helpText, { parse_mode: 'Markdown' });
}

/**
 * Обработка callback queries (inline кнопки)
 */
async function handleCallbackQuery(ctx: BotContext) {
  const callbackQuery = ctx.callbackQuery;
  
  if (!callbackQuery || !('data' in callbackQuery)) return;
  
  const data = callbackQuery.data;
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId || !data) return;
  
  try {
    // Обработка отклика на заказ
    if (data.startsWith('respond_')) {
      const orderId = data.replace('respond_', '');
      await handleOrderResponse(ctx, telegramId, orderId);
    }
    
    // Обработка отказа от заказа
    if (data.startsWith('decline_')) {
      const orderId = data.replace('decline_', '');
      await handleOrderDecline(ctx, telegramId, orderId);
    }
    
    // Подтверждение выполнения
    if (data.startsWith('confirm_')) {
      const orderId = data.replace('confirm_', '');
      await handleWorkConfirm(ctx, telegramId, orderId);
    }
    
  } catch (error) {
    console.error('Error in callback query handler:', error);
    await ctx.answerCbQuery('Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Обработка отклика на заказ
 */
async function handleOrderResponse(ctx: BotContext, telegramId: string, orderId: string) {
  // Находим контакт
  const contact = await prisma.contact.findUnique({
    where: { telegramId }
  });
  
  if (!contact) {
    await ctx.answerCbQuery('Вы не зарегистрированы. Отправьте /start');
    return;
  }
  
  // Проверяем, есть ли уже отклик
  const existingResponse = await prisma.orderResponse.findFirst({
    where: {
      orderId,
      employee: { telegramId }
    }
  });
  
  if (existingResponse) {
    await ctx.answerCbQuery('Вы уже откликнулись на этот заказ');
    return;
  }
  
  // Находим или создаем сотрудника по telegramId
  let employee = await prisma.employee.findFirst({
    where: { telegramId }
  });
  
  if (!employee) {
    // Создаем сотрудника на основе данных контакта
    employee = await prisma.employee.create({
      data: {
        firstName: contact.firstName || 'Неизвестно',
        lastName: contact.lastName || '',
        phone: contact.phone || '',
        telegramId,
        status: 'AVAILABLE'
      }
    });
  }
  
  // Создаем отклик
  await prisma.orderResponse.create({
    data: {
      orderId,
      employeeId: employee.id,
      status: 'PENDING'
    }
  });
  
  await ctx.answerCbQuery('✅ Ваш отклик принят!');
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply(
    '✅ Вы успешно откликнулись на заказ!\n' +
    'Ожидайте решения менеджера.'
  );
}

/**
 * Обработка отказа от заказа
 */
async function handleOrderDecline(ctx: BotContext, telegramId: string, orderId: string) {
  await ctx.answerCbQuery('Вы отказались от заказа');
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply('❌ Вы отказались от заказа.');
}

/**
 * Обработка подтверждения выполнения работы
 */
async function handleWorkConfirm(ctx: BotContext, telegramId: string, orderId: string) {
  await ctx.answerCbQuery('Работа подтверждена!');
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply('✅ Спасибо за подтверждение!');
}

/**
 * Создание экземпляра бота
 */
export function createBot(token: string, botId: string): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(token);
  
  // Сохраняем botId в контексте
  bot.use((ctx, next) => {
    ctx.botId = botId;
    return next();
  });
  
  // Обработка команды /start
  bot.command('start', handleStart);
  
  // Обработка команды /help
  bot.command('help', handleHelp);
  
  // Обработка callback queries
  bot.on('callback_query', handleCallbackQuery);
  
  // Сохраняем в хранилище
  bots.set(botId, bot);
  
  return bot;
}

/**
 * Отправка карточки заказа в чат
 */
export async function sendOrderCard(
  botToken: string,
  chatId: string | number,
  order: {
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
  }
) {
  const bot = Array.from(bots.values()).find(b => b.telegram?.token === botToken);
  
  if (!bot) {
    throw new Error('Bot not found');
  }
  
  const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const message = `
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
  
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Откликнуться', `respond_${order.id}`),
      Markup.button.callback('❌ Отказаться', `decline_${order.id}`)
    ]
  ]);
  
  await bot.telegram.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

/**
 * Отправка уведомления о назначении
 */
export async function sendAssignmentNotification(
  botToken: string,
  telegramId: string,
  order: {
    id: string;
    title: string;
    workDate: Date;
    workTime: string;
    street: string;
    houseNumber: string;
  }
) {
  const bot = Array.from(bots.values()).find(b => b.telegram?.token === botToken);
  
  if (!bot) {
    throw new Error('Bot not found');
  }
  
  const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  });
  
  const message = `
🎉 *Поздравляем! Вы назначены на заказ!*

📍 *${order.title}*

📅 *Дата:* ${dateStr}
⏰ *Время:* ${order.workTime}
📍 *Адрес:* ул. ${order.street}, д. ${order.houseNumber}

⚠️ Не забудьте подтвердить выполнение после работы!
  `;
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Подтвердить выполнение', `confirm_${order.id}`)]
  ]);
  
  await bot.telegram.sendMessage(telegramId, message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

/**
 * Инициализация всех активных ботов из базы данных
 */
export async function initializeBots() {
  const activeBots = await prisma.bot.findMany({
    where: { isActive: true }
  });
  
  for (const botData of activeBots) {
    try {
      createBot(botData.token, botData.id);
      console.log(`Bot "${botData.name}" initialized successfully`);
    } catch (error) {
      console.error(`Failed to initialize bot "${botData.name}":`, error);
    }
  }
  
  return activeBots.length;
}

/**
 * Получение экземпляра бота по ID
 */
export function getBot(botId: string): Telegraf<BotContext> | undefined {
  return bots.get(botId);
}

/**
 * Получение всех активных ботов
 */
export function getAllBots(): Map<string, Telegraf<BotContext>> {
  return bots;
}

export default {
  createBot,
  initializeBots,
  getBot,
  getAllBots,
  sendOrderCard,
  sendAssignmentNotification
};