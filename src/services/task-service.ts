import { prisma } from '@/lib/db';
import { redis, QUEUE_NAMES } from '@/lib/redis';
import { taskHandlerRegistry } from '@/handlers';
import type { TaskContext, TaskResult } from '@/handlers/http-handler';

export class TaskService {
  static async processTask(taskId: string): Promise<void> {
    let task: any = null;
    
    try {
      // Fetch task details
      task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { 
          run: {
            include: {
              workflow: true
            }
          } 
        },
      });

      if (!task) {
        console.error(`Task ${taskId} not found`);
        return;
      }

      // Update task status to running
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      // Get the appropriate handler
      const workflowNodes = task.run.workflow?.nodes as any[];
      const node = workflowNodes?.find((n: any) => n.id === task.nodeId);
      const nodeType = node?.type;
      const handler = taskHandlerRegistry.get(nodeType);
      if (!handler) {
        throw new Error(`No handler found for task type: ${nodeType}`);
      }

      // Create task context
      const context: TaskContext = {
        taskId: task.id,
        runId: task.runId,
        workflowId: task.workflowId,
        nodeId: task.nodeId,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
      };

      // Execute the task with node configuration and input data
      const inputData = { ...node?.config, ...task.input };
      const result: TaskResult = await handler.execute(inputData, context);

      if (result.success) {
        // Task completed successfully
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'SUCCESS',
            output: result.output,
            completedAt: new Date(),
          },
        });

        // Log success
        await prisma.taskLog.create({
          data: {
            taskId: task.id,
            runId: task.runId,
            level: 'INFO',
            message: 'Task completed successfully',
            metadata: result.output,
          },
        });

        // If the task has a logMessage, create an additional log entry for it
        if (result.output?.logMessage) {
          await prisma.taskLog.create({
            data: {
              taskId: task.id,
              runId: task.runId,
              level: (result.output.level || 'INFO').toUpperCase() as any,
              message: result.output.logMessage,
              metadata: { type: 'handler_output' },
            },
          });
        }

        // Schedule dependent tasks
        await this.scheduleDependentTasks(task.runId, task.nodeId);
      } else {
        // Task failed
        if (result.shouldRetry && task.retryCount < task.maxRetries) {
          // Retry the task
          await this.retryTask(task, result.retryDelay || 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(task, result.error || 'Task failed');
        }
      }
    } catch (error: any) {
      console.error(`Error processing task ${taskId}:`, error);
      
      // Update task status to failed
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      // Log error
      await prisma.taskLog.create({
        data: {
          taskId,
          runId: task?.runId || '',
          level: 'ERROR',
          message: error.message,
          metadata: { stack: error.stack },
        },
      });
    }
  }

  static async retryTask(task: any, delayMs: number): Promise<void> {
    // Update retry count
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'RETRY',
        retryCount: task.retryCount + 1,
      },
    });

    // Schedule retry
    await redis.lpush(QUEUE_NAMES.RETRY_QUEUE, {
      taskId: task.id,
      retryAt: Date.now() + delayMs,
    });
  }

  static async moveToDeadLetterQueue(task: any, error: string): Promise<void> {
    // Update task status
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'FAILED',
        error,
        completedAt: new Date(),
      },
    });

    // Add to dead letter queue
    await prisma.deadLetterQueue.create({
      data: {
        runId: task.runId,
        workflowId: task.workflowId,
        nodeId: task.nodeId,
        input: task.input,
        error,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
      },
    });
  }

  static async scheduleDependentTasks(runId: string, completedNodeId: string): Promise<void> {
    // Get the run and workflow
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: { 
        workflow: true,
        tasks: true 
      },
    });

    if (!run) return;

    const workflow = run.workflow;
    const nodes = workflow.nodes as any[];
    const edges = workflow.edges as any[];

    // Find tasks that depend on the completed node
    const dependentTasks = edges
      .filter((edge: any) => edge.source === completedNodeId)
      .map((edge: any) => edge.target);

    // Check if all dependencies are completed for each dependent task
    for (const nodeId of dependentTasks) {
      const nodeDependencies = edges
        .filter((edge: any) => edge.target === nodeId)
        .map((edge: any) => edge.source);

      const allDependenciesCompleted = nodeDependencies.every((depNodeId: string) => {
        const depTask = run.tasks?.find((task: any) => task.nodeId === depNodeId);
        return depTask && depTask.status === 'SUCCESS';
      });

      if (allDependenciesCompleted) {
        // Get output from the completed dependency task
        const completedTask = run.tasks?.find((task: any) => task.nodeId === completedNodeId);
        const taskInput = completedTask?.output || run.input;

        // Create task for this node
        const task = await prisma.task.create({
          data: {
            runId,
            workflowId: run.workflowId,
            nodeId,
            status: 'PENDING',
            input: taskInput as any,
            idempotencyKey: `${runId}-${nodeId}`,
          },
        });

        // Queue the task
        await redis.lpush(QUEUE_NAMES.TASK_QUEUE, { taskId: task.id });
      }
    }

    // Check if all tasks are completed
    const allTasks = await prisma.task.findMany({
      where: { runId },
    });

    const allCompleted = allTasks.every((task) => 
      task.status === 'SUCCESS' || task.status === 'FAILED'
    );

    if (allCompleted) {
      const hasFailures = allTasks.some((task) => task.status === 'FAILED');
      
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: hasFailures ? 'FAILED' : 'SUCCESS',
          completedAt: new Date(),
        },
      });
    }
  }

  static async getTaskLogs(taskId: string): Promise<any[]> {
    return prisma.taskLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
