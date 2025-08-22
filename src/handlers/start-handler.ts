import type { TaskHandler, TaskContext, TaskResult } from './http-handler';

export class StartTaskHandler implements TaskHandler {
  type = 'start';

  async execute(input: Record<string, any>, context: TaskContext): Promise<TaskResult> {
    // Start nodes are just placeholders that always succeed
    // They don't perform any actual work, just mark the workflow as started
    return {
      success: true,
      output: {
        message: 'Workflow started successfully',
        timestamp: new Date().toISOString(),
        ...input
      }
    };
  }
}
