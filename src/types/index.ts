// Core workflow types
export interface WorkflowNode {
  id: string;
  type: 'http' | 'echo' | 'custom';
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Execution types
export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED' | 'RETRY';
export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED';

export interface Task {
  id: string;
  runId: string;
  workflowId: string;
  nodeId: string;
  status: TaskStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Run {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: RunStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  triggeredBy: string;
}

// API types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Authentication types
export interface AuthToken {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

// Task configuration types
export interface HttpTaskConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryOnStatusCodes?: number[];
  retryOnNetworkErrors?: boolean;
}

export interface EchoTaskConfig {
  message: string;
  level: 'info' | 'warn' | 'error' | 'debug';
}

// Metrics types
export interface WorkflowMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageExecutionTime: number;
  lastRunAt?: Date;
}

export interface TaskMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageTaskTime: number;
  retryRate: number;
}
