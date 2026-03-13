/**
 * Telegram Bot Module
 * Основной модуль для работы с Telegram ботами
 */

import { Telegraf, Context, Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { emitOrderUpdate } from '@/lib/socket-helper';
import { 
  notifyManagerAboutResponse,
  notifyManagerCancelledByEmployee,
  notifyManagerCheckin,
  notifyManagerCompletion
} from '@/lib/notifications';

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
    // Проверяем, существует ли контакт для данного бота
    let contact = await db.contact.findUnique({
      where: { 
        telegramId_botId: {
          telegramId,
          botId: ctx.botId
        }
      }
    });
    
    if (!contact) {
      // Создаем новый контакт
      contact = await db.contact.create({
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
      await db.contact.update({
        where: { 
          telegramId_botId: {
            telegramId,
            botId: ctx.botId
          }
        },
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

💡 *Управление заказами:*
Используйте кнопку "📋 Мои заказы", чтобы посмотреть текущие назначения.
Для отправки отчета по работе - просто пришлите фото или текст в чат, когда вы находитесь на объекте (статус "Я на месте").
  `;
  
  await ctx.reply(helpText, { parse_mode: 'Markdown' });
}

/**
 * Обработка "📋 Мои заказы"
 */
async function handleMyOrders(ctx: BotContext) {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  try {
    // Находим активные назначения работника
    const activeResponses = await db.orderResponse.findMany({
      where: {
        employee: { telegramId },
        status: { in: ['ASSIGNED', 'CHECKED_IN'] },
        order: { status: { notIn: ['COMPLETED', 'CANCELLED'] } }
      },
      include: { order: true }
    });

    if (activeResponses.length === 0) {
      return ctx.reply('У вас пока нет активных заказов.');
    }

    let message = '📋 *Ваши активные заказы:*\n\n';
    for (const resp of activeResponses) {
      const order = resp.order;
      const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU');
      const statusText = resp.status === 'ASSIGNED' ? '🟡 Ожидает чек-ина' : '🟢 В работе';
      
      message += `📍 *${order.title}*\n`;
      message += `🗓 ${dateStr} в ${order.workTime}\n`;
      message += `🏠 ул. ${order.street}, д. ${order.houseNumber}\n`;
      message += `Статус: ${statusText}\n`;
      
      // Добавляем инлайн кнопку для чек-ина или завершения
      if (resp.status === 'ASSIGNED') {
         message += `\n`;
         await ctx.reply(message, { 
           parse_mode: 'Markdown',
           ...Markup.inlineKeyboard([[Markup.button.callback('📍 Я на месте (Чек-ин)', `checkin_${order.id}`)]])
         });
      } else if (resp.status === 'CHECKED_IN') {
         message += `\n`;
         await ctx.reply(message, { 
           parse_mode: 'Markdown',
           ...Markup.inlineKeyboard([[Markup.button.callback('✅ Завершить работу', `confirm_${order.id}`)]])
         });
      }
      message = ''; // Сбрасываем для следующего, так как мы отправили сообщение с кнопкой
    }
    
    // Если остались сообщения без кнопок (на всякий случай)
    if (message !== '📋 *Ваши активные заказы:*\n\n' && message !== '') {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }

  } catch (error) {
    console.error('Error fetching orders:', error);
    await ctx.reply('Ошибка загрузки заказов.');
  }
}

/**
 * Обработка входящих сообщений (для отчетов)
 */
async function handleMessage(ctx: BotContext) {
  if (!ctx.message) return;
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  // Игнорируем команды
  if ('text' in ctx.message && ctx.message.text.startsWith('/')) return;
  
  // Если это клик по клавиатуре
  if ('text' in ctx.message) {
    if (ctx.message.text === '📋 Мои заказы') return handleMyOrders(ctx);
    if (ctx.message.text === '👤 Профиль') return ctx.reply('Ваш профиль скоро появится :)');
  }

  // Найти заказ, где работник CHECKED_IN
  try {
    const activeResponse = await db.orderResponse.findFirst({
      where: {
        employee: { telegramId },
        status: 'CHECKED_IN'
      },
      include: { order: true }
    });

    if (!activeResponse) {
      // Если работник не на объекте, просто игнорируем или отвечаем стандартно
      if ('text' in ctx.message && !['📋 Мои заказы', '👤 Профиль'].includes(ctx.message.text)) {
         return ctx.reply('Команда не распознана. Воспользуйтесь меню.');
      }
      return;
    }

    // Сохранение текста
    if ('text' in ctx.message && !['📋 Мои заказы', '👤 Профиль'].includes(ctx.message.text)) {
      const currentText = activeResponse.reportText ? activeResponse.reportText + '\n' : '';
      await db.orderResponse.update({
        where: { id: activeResponse.id },
        data: { reportText: currentText + ctx.message.text }
      });
      await ctx.reply('📝 Текст добавлен в отчёт.');
      emitOrderUpdate(activeResponse.order.id);
    }

    // Сохранение фото
    if ('photo' in ctx.message && ctx.message.photo.length > 0) {
      const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id; // Берем большее разрешение
      
      try {
        const fileLink = await ctx.telegram.getFileLink(photoId);
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const fileName = `telegram_${photoId}.jpg`;
        const filePath = path.join(uploadsDir, fileName);
        
        const response = await fetch(fileLink.toString());
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        
        const publicUrl = `/uploads/${fileName}`;
        const currentPhotos = activeResponse.reportPhotoId ? activeResponse.reportPhotoId + ',' : '';
        
        await db.orderResponse.update({
          where: { id: activeResponse.id },
          data: { reportPhotoId: currentPhotos + publicUrl }
        });
        await ctx.reply('📸 Фото добавлено в отчёт и загружено.');
        emitOrderUpdate(activeResponse.order.id);
      } catch (uploadError) {
        console.error("Error downloading photo:", uploadError);
        await ctx.reply('❌ Ошибка при сохранении фото.');
      }
    }

  } catch (error) {
    console.error('Error processing message as report:', error);
  }
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
    if (data.startsWith('respond_')) {
      await handleOrderResponse(ctx, telegramId, data.replace('respond_', ''));
    }
    else if (data.startsWith('decline_')) {
      await handleOrderDecline(ctx, telegramId, data.replace('decline_', ''));
    }
    else if (data.startsWith('cancel_')) {
      await handleOrderCancel(ctx, telegramId, data.replace('cancel_', ''));
    }
    else if (data.startsWith('checkin_')) {
      await handleCheckin(ctx, telegramId, data.replace('checkin_', ''));
    }
    else if (data.startsWith('confirm_')) {
      await handleWorkConfirm(ctx, telegramId, data.replace('confirm_', ''));
    }
    else if (data.startsWith('rate_')) {
      // rate_{orderId}_{employeeId}_{score}
      const parts = data.split('_');
      if (parts.length === 4) {
        await handleRating(ctx, parts[1], parts[2], parseInt(parts[3]));
      }
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
  if (!ctx.botId) return;
  
  const contact = await db.contact.findUnique({
    where: { telegramId_botId: { telegramId, botId: ctx.botId } }
  });
  
  if (!contact) {
    return ctx.answerCbQuery('Вы не зарегистрированы. Отправьте /start');
  }
  
  const existingResponse = await db.orderResponse.findFirst({
    where: { orderId, employee: { telegramId } }
  });
  
  if (existingResponse) {
    return ctx.answerCbQuery('Вы уже откликнулись на этот заказ');
  }
  
  let employee = await db.employee.findFirst({ where: { telegramId } });
  
  if (!employee) {
    employee = await db.employee.create({
      data: {
        firstName: contact.firstName || 'Неизвестно',
        lastName: contact.lastName || '',
        phone: contact.phone || '',
        telegramId,
        status: 'AVAILABLE'
      }
    });
  }
  
  await db.orderResponse.create({
    data: {
      orderId,
      employeeId: employee.id,
      status: 'PENDING'
    }
  });
  
  // Уведомляем менеджера о новом отклике
  await notifyManagerAboutResponse(orderId, employee.id);
  emitOrderUpdate(orderId);

  await ctx.answerCbQuery('✅ Ваш отклик принят!');
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply('✅ Вы успешно откликнулись на заказ!\nОжидайте решения менеджера.');
}

/**
 * Обработка отказа от заказа (до отклика)
 */
async function handleOrderDecline(ctx: BotContext, telegramId: string, orderId: string) {
  await ctx.answerCbQuery('Вы отказались от заказа');
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply('❌ Вы отказались от заказа.');
}

/**
 * Отказ от заказа после назначения
 */
async function handleOrderCancel(ctx: BotContext, telegramId: string, orderId: string) {
  const response = await db.orderResponse.findFirst({
    where: { orderId, employee: { telegramId } },
    include: { order: true, employee: true } // Include order and employee to pass to notification
  });

  if (!response) return ctx.answerCbQuery('Заказ не найден');

  // Если работник был назначен, обновляем статус
  if (response.status === 'ASSIGNED') {
    await db.orderResponse.update({
      where: { id: response.id },
      data: { status: 'REJECTED' }
    });
    
    // В реальном проекте здесь нужно вызвать notifyManagerCancelledByEmployee
    console.log(`[Lifecycle] Employee ${telegramId} cancelled assignment for order ${orderId}`);
    if (response.order && response.employee) {
      await notifyManagerCancelledByEmployee(response.order.id, response.employee.id);
    }
  }

  await ctx.answerCbQuery('Вы отменили участие');
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply('❌ Вы отменили своё участие в заказе.');
  emitOrderUpdate(orderId);
}

/**
 * Чек-ин на объекте
 */
async function handleCheckin(ctx: BotContext, telegramId: string, orderId: string) {
  const response = await db.orderResponse.findFirst({
    where: { orderId, employee: { telegramId } },
    include: { order: true, employee: true }
  });

  if (!response) return ctx.answerCbQuery('Заказ не найден');
  
  if (response.status === 'COMPLETED') {
    return ctx.answerCbQuery('Заказ уже завершён');
  }

  await db.orderResponse.update({
    where: { id: response.id },
    data: { 
      status: 'CHECKED_IN',
      checkedInAt: new Date()
    }
  });
  
  // Меняем статус заказа на IN_PROGRESS если это первый чек-ин
  if (response.order.status === 'PUBLISHED') {
     await db.order.update({
       where: { id: orderId },
       data: { status: 'IN_PROGRESS' }
     });
  }

  // Обновляем статус сотрудника
  await db.employee.update({
    where: { id: response.employeeId },
    data: { status: 'WORKING' }
  });

  console.log(`[Lifecycle] Employee ${telegramId} checked in at ${orderId}`);

  // Уведомляем менеджера о чек-ине
  if (response.order && response.employee) {
    await notifyManagerCheckin(orderId, response.employee.id);
  }
  emitOrderUpdate(orderId);

  await ctx.answerCbQuery('Чек-ин успешен!');
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply(
    `✅ *Чек-ин выполнен!*\n` +
    `Теперь вы можете присылать в этот чат фото и текст, они будут прикреплены к отчёту по заказу.\n` +
    `Когда закончите, нажмите кнопку "Завершить работу" в меню "Мои заказы".`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Подтверждение выполнения работы
 */
async function handleWorkConfirm(ctx: BotContext, telegramId: string, orderId: string) {
  const response = await db.orderResponse.findFirst({
    where: { orderId, employee: { telegramId } },
    include: { order: true, employee: true }
  });

  if (!response) return ctx.answerCbQuery('Заказ не найден');

  // Обновляем статус отклика
  await db.orderResponse.update({
    where: { id: response.id },
    data: { 
      status: 'COMPLETED',
      completedAt: new Date() 
    }
  });

  // Создаем WorkHistory
  await db.workHistory.create({
    data: {
      employeeId: response.employeeId,
      orderId: orderId,
      orderTitle: response.order.title,
      workDate: response.order.workDate
    }
  });

  // Освобождаем сотрудника
  await db.employee.update({
    where: { id: response.employeeId },
    data: { status: 'AVAILABLE' }
  });

  // Проверяем, завершили ли все остальные назначенные работники
  const allAssigned = await db.orderResponse.findMany({
    where: { 
      orderId, 
      status: { in: ['ASSIGNED', 'CHECKED_IN'] } 
    }
  });

  // Если больше никого в работе нет
  if (allAssigned.length === 0) {
    await db.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' }
    });
    console.log(`[Lifecycle] Order ${orderId} AUTO-COMPLETED.`);
  }

  // Уведомляем менеджера о завершении работы
  if (response.order && response.employee) {
    await notifyManagerCompletion(orderId, response.employee.id);
  }
  emitOrderUpdate(orderId);

  await ctx.answerCbQuery('Работа подтверждена!');
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply('✅ *Работа успешно завершена!*\nСпасибо за труд! Отчёт передан менеджеру.', { parse_mode: 'Markdown' });
}

/**
 * Обработка оценки от менеджера (через бота менеджера)
 */
async function handleRating(ctx: BotContext, orderId: string, employeeId: string, score: number) {
  const response = await db.orderResponse.findFirst({
    where: { orderId, employeeId }
  });

  if (!response) return ctx.answerCbQuery('Отклик не найден');

  await db.orderResponse.update({
    where: { id: response.id },
    data: { 
      rating: score,
      ratedAt: new Date()
    }
  });

  // Пересчет среднего рейтинга сотрудника
  const allRatings = await db.orderResponse.findMany({
    where: { employeeId, rating: { not: null } },
    select: { rating: true }
  });
  
  if (allRatings.length > 0) {
    const total = allRatings.reduce((sum, r) => sum + (r.rating || 0), 0);
    const avg = total / allRatings.length;
    
    await db.employee.update({
      where: { id: employeeId },
      data: { rating: avg }
    });
  }

  await ctx.answerCbQuery(`Оценка ${score} добавлена`);
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply(`Оценка ⭐${score} успешно сохранена.`);
}

/**
 * Создание экземпляра бота
 */
export function createBot(token: string, botId: string): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(token);
  
  bot.use((ctx, next) => {
    ctx.botId = botId;
    return next();
  });
  
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.on('message', handleMessage);
  bot.on('callback_query', handleCallbackQuery);
  
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
  if (!bot) throw new Error('Bot not found');
  
  const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
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
  
  await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown', ...keyboard });
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
  if (!bot) throw new Error('Bot not found');
  
  const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long'
  });
  
  const message = `
🎉 *Поздравляем! Вы назначены на заказ!*

📍 *${order.title}*

📅 *Дата:* ${dateStr}
⏰ *Время:* ${order.workTime}
📍 *Адрес:* ул. ${order.street}, д. ${order.houseNumber}

⚠️ *За 1 час до смены вам придет напоминание.* 
Обязательно сделайте 📍 Чек-ин "Я на месте" перед началом работы!
  `;
  
  const keyboard = Markup.inlineKeyboard([
    // Кнопка отказа до чек-ина
    [Markup.button.callback('❌ Не смогу выйти (Отмена)', `cancel_${order.id}`)]
  ]);
  
  await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Инициализация всех активных ботов из БД
 */
export async function initializeBots() {
  const activeBots = await db.bot.findMany({ where: { isActive: true } });
  
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

export function getBot(botId: string): Telegraf<BotContext> | undefined {
  return bots.get(botId);
}

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