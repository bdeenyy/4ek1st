/**
 * Cron API endpoint
 * Вызывается внешним планировщиком (cron, Vercel Cron, и т.д.)
 * для обработки отложенных задач
 */

import { NextRequest, NextResponse } from 'next/server';
import { processScheduledPublications } from '@/bot/broadcast';
import { processShiftReminders } from '@/lib/notifications';
import { dequeue, QUEUES } from '@/lib/queue';

// Секретный ключ для защиты endpoint
const CRON_SECRET = process.env.CRON_SECRET || 'cron-secret-key';

/**
 * Обработка cron запросов
 * GET /api/cron?secret=xxx&type=reminders|publications|queue
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка секретного ключа
    const secret = request.nextUrl.searchParams.get('secret');
    if (secret !== CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const type = request.nextUrl.searchParams.get('type') || 'all';
    
    const results: Record<string, unknown> = {};
    
    // Обработка напоминаний о сменах
    if (type === 'all' || type === 'reminders') {
      results.reminders = await processShiftReminders();
    }
    
    // Обработка отложенных публикаций
    if (type === 'all' || type === 'publications') {
      results.publications = await processScheduledPublications();
    }
    
    // Обработка очереди сообщений
    if (type === 'all' || type === 'queue') {
      results.queue = await processQueue();
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
    
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * Обработка сообщений из очереди
 */
async function processQueue(): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  
  try {
    // Обрабатываем до 10 сообщений за раз
    for (let i = 0; i < 10; i++) {
      const message = await dequeue(QUEUES.SCHEDULED_TASKS, 1);
      if (!message) break;
      
      try {
        await processQueueMessage(message);
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Message ${i}: ${errorMessage}`);
      }
    }
    
    return { processed, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { processed: 0, errors: [errorMessage] };
  }
}

/**
 * Обработка отдельного сообщения из очереди
 */
async function processQueueMessage(message: unknown): Promise<void> {
  const msg = message as {
    type: string;
    taskType?: string;
    payload?: Record<string, unknown>;
  };
  
  if (msg.type === 'SCHEDULED_TASK' && msg.taskType && msg.payload) {
    switch (msg.taskType) {
      case 'PUBLISH_ORDER':
        // Публикация заказа
        const { publishOrder } = await import('@/bot/broadcast');
        await publishOrder(msg.payload.orderId as string);
        break;
        
      case 'REMINDER':
        // Напоминание о смене
        const { sendShiftReminder } = await import('@/bot/broadcast');
        // Для напоминаний нужно найти всех назначенных сотрудников
        const { PrismaClient, ResponseStatus } = await import('@prisma/client');
        const prisma = new PrismaClient();
        
        const order = await prisma.order.findUnique({
          where: { id: msg.payload.orderId as string },
          include: {
            responses: {
              where: { status: ResponseStatus.ASSIGNED },
              include: { employee: true }
            }
          }
        });
        
        if (order) {
          for (const response of order.responses) {
            if (response.employee.telegramId) {
              await sendShiftReminder(order.id, response.employee.id);
            }
          }
        }
        break;
        
      case 'CLEANUP':
        // Очистка старых данных
        await cleanupOldData();
        break;
        
      default:
        console.warn(`Unknown task type: ${msg.taskType}`);
    }
  }
}

/**
 * Очистка старых данных
 */
async function cleanupOldData(): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  // Удаляем старые отклоненные отклики (старше 30 дней)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  await prisma.orderResponse.deleteMany({
    where: {
      status: 'REJECTED',
      respondedAt: { lt: thirtyDaysAgo }
    }
  });
  
  // Удаляем старые отмененные заказы (старше 90 дней)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  await prisma.order.deleteMany({
    where: {
      status: 'CANCELLED',
      updatedAt: { lt: ninetyDaysAgo }
    }
  });
}