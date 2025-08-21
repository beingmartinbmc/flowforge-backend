import type { TaskHandler, TaskContext, TaskResult } from './http-handler';

export interface EchoTaskConfig {
  message: string;
  level: 'info' | 'warn' | 'error' | 'debug';
}

export class EchoTaskHandler implements TaskHandler {
  type = 'echo';

  async execute(input: Record<string, any>, context: TaskContext): Promise<TaskResult> {
    const config: EchoTaskConfig = input.config || input;
    
    const message = config.message || 'Echo task executed';
    const level = config.level || 'info';

    // Log the message based on level
    switch (level) {
      case 'info':
        console.log(`[INFO] ${message}`);
        break;
      case 'warn':
        console.warn(`[WARN] ${message}`);
        break;
      case 'error':
        console.error(`[ERROR] ${message}`);
        break;
      case 'debug':
        console.debug(`[DEBUG] ${message}`);
        break;
    }

    return {
      success: true,
      output: {
        message,
        level,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
