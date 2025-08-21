import { redis, QUEUE_NAMES } from '@/lib/redis';
import { TaskService } from '@/services/task-service';

class TaskWorker {
  private isRunning = false;
  private pollInterval = 1000; // 1 second

  async start() {
    if (this.isRunning) {
      console.log('Worker is already running');
      return;
    }

    this.isRunning = true;
    console.log('Task worker started');

    while (this.isRunning) {
      try {
        await this.processNextTask();
        await this.sleep(this.pollInterval);
      } catch (error) {
        console.error('Error in task worker:', error);
        await this.sleep(this.pollInterval);
      }
    }
  }

  async stop() {
    this.isRunning = false;
    console.log('Task worker stopped');
  }

  private async processNextTask() {
    // Process main task queue
    const taskMessage = await redis.rpop(QUEUE_NAMES.TASK_QUEUE);
    if (taskMessage) {
      await this.processTaskMessage(typeof taskMessage === 'string' ? JSON.parse(taskMessage) : taskMessage);
      return;
    }

    // Process retry queue
    const retryMessages = await redis.lrange(QUEUE_NAMES.RETRY_QUEUE, 0, -1);
    const now = Date.now();

    for (const message of retryMessages) {
      const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
      if (parsedMessage.retryAt <= now) {
        await redis.lrem(QUEUE_NAMES.RETRY_QUEUE, 1, message);
        await this.processTaskMessage(parsedMessage);
      }
    }
  }

  private async processTaskMessage(message: any) {
    try {
      if (message.taskId) {
        await TaskService.processTask(message.taskId);
      }
    } catch (error) {
      console.error('Error processing task message:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const taskWorker = new TaskWorker();

// Start worker if this file is run directly
if (require.main === module) {
  taskWorker.start().catch(console.error);
}
