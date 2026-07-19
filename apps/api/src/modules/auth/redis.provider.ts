import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Redis client provider using ioredis.
 * Connects to REDIS_URL env variable or defaults to localhost:6379.
 */
export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    client.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    client.on('connect', () => {
      console.log('Redis connected successfully');
    });

    return client;
  },
};
