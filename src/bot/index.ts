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
  notifyManagerCompletion,
  notifyEmployeeAssigned,
  notifyEmployeeRejected
} from '@/lib/notifications';
import { closeOrderBroadcast } from './broadcast';

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
      // Новый пользователь — сначала запрашиваем согласие на обработку ПД (152-ФЗ)
      await ctx.reply(
        `👋 Добро пожаловать, ${firstName || 'друг'}!\n\n` +
        `Для регистрации в системе необходимо ваше согласие на обработку персональных данных.\n\n` +
        `📄 Нажимая кнопку *«Принимаю»*, вы соглашаетесь с обработкой ваших персональных данных ` +
        `(имя, телефон, Telegram ID) в соответствии с Федеральным законом № 152-ФЗ ` +
        `«О персональных данных» для организации временного трудоустройства.\n\n` +
        `Ознакомиться с политикой конфиденциальности можно на нашем сайте.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Принимаю условия', `consent_accept_${ctx.botId}`)],
            [Markup.button.callback('❌ Отказываюсь', `consent_decline_${ctx.botId}`)]
          ])
        }
      );
      return;
    }

    if (!contact.consentGivenAt) {
      // Контакт существует, но не дал согласие — повторный запрос
      await ctx.reply(
        `Для использования бота необходимо принять условия обработки персональных данных.`,
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Принимаю условия', `consent_accept_${ctx.botId}`)],
            [Markup.button.callback('❌ Отказываюсь', `consent_decline_${ctx.botId}`)]
          ])
        }
      );
      return;
    }

    if (contact && contact.consentGivenAt) {
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

    const escMd = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
    let message = '📋 *Ваши активные заказы:*\n\n';
    for (const resp of activeResponses) {
      const order = resp.order;
      const dateStr = new Date(order.workDate).toLocaleDateString('ru-RU');
      const statusText = resp.status === 'ASSIGNED' ? '🟡 Ожидает чек\\-ина' : '🟢 В работе';

      message += `📍 *${escMd(order.title)}*\n`;
      message += `🗓 ${escMd(dateStr)} в ${escMd(order.workTime)}\n`;
      message += `🏠 ул\\. ${escMd(order.street)}, д\\. ${escMd(order.houseNumber)}\n`;
      message += `Статус: ${statusText}\n`;
      
      // Добавляем инлайн кнопку для чек-ина или завершения
      if (resp.status === 'ASSIGNED') {
         message += `\n`;
         await ctx.reply(message, {
           parse_mode: 'MarkdownV2',
           ...Markup.inlineKeyboard([[Markup.button.callback('📍 Я на месте (Чек-ин)', `checkin_${order.id}`)]])
         });
      } else if (resp.status === 'CHECKED_IN') {
         message += `\n`;
         await ctx.reply(message, {
           parse_mode: 'MarkdownV2',
           ...Markup.inlineKeyboard([[Markup.button.callback('✅ Завершить работу', `confirm_${order.id}`)]])
         });
      }
      message = ''; // Сбрасываем для следующего, так как мы отправили сообщение с кнопкой
    }

    // Если остались сообщения без кнопок (на всякий случай)
    if (message !== '📋 *Ваши активные заказы:*\n\n' && message !== '') {
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
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
    if (ctx.message.text === '👤 Профиль') return handleProfile(ctx);
    if (ctx.message.text === '⏭ Пропустить') {
      return ctx.reply(
        'Хорошо, вы можете добавить номер позже через кнопку «👤 Профиль».',
        Markup.keyboard([['📋 Мои заказы', '👤 Профиль']]).resize()
      );
    }
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
    if (data.startsWith('consent_accept_')) {
      await handleConsentAccept(ctx, telegramId, data.replace('consent_accept_', ''));
    }
    else if (data.startsWith('consent_decline_')) {
      await handleConsentDecline(ctx);
    }
    else if (data.startsWith('respond_')) {
      await handleOrderResponse(ctx, telegramId, data.replace('respond_', ''));
    }
    else if (data.startsWith('decline_')) {
      await handleOrderDecline(ctx, telegramId, data.replace('decline_', ''));
    }
    else if (data.startsWith('ack_')) {
      // Подтверждение участия в заказе (после назначения менеджером)
      await ctx.answerCbQuery('Отлично! Ждём вас на объекте 👍');
      await ctx.editMessageReplyMarkup(undefined);
      await ctx.reply('✅ Вы подтвердили участие. По прибытии сделайте чек-ин через «📋 Мои заказы».');
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
    else if (data === 'update_phone') {
      await ctx.answerCbQuery();
      await ctx.reply(
        '📱 Нажмите кнопку ниже, чтобы поделиться номером телефона:',
        {
          ...Markup.keyboard([
            [Markup.button.contactRequest('📱 Поделиться номером телефона')],
            ['⏭ Пропустить']
          ]).oneTime().resize()
        }
      );
    }
    else if (data.startsWith('assign_')) {
      await handleManagerAssign(ctx, data.replace('assign_', ''));
    }
    else if (data.startsWith('reject_')) {
      await handleManagerReject(ctx, data.replace('reject_', ''));
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
 * Обработка принятия согласия на обработку ПД
 */
async function handleConsentAccept(ctx: BotContext, telegramId: string, botId: string) {
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  const username = ctx.from?.username;

  try {
    // Создаём контакт с датой согласия
    await db.contact.upsert({
      where: { telegramId_botId: { telegramId, botId } },
      create: {
        telegramId,
        firstName: firstName || null,
        lastName: lastName || null,
        username: username || null,
        botId,
        status: 'NEW',
        consentGivenAt: new Date(),
      },
      update: {
        firstName: firstName || null,
        lastName: lastName || null,
        username: username || null,
        consentGivenAt: new Date(),
      },
    });

    // Обновляем счётчик подписчиков
    const totalCount = await db.contact.count({ where: { botId } });
    await db.bot.update({ where: { id: botId }, data: { subscriberCount: totalCount } });

    await ctx.answerCbQuery('Согласие принято!');
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply(
      `✅ Спасибо! Ваше согласие принято.\n\n` +
      `👋 Добро пожаловать, ${firstName || 'друг'}!\n` +
      `Вы успешно зарегистрированы в системе.\n` +
      `Ожидайте подтверждения от менеджера.`
    );
    // Запрашиваем номер телефона через стандартный механизм Telegram
    await ctx.reply(
      `📱 *Для работы в системе нужен ваш номер телефона.*\n\n` +
      `Нажмите кнопку ниже — Telegram автоматически отправит ваш номер.\n` +
      `Он используется только для связи с менеджером.`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          [Markup.button.contactRequest('📱 Поделиться номером телефона')],
          ['⏭ Пропустить']
        ]).oneTime().resize()
      }
    );
  } catch (error) {
    console.error('Error in consent accept handler:', error);
    await ctx.answerCbQuery('Ошибка. Попробуйте позже.');
  }
}

/**
 * Обработка отказа от согласия на обработку ПД
 */
async function handleConsentDecline(ctx: BotContext) {
  await ctx.answerCbQuery('Вы отказались');
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply(
    `❌ Без согласия на обработку персональных данных регистрация невозможна.\n\n` +
    `Если вы передумаете, отправьте команду /start.`
  );
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

  // Проверяем наличие телефона — он нужен менеджеру для связи
  if (!contact.phone) {
    await ctx.answerCbQuery('Нужен номер телефона!');
    return ctx.reply(
      '📱 *Для отклика на заказ необходим ваш номер телефона.*\n' +
      'Менеджер использует его для связи с вами.\n\n' +
      'Нажмите кнопку ниже:',
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          [Markup.button.contactRequest('📱 Поделиться номером телефона')],
          ['⏭ Пропустить']
        ]).oneTime().resize()
      }
    );
  }

  // Получаем заказ для проверки статуса и заполненности
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, requiredPeople: true }
  });

  if (!order) {
    return ctx.answerCbQuery('Заказ не найден');
  }

  // Проверяем, что заказ ещё принимает отклики
  if (order.status === 'CANCELLED') {
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.answerCbQuery('❌ Заказ отменён');
  }
  if (order.status === 'COMPLETED') {
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.answerCbQuery('Заказ уже завершён');
  }

  // Считаем сколько мест уже занято (ASSIGNED + CHECKED_IN + COMPLETED)
  const filledCount = await db.orderResponse.count({
    where: {
      orderId,
      status: { in: ['ASSIGNED', 'CHECKED_IN', 'COMPLETED'] }
    }
  });

  if (filledCount >= order.requiredPeople) {
    // Все места заняты — убираем кнопки из сообщения
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.answerCbQuery('😔 Все места уже заняты');
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

  // Начисляем зарплату сотруднику
  const salary = response.order.pricePerPerson;
  if (salary > 0) {
    await db.financialRecord.create({
      data: {
        type: 'EXPENSE',
        amount: salary,
        description: `Оплата за заказ: ${response.order.title}`,
        employeeId: response.employeeId,
        orderId: orderId,
      }
    });
    await db.employee.update({
      where: { id: response.employeeId },
      data: { balance: { increment: salary } }
    });
  }

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
 * Менеджер нажал «✅ Назначить» в уведомлении об отклике
 */
async function handleManagerAssign(ctx: BotContext, responseId: string) {
  await ctx.answerCbQuery();

  const response = await db.orderResponse.findUnique({
    where: { id: responseId },
    include: { order: { include: { bot: true } }, employee: true }
  });

  if (!response) {
    return ctx.editMessageText('❌ Отклик не найден или уже удалён.');
  }

  if (response.status !== 'PENDING') {
    const label = response.status === 'ASSIGNED' ? 'уже назначен' : 'отклонён/завершён';
    return ctx.editMessageText(`ℹ️ Сотрудник ${label}.`);
  }

  // Проверяем, есть ли ещё свободные места
  const filledCount = await db.orderResponse.count({
    where: {
      orderId: response.orderId,
      status: { in: ['ASSIGNED', 'CHECKED_IN', 'COMPLETED'] }
    }
  });

  if (filledCount >= response.order.requiredPeople) {
    return ctx.editMessageText('❌ Все места уже заняты — назначение невозможно.');
  }

  await db.orderResponse.update({
    where: { id: responseId },
    data: { status: 'ASSIGNED', assignedAt: new Date() }
  });

  // Уведомляем сотрудника
  await notifyEmployeeAssigned(response.orderId, response.employeeId);

  // Проверяем, заполнен ли заказ
  const newFilledCount = filledCount + 1;
  if (newFilledCount >= response.order.requiredPeople) {
    await closeOrderBroadcast(response.orderId, 'FILLED');
  }

  emitOrderUpdate(response.orderId);

  const escMd2 = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const name = escMd2(`${response.employee.firstName} ${response.employee.lastName}`.trim());
  await ctx.editMessageText(
    `✅ *${name}* назначен на заказ «${escMd2(response.order.title)}»\\.\nСотруднику отправлено уведомление\\.`,
    { parse_mode: 'MarkdownV2' }
  );
}

/**
 * Менеджер нажал «❌ Отклонить» в уведомлении об отклике
 */
async function handleManagerReject(ctx: BotContext, responseId: string) {
  await ctx.answerCbQuery();

  const response = await db.orderResponse.findUnique({
    where: { id: responseId },
    include: { order: true, employee: true }
  });

  if (!response) {
    return ctx.editMessageText('❌ Отклик не найден или уже удалён.');
  }

  if (response.status !== 'PENDING') {
    const label = response.status === 'ASSIGNED' ? 'уже назначен' : 'отклонён/завершён';
    return ctx.editMessageText(`ℹ️ Сотрудник ${label}.`);
  }

  await db.orderResponse.update({
    where: { id: responseId },
    data: { status: 'REJECTED' }
  });

  await notifyEmployeeRejected(response.orderId, response.employeeId);
  emitOrderUpdate(response.orderId);

  const escMd3 = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const name = escMd3(`${response.employee.firstName} ${response.employee.lastName}`.trim());
  await ctx.editMessageText(
    `❌ Отклик *${name}* отклонён\\. Сотруднику отправлено уведомление\\.`,
    { parse_mode: 'MarkdownV2' }
  );
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
 * Обработка входящего контакта (поделился номером телефона)
 */
async function handleContact(ctx: BotContext) {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId || !ctx.botId) return;

  if (!ctx.message || !('contact' in ctx.message)) return;
  const contact = ctx.message.contact;

  // Telegram может прислать чужой контакт — принимаем только свой номер
  if (contact.user_id?.toString() !== telegramId) {
    return ctx.reply('Пожалуйста, поделитесь своим номером телефона.', {
      ...Markup.keyboard([
        [Markup.button.contactRequest('📱 Поделиться номером телефона')],
        ['⏭ Пропустить']
      ]).oneTime().resize()
    });
  }

  const phone = contact.phone_number.replace(/[^\d+]/g, '');

  // Сохраняем в Contact
  await db.contact.update({
    where: { telegramId_botId: { telegramId, botId: ctx.botId } },
    data: { phone }
  });

  // Обновляем Employee если уже создан
  const employee = await db.employee.findFirst({ where: { telegramId } });
  if (employee) {
    await db.employee.update({
      where: { id: employee.id },
      data: { phone }
    });
  }

  await ctx.reply(
    `✅ Номер телефона *${phone}* сохранён!\n\nТеперь всё готово.`,
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([['📋 Мои заказы', '👤 Профиль']]).resize()
    }
  );
}

/**
 * Отображение профиля сотрудника
 */
async function handleProfile(ctx: BotContext) {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId || !ctx.botId) return;

  const contact = await db.contact.findUnique({
    where: { telegramId_botId: { telegramId, botId: ctx.botId } }
  });

  if (!contact) {
    return ctx.reply('Вы не зарегистрированы. Отправьте /start');
  }

  const employee = await db.employee.findFirst({ where: { telegramId } });

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Не указано';
  const username = contact.username ? `@${contact.username}` : 'Не указан';
  const phone = contact.phone || null;

  const statusMap: Record<string, string> = {
    NEW: '🕐 Ожидает подтверждения',
    APPROVED: '✅ Одобрен',
    BANNED: '🚫 Заблокирован',
  };
  const statusText = statusMap[contact.status] ?? contact.status;

  const registeredAt = contact.registeredAt.toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const esc = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');

  let profileText = `👤 *Ваш профиль*\n\n`;
  profileText += `📛 *Имя:* ${esc(name)}\n`;
  profileText += `📱 *Телефон:* ${phone ? esc(phone) : '❌ Не указан'}\n`;
  profileText += `🔗 *Username:* ${esc(username)}\n`;
  profileText += `📊 *Статус:* ${esc(statusText)}\n`;
  profileText += `📅 *В системе с:* ${esc(registeredAt)}\n`;

  if (employee) {
    const workCount = await db.workHistory.count({ where: { employeeId: employee.id } });
    if (workCount > 0) {
      const ratingStr = employee.rating > 0
        ? `⭐ ${esc(employee.rating.toFixed(1))} \\(${workCount} работ\\)`
        : `${workCount} работ, рейтинг ещё не выставлен`;
      profileText += `\n📈 *Статистика:* ${ratingStr}\n`;
    }
  }

  const keyboard = phone
    ? Markup.inlineKeyboard([[Markup.button.callback('📱 Обновить номер', 'update_phone')]])
    : Markup.inlineKeyboard([[Markup.button.callback('📱 Добавить номер телефона', 'update_phone')]]);

  await ctx.reply(profileText, { parse_mode: 'MarkdownV2', ...keyboard });
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
  // contact должен быть до общего message, иначе туда попадёт
  bot.on('contact', handleContact);
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