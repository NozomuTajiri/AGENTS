/**
 * ロギングシステム
 * 構造化ログとエラートラッキング
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
  traceId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  context?: string;
  enableConsole?: boolean;
  enableStructured?: boolean;
  traceId?: string;
}

/**
 * 構造化ロガー
 */
export class Logger {
  private config: LoggerConfig;
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private readonly maxLogs = 10000;

  private static readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || 'info',
      context: config.context,
      enableConsole: config.enableConsole ?? true,
      enableStructured: config.enableStructured ?? true,
      traceId: config.traceId,
    };
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * 子ロガーを作成（コンテキスト付き）
   */
  child(context: string, traceId?: string): Logger {
    const childLogger = new Logger({
      ...this.config,
      context: this.config.context ? `${this.config.context}:${context}` : context,
      traceId: traceId || this.config.traceId,
    });
    return childLogger;
  }

  /**
   * トレースIDを設定
   */
  setTraceId(traceId: string): void {
    this.config.traceId = traceId;
  }

  /**
   * ログレベルを設定
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * ログを記録
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    if (Logger.levelPriority[level] < Logger.levelPriority[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.config.context,
      metadata,
      error,
      traceId: this.config.traceId,
    };

    // ログを保存
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // コンソール出力
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }
  }

  /**
   * コンソールに出力
   */
  private writeToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const context = entry.context ? `[${entry.context}]` : '';
    const traceId = entry.traceId ? `[${entry.traceId}]` : '';
    const prefix = `${timestamp} ${entry.level.toUpperCase()} ${context}${traceId}`;

    if (this.config.enableStructured) {
      // 構造化ログ（JSON）
      const structured = {
        ...entry,
        timestamp: timestamp,
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        } : undefined,
      };
      console.log(JSON.stringify(structured));
    } else {
      // 人間が読みやすい形式
      const metaStr = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
      const errorStr = entry.error ? ` Error: ${entry.error.message}` : '';

      switch (entry.level) {
        case 'debug':
          console.debug(`${prefix} ${entry.message}${metaStr}${errorStr}`);
          break;
        case 'info':
          console.info(`${prefix} ${entry.message}${metaStr}${errorStr}`);
          break;
        case 'warn':
          console.warn(`${prefix} ${entry.message}${metaStr}${errorStr}`);
          break;
        case 'error':
          console.error(`${prefix} ${entry.message}${metaStr}${errorStr}`);
          if (entry.error?.stack) {
            console.error(entry.error.stack);
          }
          break;
      }
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata, error);
  }

  /**
   * ログ履歴を取得
   */
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filtered = this.logs;

    if (level) {
      filtered = filtered.filter((l) => l.level === level);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * ログをクリア
   */
  clearLogs(): void {
    this.logs = [];
  }
}

/**
 * リトライ機能付きエラーハンドラー
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  logger?: Logger
): Promise<T> {
  const log = logger || Logger.getInstance();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // リトライ可能なエラーかチェック
      if (config.retryableErrors && config.retryableErrors.length > 0) {
        const isRetryable = config.retryableErrors.some(
          (code) => lastError?.message.includes(code) || lastError?.name === code
        );
        if (!isRetryable) {
          throw lastError;
        }
      }

      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );
        log.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`, {
          error: lastError.message,
          attempt: attempt + 1,
        });
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * デッドレターキュー（失敗した処理を保存）
 */
export interface DeadLetterItem<T> {
  id: string;
  payload: T;
  error: string;
  timestamp: Date;
  retryCount: number;
  source: string;
}

export class DeadLetterQueue<T> {
  private queue: DeadLetterItem<T>[] = [];
  private readonly maxSize: number;
  private logger: Logger;

  constructor(maxSize: number = 1000, logger?: Logger) {
    this.maxSize = maxSize;
    this.logger = logger || Logger.getInstance().child('DeadLetterQueue');
  }

  /**
   * アイテムを追加
   */
  add(payload: T, error: Error, source: string, retryCount: number = 0): string {
    const id = `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const item: DeadLetterItem<T> = {
      id,
      payload,
      error: error.message,
      timestamp: new Date(),
      retryCount,
      source,
    };

    this.queue.push(item);
    this.logger.warn('Added item to dead letter queue', { id, source, error: error.message });

    // サイズ制限
    if (this.queue.length > this.maxSize) {
      const removed = this.queue.shift();
      this.logger.warn('Removed oldest item from dead letter queue due to size limit', {
        removedId: removed?.id,
      });
    }

    return id;
  }

  /**
   * アイテムを取得
   */
  get(id: string): DeadLetterItem<T> | undefined {
    return this.queue.find((item) => item.id === id);
  }

  /**
   * 全アイテムを取得
   */
  getAll(): DeadLetterItem<T>[] {
    return [...this.queue];
  }

  /**
   * アイテムを削除
   */
  remove(id: string): boolean {
    const index = this.queue.findIndex((item) => item.id === id);
    if (index > -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * キューをクリア
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * キューサイズを取得
   */
  size(): number {
    return this.queue.length;
  }
}

// デフォルトロガーインスタンス
export const logger = Logger.getInstance({
  level: 'info',
  enableConsole: true,
  enableStructured: false,
});
