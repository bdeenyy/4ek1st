import Redis from 'ioredis';

// Redis connection singleton
let redis: Redis | null = null;

export function getRedisConnection(): Redis | null {
  if (!redis && process.env.REDIS_URL) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.error('Redis connection retry limit exceeded');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });
      
      redis.on('error', (err) => {
        console.error('Redis connection error:', err);
        redis = null;
      });
      
      redis.on('connect', () => {
        console.log('Redis connected successfully');
      });
    } catch (error) {
      console.error('Failed to create Redis connection:', error);
      return null;
    }
  }
  return redis;
}

// Queue names
export const QUEUES = {
  ORDER_BROADCAST: 'order:broadcast',
  NOTIFICATIONS: 'notifications',
  SCHEDULED_TASKS: 'scheduled:tasks',
} as const;

// Queue message types
export interface BroadcastMessage {
  type: 'ORDER_BROADCAST';
  orderId: string;
  botId: string;
  scheduledAt?: string;
}

export interface NotificationMessage {
  type: 'NOTIFICATION';
  userId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ScheduledTask {
  type: 'SCHEDULED_TASK';
  taskType: 'PUBLISH_ORDER' | 'REMINDER' | 'CLEANUP';
  payload: Record<string, unknown>;
  executeAt: string;
}

type QueueMessage = BroadcastMessage | NotificationMessage | ScheduledTask;

// Add message to queue
export async function enqueue(
  queueName: string,
  message: QueueMessage,
  options?: {
    delay?: number; // milliseconds
    priority?: number;
  }
): Promise<boolean> {
  const client = getRedisConnection();
  if (!client) {
    console.warn('Redis not available, skipping queue operation');
    return false;
  }

  try {
    const messageStr = JSON.stringify(message);
    
    if (options?.delay) {
      // Delayed message using sorted set
      const executeAt = Date.now() + options.delay;
      await client.zadd(`${queueName}:delayed`, executeAt, messageStr);
    } else {
      // Immediate message using list
      await client.lpush(queueName, messageStr);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to enqueue message:', error);
    return false;
  }
}

// Get message from queue (blocking)
export async function dequeue(
  queueName: string,
  timeout: number = 5
): Promise<QueueMessage | null> {
  const client = getRedisConnection();
  if (!client) {
    return null;
  }

  try {
    // Check for delayed messages first
    const now = Date.now();
    const delayedMessages = await client.zrangebyscore(
      `${queueName}:delayed`,
      0,
      now,
      'LIMIT',
      0,
      1
    );
    
    if (delayedMessages.length > 0) {
      // Remove from sorted set and return
      await client.zrem(`${queueName}:delayed`, delayedMessages[0]);
      return JSON.parse(delayedMessages[0]);
    }
    
    // Blocking pop from list
    const result = await client.brpop(queueName, timeout);
    if (result) {
      return JSON.parse(result[1]);
    }
    
    return null;
  } catch (error) {
    console.error('Failed to dequeue message:', error);
    return null;
  }
}

// Get queue length
export async function getQueueLength(queueName: string): Promise<number> {
  const client = getRedisConnection();
  if (!client) {
    return 0;
  }

  try {
    const listLength = await client.llen(queueName);
    const delayedLength = await client.zcard(`${queueName}:delayed`);
    return listLength + delayedLength;
  } catch (error) {
    console.error('Failed to get queue length:', error);
    return 0;
  }
}

// Clear queue
export async function clearQueue(queueName: string): Promise<void> {
  const client = getRedisConnection();
  if (!client) {
    return;
  }

  try {
    await client.del(queueName);
    await client.del(`${queueName}:delayed`);
  } catch (error) {
    console.error('Failed to clear queue:', error);
  }
}

// Schedule a task for future execution
export async function scheduleTask(
  taskType: ScheduledTask['taskType'],
  payload: Record<string, unknown>,
  executeAt: Date
): Promise<boolean> {
  const message: ScheduledTask = {
    type: 'SCHEDULED_TASK',
    taskType,
    payload,
    executeAt: executeAt.toISOString(),
  };
  
  const delay = executeAt.getTime() - Date.now();
  
  if (delay <= 0) {
    // Execute immediately
    return enqueue(QUEUES.SCHEDULED_TASKS, message);
  }
  
  return enqueue(QUEUES.SCHEDULED_TASKS, message, { delay });
}

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisConnection();
  if (!client) {
    return null;
  }

  try {
    const value = await client.get(key);
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<boolean> {
  const client = getRedisConnection();
  if (!client) {
    return false;
  }

  try {
    const valueStr = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, valueStr);
    } else {
      await client.set(key, valueStr);
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

export async function cacheDelete(key: string): Promise<boolean> {
  const client = getRedisConnection();
  if (!client) {
    return false;
  }

  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
}

// Close Redis connection
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}