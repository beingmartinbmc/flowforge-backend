import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface TaskHandler {
  type: string;
  execute(input: Record<string, any>, context: TaskContext): Promise<TaskResult>;
}

export interface TaskContext {
  taskId: string;
  runId: string;
  workflowId: string;
  nodeId: string;
  retryCount: number;
  maxRetries: number;
}

export interface TaskResult {
  success: boolean;
  output?: Record<string, any>;
  error?: string;
  shouldRetry?: boolean;
  retryDelay?: number;
}

export interface HttpTaskConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryOnStatusCodes?: number[];
  retryOnNetworkErrors?: boolean;
}

export class HttpTaskHandler implements TaskHandler {
  type = 'http';

  async execute(input: Record<string, any>, context: TaskContext): Promise<TaskResult> {
    const config: HttpTaskConfig = input.config || input;
    
    try {
      const axiosConfig: AxiosRequestConfig = {
        method: config.method,
        url: config.url,
        headers: config.headers || {},
        data: config.body,
        timeout: config.timeout || 30000,
      };

      const response: AxiosResponse = await axios(axiosConfig);

      return {
        success: true,
        output: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
        },
      };
    } catch (error: any) {
      const shouldRetry = this.shouldRetry(error, config, context);
      const retryDelay = shouldRetry ? this.calculateRetryDelay(context.retryCount) : undefined;

      return {
        success: false,
        error: error.message || 'HTTP request failed',
        shouldRetry,
        retryDelay,
      };
    }
  }

  private shouldRetry(error: any, config: HttpTaskConfig, context: TaskContext): boolean {
    if (context.retryCount >= context.maxRetries) {
      return false;
    }

    // Retry on network errors
    if (config.retryOnNetworkErrors && !error.response) {
      return true;
    }

    // Retry on specific status codes
    if (error.response && config.retryOnStatusCodes) {
      return config.retryOnStatusCodes.includes(error.response.status);
    }

    // Default retry on 5xx errors
    if (error.response && error.response.status >= 500) {
      return true;
    }

    return false;
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, retryCount), 30000);
  }
}
