import type { TaskHandler, TaskContext, TaskResult } from './http-handler';

export class EndTaskHandler implements TaskHandler {
  type = 'end';

  async execute(input: Record<string, any>, context: TaskContext): Promise<TaskResult> {
    // End nodes are just placeholders that always succeed
    // They don't perform any actual work, just mark the workflow as completed
    return {
      success: true,
      output: {
        message: 'Workflow completed successfully',
        timestamp: new Date().toISOString(),
        ...input
      }
    };
  }
}
