/**
 * Salesforce ↔ Lark Integration Module
 *
 * SalesforceとLark間のデータ同期・Webhook処理を提供
 */

// Types
export type {
  // Auth types
  AuthConfig,
  OAuthToken,
  SalesforceConfig,
  LarkConfig,

  // Salesforce types
  SalesforceObject,
  Account,
  Opportunity,
  Task,
  Case,
  SalesforceQueryResult,

  // Lark types
  LarkUser,
  LarkMessage,
  LarkMessageContent,
  LarkChat,
  LarkCalendarEvent,
  LarkInteractiveCard,

  // Webhook types
  LarkWebhookEvent,
  SalesforceWebhookEvent,
  WebhookConfig,

  // Sync types
  SyncConfig,
  SyncDirection,
  SyncJob,
  SyncResult,
  ObjectMapping,
  FieldMapping,
  ConflictResolution,

  // API types
  ApiResponse,
  ApiError,
  ApiMetadata,
} from './types';

// Common utilities
export {
  OAuthManager,
  SalesforceOAuthManager,
  LarkOAuthManager,
  createOAuthManager,
  Logger,
  logger,
  withRetry,
  DeadLetterQueue,
} from './common';

export type {
  LogLevel,
  LogEntry,
  LoggerConfig,
  RetryConfig,
  DeadLetterItem,
} from './common';

// Salesforce client
export {
  SalesforceRestClient,
  SalesforceMCPClient,
  createSalesforceClient,
} from './salesforce';

// Lark client
export {
  LarkApiClient,
  createLarkClient,
} from './lark';

// Engine
export {
  SyncEngine,
  createSyncEngine,
  WebhookHandler,
  createWebhookHandler,
} from './engine';

export type { WebhookEventHandler } from './engine';

// Main integration class
import type {
  SalesforceConfig,
  LarkConfig,
  SyncConfig,
  WebhookConfig,
  ObjectMapping,
  SyncJob,
} from './types';
import { SalesforceMCPClient, createSalesforceClient } from './salesforce';
import { LarkApiClient, createLarkClient } from './lark';
import { SyncEngine, createSyncEngine, WebhookHandler, createWebhookHandler } from './engine';
import { Logger } from './common';

/**
 * 統合設定
 */
export interface IntegrationConfig {
  salesforce: SalesforceConfig;
  lark: LarkConfig;
  sync?: SyncConfig;
  webhook?: WebhookConfig;
}

/**
 * Salesforce-Lark統合クライアント
 */
export class SalesforceLarkIntegration {
  private sfClient: SalesforceMCPClient;
  private larkClient: LarkApiClient;
  private syncEngine: SyncEngine | null = null;
  private webhookHandler: WebhookHandler | null = null;
  private logger: Logger;

  constructor(config: IntegrationConfig, logger?: Logger) {
    this.logger = (logger || Logger.getInstance()).child('SalesforceLarkIntegration');

    // クライアント初期化
    this.sfClient = createSalesforceClient(config.salesforce, this.logger);
    this.larkClient = createLarkClient(config.lark, this.logger);

    // 同期エンジン初期化
    if (config.sync) {
      this.syncEngine = createSyncEngine(
        this.sfClient,
        this.larkClient,
        config.sync,
        this.logger
      );
    }

    // Webhookハンドラー初期化
    if (config.webhook) {
      this.webhookHandler = createWebhookHandler(
        this.sfClient,
        this.larkClient,
        config.webhook,
        this.logger
      );
    }

    this.logger.info('SalesforceLarkIntegration initialized');
  }

  /**
   * 接続を初期化
   */
  async connect(): Promise<void> {
    await this.sfClient.connect();
    this.logger.info('Connected to Salesforce and Lark');
  }

  /**
   * Salesforceクライアントを取得
   */
  getSalesforce(): SalesforceMCPClient {
    return this.sfClient;
  }

  /**
   * Larkクライアントを取得
   */
  getLark(): LarkApiClient {
    return this.larkClient;
  }

  /**
   * 同期エンジンを取得
   */
  getSyncEngine(): SyncEngine | null {
    return this.syncEngine;
  }

  /**
   * Webhookハンドラーを取得
   */
  getWebhookHandler(): WebhookHandler | null {
    return this.webhookHandler;
  }

  /**
   * 同期を開始
   */
  async startSync(mapping: ObjectMapping): Promise<SyncJob | null> {
    if (!this.syncEngine) {
      this.logger.warn('Sync engine not configured');
      return null;
    }
    return this.syncEngine.startSync(mapping);
  }

  /**
   * Lark Webhookを処理
   */
  async handleLarkWebhook(payload: Record<string, unknown>): Promise<{ challenge?: string }> {
    if (!this.webhookHandler) {
      this.logger.warn('Webhook handler not configured');
      return {};
    }
    return this.webhookHandler.handleLarkWebhook(payload);
  }

  /**
   * Salesforce Webhookを処理
   */
  async handleSalesforceWebhook(payload: Record<string, unknown>): Promise<void> {
    if (!this.webhookHandler) {
      this.logger.warn('Webhook handler not configured');
      return;
    }
    return this.webhookHandler.handleSalesforceWebhook(payload);
  }

  /**
   * Larkにメッセージを送信
   */
  async sendLarkMessage(chatId: string, message: string): Promise<void> {
    await this.larkClient.sendTextMessage(chatId, message);
  }

  /**
   * Salesforceレコードを取得
   */
  async getSalesforceRecord(objectType: string, id: string): Promise<unknown> {
    const rest = this.sfClient.getRest();
    const result = await rest.getRecord(objectType, id);
    return result.success ? result.data : null;
  }
}

/**
 * 統合クライアントを作成
 */
export function createIntegration(
  config: IntegrationConfig,
  logger?: Logger
): SalesforceLarkIntegration {
  return new SalesforceLarkIntegration(config, logger);
}
