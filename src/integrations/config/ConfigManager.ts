/**
 * Configuration Manager
 * 環境変数からの設定読み込み
 */

import type {
  SalesforceConfig,
  LarkConfig,
  SyncConfig,
  WebhookConfig,
} from '../types';
import type { IntegrationConfig } from '../index';
import type { ServerConfig } from '../server';
import { Logger } from '../common';

/**
 * 環境変数名
 */
const ENV_KEYS = {
  // Salesforce
  SF_CLIENT_ID: 'SALESFORCE_CLIENT_ID',
  SF_CLIENT_SECRET: 'SALESFORCE_CLIENT_SECRET',
  SF_INSTANCE_URL: 'SALESFORCE_INSTANCE_URL',
  SF_API_VERSION: 'SALESFORCE_API_VERSION',
  SF_SANDBOX: 'SALESFORCE_SANDBOX',
  SF_REDIRECT_URI: 'SALESFORCE_REDIRECT_URI',

  // Lark
  LARK_APP_ID: 'LARK_APP_ID',
  LARK_APP_SECRET: 'LARK_APP_SECRET',
  LARK_ENCRYPT_KEY: 'LARK_ENCRYPT_KEY',
  LARK_VERIFICATION_TOKEN: 'LARK_VERIFICATION_TOKEN',
  LARK_REDIRECT_URI: 'LARK_REDIRECT_URI',

  // Webhook
  WEBHOOK_NOTIFICATION_CHAT_ID: 'WEBHOOK_NOTIFICATION_CHAT_ID',
  WEBHOOK_SEND_WELCOME: 'WEBHOOK_SEND_WELCOME_MESSAGE',

  // Server
  SERVER_PORT: 'SERVER_PORT',
  SERVER_HOST: 'SERVER_HOST',
  SERVER_BASE_PATH: 'SERVER_BASE_PATH',
  CORS_ORIGINS: 'CORS_ORIGINS',

  // Sync
  SYNC_MODE: 'SYNC_MODE',
  SYNC_BATCH_INTERVAL: 'SYNC_BATCH_INTERVAL',

  // General
  LOG_LEVEL: 'LOG_LEVEL',
  NODE_ENV: 'NODE_ENV',
};

/**
 * Configuration Manager
 */
export class ConfigManager {
  private logger: Logger;
  private env: Record<string, string | undefined>;

  constructor(env?: Record<string, string | undefined>, logger?: Logger) {
    this.env = env || process.env;
    this.logger = (logger || Logger.getInstance()).child('ConfigManager');
  }

  /**
   * 環境変数を取得（必須）
   */
  private getRequired(key: string): string {
    const value = this.env[key];
    if (!value) {
      throw new Error(`Required environment variable not set: ${key}`);
    }
    return value;
  }

  /**
   * 環境変数を取得（オプション）
   */
  private getOptional(key: string, defaultValue?: string): string | undefined {
    return this.env[key] || defaultValue;
  }

  /**
   * Boolean環境変数を取得
   */
  private getBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = this.env[key];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * 数値環境変数を取得
   */
  private getNumber(key: string, defaultValue: number): number {
    const value = this.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Salesforce設定を取得
   */
  getSalesforceConfig(): SalesforceConfig {
    return {
      clientId: this.getRequired(ENV_KEYS.SF_CLIENT_ID),
      clientSecret: this.getRequired(ENV_KEYS.SF_CLIENT_SECRET),
      instanceUrl: this.getRequired(ENV_KEYS.SF_INSTANCE_URL),
      apiVersion: this.getOptional(ENV_KEYS.SF_API_VERSION, '58.0')!,
      sandbox: this.getBoolean(ENV_KEYS.SF_SANDBOX, false),
      redirectUri: this.getOptional(ENV_KEYS.SF_REDIRECT_URI),
    };
  }

  /**
   * Lark設定を取得
   */
  getLarkConfig(): LarkConfig {
    return {
      clientId: this.getRequired(ENV_KEYS.LARK_APP_ID),
      clientSecret: this.getRequired(ENV_KEYS.LARK_APP_SECRET),
      appId: this.getRequired(ENV_KEYS.LARK_APP_ID),
      appSecret: this.getRequired(ENV_KEYS.LARK_APP_SECRET),
      encryptKey: this.getOptional(ENV_KEYS.LARK_ENCRYPT_KEY),
      verificationToken: this.getOptional(ENV_KEYS.LARK_VERIFICATION_TOKEN),
      redirectUri: this.getOptional(ENV_KEYS.LARK_REDIRECT_URI),
    };
  }

  /**
   * Sync設定を取得
   */
  getSyncConfig(): SyncConfig | undefined {
    const mode = this.getOptional(ENV_KEYS.SYNC_MODE) as 'realtime' | 'batch' | undefined;
    if (!mode) return undefined;

    return {
      source: 'salesforce',
      target: 'lark',
      objectMapping: [],
      syncMode: mode,
      batchInterval: this.getNumber(ENV_KEYS.SYNC_BATCH_INTERVAL, 60),
    };
  }

  /**
   * Webhook設定を取得
   */
  getWebhookConfig(): WebhookConfig | undefined {
    const chatId = this.getOptional(ENV_KEYS.WEBHOOK_NOTIFICATION_CHAT_ID);
    if (!chatId) return undefined;

    return {
      notificationChatId: chatId,
      sendWelcomeMessage: this.getBoolean(ENV_KEYS.WEBHOOK_SEND_WELCOME, true),
      enableSalesforceNotifications: true,
      enableLarkCommands: true,
    };
  }

  /**
   * サーバー設定を取得
   */
  getServerConfig(): ServerConfig {
    const corsOriginsStr = this.getOptional(ENV_KEYS.CORS_ORIGINS);
    const corsOrigins = corsOriginsStr ? corsOriginsStr.split(',').map((s) => s.trim()) : undefined;

    return {
      port: this.getNumber(ENV_KEYS.SERVER_PORT, 3000),
      host: this.getOptional(ENV_KEYS.SERVER_HOST, '0.0.0.0'),
      basePath: this.getOptional(ENV_KEYS.SERVER_BASE_PATH, '/api'),
      corsOrigins,
      enableHealthCheck: true,
    };
  }

  /**
   * 統合設定を取得
   */
  getIntegrationConfig(): IntegrationConfig {
    return {
      salesforce: this.getSalesforceConfig(),
      lark: this.getLarkConfig(),
      sync: this.getSyncConfig(),
      webhook: this.getWebhookConfig(),
    };
  }

  /**
   * 設定を検証
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Salesforce必須チェック
    if (!this.env[ENV_KEYS.SF_CLIENT_ID]) {
      errors.push('SALESFORCE_CLIENT_ID is required');
    }
    if (!this.env[ENV_KEYS.SF_CLIENT_SECRET]) {
      errors.push('SALESFORCE_CLIENT_SECRET is required');
    }
    if (!this.env[ENV_KEYS.SF_INSTANCE_URL]) {
      errors.push('SALESFORCE_INSTANCE_URL is required');
    }

    // Lark必須チェック
    if (!this.env[ENV_KEYS.LARK_APP_ID]) {
      errors.push('LARK_APP_ID is required');
    }
    if (!this.env[ENV_KEYS.LARK_APP_SECRET]) {
      errors.push('LARK_APP_SECRET is required');
    }

    // 警告チェック
    if (!this.env[ENV_KEYS.LARK_VERIFICATION_TOKEN]) {
      warnings.push('LARK_VERIFICATION_TOKEN not set - webhook verification disabled');
    }
    if (!this.env[ENV_KEYS.WEBHOOK_NOTIFICATION_CHAT_ID]) {
      warnings.push('WEBHOOK_NOTIFICATION_CHAT_ID not set - notifications disabled');
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger.error('Configuration validation failed', undefined, { errors });
    }
    if (warnings.length > 0) {
      this.logger.warn('Configuration warnings', { warnings });
    }

    return { isValid, errors, warnings };
  }

  /**
   * 現在の環境を取得
   */
  getEnvironment(): 'development' | 'staging' | 'production' {
    const env = this.getOptional(ENV_KEYS.NODE_ENV, 'development');
    if (env === 'production' || env === 'staging') {
      return env;
    }
    return 'development';
  }

  /**
   * デバッグ用設定出力（シークレットはマスク）
   */
  debugPrint(): void {
    const masked = (val: string | undefined) => val ? '***SET***' : '***NOT SET***';

    console.log('=== Configuration ===');
    console.log('Environment:', this.getEnvironment());
    console.log('');
    console.log('Salesforce:');
    console.log(`  Client ID: ${masked(this.env[ENV_KEYS.SF_CLIENT_ID])}`);
    console.log(`  Client Secret: ${masked(this.env[ENV_KEYS.SF_CLIENT_SECRET])}`);
    console.log(`  Instance URL: ${this.env[ENV_KEYS.SF_INSTANCE_URL] || 'NOT SET'}`);
    console.log(`  API Version: ${this.env[ENV_KEYS.SF_API_VERSION] || '58.0 (default)'}`);
    console.log(`  Sandbox: ${this.env[ENV_KEYS.SF_SANDBOX] || 'false (default)'}`);
    console.log('');
    console.log('Lark:');
    console.log(`  App ID: ${masked(this.env[ENV_KEYS.LARK_APP_ID])}`);
    console.log(`  App Secret: ${masked(this.env[ENV_KEYS.LARK_APP_SECRET])}`);
    console.log(`  Encrypt Key: ${masked(this.env[ENV_KEYS.LARK_ENCRYPT_KEY])}`);
    console.log(`  Verification Token: ${masked(this.env[ENV_KEYS.LARK_VERIFICATION_TOKEN])}`);
    console.log('');
    console.log('Server:');
    console.log(`  Port: ${this.env[ENV_KEYS.SERVER_PORT] || '3000 (default)'}`);
    console.log(`  Host: ${this.env[ENV_KEYS.SERVER_HOST] || '0.0.0.0 (default)'}`);
    console.log(`  Base Path: ${this.env[ENV_KEYS.SERVER_BASE_PATH] || '/api (default)'}`);
    console.log('=====================');
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * ConfigManager作成
 */
export function createConfigManager(
  env?: Record<string, string | undefined>,
  logger?: Logger
): ConfigManager {
  return new ConfigManager(env, logger);
}

/**
 * 環境変数から直接設定を取得
 */
export function loadConfigFromEnv(): IntegrationConfig {
  const manager = createConfigManager();
  const validation = manager.validate();

  if (!validation.isValid) {
    throw new Error(`Configuration errors: ${validation.errors.join(', ')}`);
  }

  return manager.getIntegrationConfig();
}
