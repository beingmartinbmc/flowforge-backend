import { prisma } from '@/lib/db';
import { redis, QUEUE_NAMES } from '@/lib/redis';
import { TaskService } from './task-service';

export class SchedulerService {
  static async scheduleReadyTasks(): Promise<void> {
    try {
      // Find all runs that are currently running
      const runningRuns = await prisma.run.findMany({
        where: { status: 'RUNNING' },
        include: {
          workflow: true,
          tasks: true,
        },
      });

      for (const run of runningRuns) {
        await this.processRunForScheduling(run);
      }
    } catch (error) {
      console.error('Error in scheduleReadyTasks:', error);
    }
  }

  static async processRunForScheduling(run: any): Promise<void> {
    const workflow = run.workflow;
    const nodes = workflow.nodes as any[];
    const edges = workflow.edges as any[];
    const existingTasks = run.tasks;

    // Find all nodes that don't have tasks yet
    const nodesWithoutTasks = nodes.filter((node: any) => {
      return !existingTasks.some((task: any) => task.nodeId === node.id);
    });

    // For each node without a task, check if all dependencies are satisfied
    for (const node of nodesWithoutTasks) {
      const dependencies = edges
        .filter((edge: any) => edge.target === node.id)
        .map((edge: any) => edge.source);

      const allDependenciesSatisfied = dependencies.every((depNodeId: string) => {
        const depTask = existingTasks.find((task: any) => task.nodeId === depNodeId);
        return depTask && depTask.status === 'SUCCESS';
      });

      if (allDependenciesSatisfied) {
        // Create task for this node
        const task = await prisma.task.create({
          data: {
            runId: run.id,
            workflowId: run.workflowId,
            nodeId: node.id,
            status: 'PENDING',
            input: run.input,
            idempotencyKey: `${run.id}-${node.id}`,
          },
        });

        // Queue the task
        await redis.lpush(QUEUE_NAMES.TASK_QUEUE, { taskId: task.id });

        console.log(`Scheduled task ${task.id} for node ${node.id} in run ${run.id}`);
      }
    }
  }

  static async processRetryQueue(): Promise<void> {
    try {
      // Get all retry messages
      const retryMessages = await redis.lrange(QUEUE_NAMES.RETRY_QUEUE, 0, -1);
      const now = Date.now();

      for (const message of retryMessages) {
        try {
          const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
          
          if (parsedMessage.retryAt <= now) {
            // Remove from retry queue
            await redis.lrem(QUEUE_NAMES.RETRY_QUEUE, 1, message);
            
            // Add back to main task queue
            if (parsedMessage.taskId) {
              await redis.lpush(QUEUE_NAMES.TASK_QUEUE, { taskId: parsedMessage.taskId });
              console.log(`Moved task ${parsedMessage.taskId} from retry queue to main queue`);
            }
          }
        } catch (error) {
          console.error('Error processing retry message:', error);
          // Remove malformed message
          await redis.lrem(QUEUE_NAMES.RETRY_QUEUE, 1, message);
        }
      }
    } catch (error) {
      console.error('Error in processRetryQueue:', error);
    }
  }

  static async cleanupCompletedRuns(): Promise<void> {
    try {
      // Find runs that have been completed for more than 24 hours
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - 24);

      const completedRuns = await prisma.run.findMany({
        where: {
          status: { in: ['SUCCESS', 'FAILED', 'CANCELED'] },
          completedAt: { lt: cutoffDate },
        },
        select: { id: true },
      });

      for (const run of completedRuns) {
        // Delete associated tasks and logs
        await prisma.taskLog.deleteMany({
          where: { runId: run.id },
        });

        await prisma.task.deleteMany({
          where: { runId: run.id },
        });

        // Delete the run
        await prisma.run.delete({
          where: { id: run.id },
        });

        console.log(`Cleaned up completed run ${run.id}`);
      }
    } catch (error) {
      console.error('Error in cleanupCompletedRuns:', error);
    }
  }

  static async startScheduler(): Promise<void> {
    console.log('Starting scheduler service...');
    
    // Run initial scheduling
    await this.scheduleReadyTasks();
    await this.processRetryQueue();
    
    // Set up periodic scheduling (every 30 seconds)
    setInterval(async () => {
      await this.scheduleReadyTasks();
      await this.processRetryQueue();
    }, 30000);

    // Set up cleanup (every hour)
    setInterval(async () => {
      await this.cleanupCompletedRuns();
    }, 3600000);
  }
}
