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

    // Create a comprehensive log message that includes both config and input data
    let logMessage = `[${level.toUpperCase()}] ${message}`;
    
    // If there's input data from previous tasks, include it
    if (Object.keys(input).length > 0 && !input.config) {
      logMessage += `\nData from previous task: ${JSON.stringify(input, null, 2)}`;
    }

    // Log the message based on level
    switch (level) {
      case 'info':
        console.log(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
    }

    return {
      success: true,
      output: {
        message,
        level: level.toUpperCase(),
        timestamp: new Date().toISOString(),
        inputData: Object.keys(input).length > 0 && !input.config ? input : undefined,
        logMessage: logMessage, // Include the formatted log message for UI display
      },
    };
  }
}
