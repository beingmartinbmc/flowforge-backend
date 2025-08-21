import { HttpTaskHandler } from './http-handler';
import { EchoTaskHandler } from './echo-handler';
import type { TaskHandler } from './http-handler';

class TaskHandlerRegistry {
  private handlers: Map<string, TaskHandler> = new Map();

  constructor() {
    // Register default handlers
    this.register(new HttpTaskHandler());
    this.register(new EchoTaskHandler());
  }

  register(handler: TaskHandler): void {
    this.handlers.set(handler.type, handler);
  }

  get(type: string): TaskHandler | undefined {
    return this.handlers.get(type);
  }

  getAll(): TaskHandler[] {
    return Array.from(this.handlers.values());
  }

  getSupportedTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

export const taskHandlerRegistry = new TaskHandlerRegistry();
export default taskHandlerRegistry;
