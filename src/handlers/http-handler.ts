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
      // Validate URL
      if (!config.url) {
        return {
          success: false,
          error: 'URL is required for HTTP tasks',
        };
      }

      // Clean and validate URL
      const cleanedUrl = this.cleanUrl(config.url);
      if (!this.isValidUrl(cleanedUrl)) {
        return {
          success: false,
          error: `Invalid URL: ${config.url}`,
        };
      }

      const axiosConfig: AxiosRequestConfig = {
        method: config.method || 'GET',
        url: cleanedUrl,
        headers: config.headers || {},
        data: config.body,
        timeout: config.timeout || 30000,
      };

      console.log(`Making HTTP request: ${config.method} ${cleanedUrl}`);
      const response: AxiosResponse = await axios(axiosConfig);

      // Create a log message with the API response data
      const logMessage = `HTTP ${config.method} ${cleanedUrl} - Status: ${response.status} ${response.statusText}\nResponse Data: ${JSON.stringify(response.data, null, 2)}`;

      return {
        success: true,
        output: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          logMessage: logMessage,
        },
      };
    } catch (error: any) {
      console.error(`HTTP request failed:`, error.message);
      
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

  private cleanUrl(url: string): string {
    // Remove any leading/trailing whitespace
    let cleaned = url.trim();
    
    // Remove any leading @ symbol if present
    if (cleaned.startsWith('@')) {
      cleaned = cleaned.substring(1);
    }
    
    // Ensure URL has protocol
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = `https://${cleaned}`;
    }
    
    return cleaned;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
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
