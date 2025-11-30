/**
 * Express Server for Webhook Endpoints
 * Lark/Salesforce Webhook受信サーバー
 */

import type { IntegrationConfig } from '../index';
import { SalesforceLarkIntegration, createIntegration } from '../index';
import { Logger } from '../common';

export interface ServerConfig {
  port: number;
  host?: string;
  basePath?: string;
  corsOrigins?: string[];
  enableHealthCheck?: boolean;
}

export interface WebhookRequest {
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
}

export interface WebhookResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/**
 * Webhook Server (Framework-agnostic)
 */
export class WebhookServer {
  private integration: SalesforceLarkIntegration;
  private logger: Logger;
  private config: ServerConfig;

  constructor(
    integrationConfig: IntegrationConfig,
    serverConfig: ServerConfig,
    logger?: Logger
  ) {
    this.integration = createIntegration(integrationConfig, logger);
    this.config = serverConfig;
    this.logger = (logger || Logger.getInstance()).child('WebhookServer');
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    await this.integration.connect();
    this.logger.info('Webhook server initialized', { port: this.config.port });
  }

  /**
   * Lark Webhook処理
   */
  async handleLarkWebhook(request: WebhookRequest): Promise<WebhookResponse> {
    const startTime = Date.now();
    this.logger.debug('Lark webhook received', { headers: request.headers });

    try {
      const payload = request.body as Record<string, unknown>;

      // Challenge検証
      if (payload.challenge) {
        this.logger.info('Lark webhook challenge');
        return {
          status: 200,
          body: { challenge: payload.challenge },
        };
      }

      // イベント処理
      const result = await this.integration.handleLarkWebhook(payload);

      this.logger.info('Lark webhook processed', { latency: Date.now() - startTime });

      return {
        status: 200,
        body: result,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Lark webhook error', err);

      return {
        status: 500,
        body: { error: err.message },
      };
    }
  }

  /**
   * Salesforce Webhook処理
   */
  async handleSalesforceWebhook(request: WebhookRequest): Promise<WebhookResponse> {
    const startTime = Date.now();
    this.logger.debug('Salesforce webhook received');

    try {
      const payload = request.body as Record<string, unknown>;
      await this.integration.handleSalesforceWebhook(payload);

      this.logger.info('Salesforce webhook processed', { latency: Date.now() - startTime });

      return {
        status: 200,
        body: { success: true },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Salesforce webhook error', err);

      return {
        status: 500,
        body: { error: err.message },
      };
    }
  }

  /**
   * ヘルスチェック
   */
  async handleHealthCheck(): Promise<WebhookResponse> {
    return {
      status: 200,
      body: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Readiness チェック
   */
  async handleReadinessCheck(): Promise<WebhookResponse> {
    // TODO: 実際の接続チェック
    return {
      status: 200,
      body: {
        status: 'ready',
        salesforce: 'connected',
        lark: 'connected',
      },
    };
  }

  /**
   * 統合インスタンスを取得
   */
  getIntegration(): SalesforceLarkIntegration {
    return this.integration;
  }

  /**
   * ルート定義を取得（Express等で使用）
   */
  getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || '';

    return [
      {
        method: 'POST',
        path: `${basePath}/webhooks/lark`,
        handler: this.handleLarkWebhook.bind(this),
      },
      {
        method: 'POST',
        path: `${basePath}/webhooks/salesforce`,
        handler: this.handleSalesforceWebhook.bind(this),
      },
      {
        method: 'GET',
        path: `${basePath}/health`,
        handler: this.handleHealthCheck.bind(this),
      },
      {
        method: 'GET',
        path: `${basePath}/ready`,
        handler: this.handleReadinessCheck.bind(this),
      },
    ];
  }
}

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (request: WebhookRequest) => Promise<WebhookResponse>;
}

/**
 * サーバー作成
 */
export function createWebhookServer(
  integrationConfig: IntegrationConfig,
  serverConfig: ServerConfig,
  logger?: Logger
): WebhookServer {
  return new WebhookServer(integrationConfig, serverConfig, logger);
}
