import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Redis environment variables are not set');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Queue names
export const QUEUE_NAMES = {
  TASK_QUEUE: 'task-queue',
  RETRY_QUEUE: 'retry-queue',
  DLQ: 'dead-letter-queue',
} as const;

// Stream names for real-time updates
export const STREAM_NAMES = {
  TASK_EVENTS: 'task-events',
  RUN_EVENTS: 'run-events',
} as const;

export default redis;
