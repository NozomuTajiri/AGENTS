/**
 * Webhook Handler
 * Lark/Salesforce Webhookイベント処理
 */

import type {
  LarkWebhookEvent,
  SalesforceWebhookEvent,
  WebhookConfig,
} from '../types';
import { SalesforceMCPClient } from '../salesforce';
import { LarkApiClient } from '../lark';
import { Logger } from '../common';

export type WebhookEventHandler<T> = (event: T) => Promise<void>;

/**
 * Webhookハンドラー
 */
export class WebhookHandler {
  private sfClient: SalesforceMCPClient;
  private larkClient: LarkApiClient;
  private logger: Logger;
  private config: WebhookConfig;

  private larkHandlers: Map<string, WebhookEventHandler<LarkWebhookEvent>> = new Map();
  private sfHandlers: Map<string, WebhookEventHandler<SalesforceWebhookEvent>> = new Map();

  constructor(
    sfClient: SalesforceMCPClient,
    larkClient: LarkApiClient,
    config: WebhookConfig,
    logger?: Logger
  ) {
    this.sfClient = sfClient;
    this.larkClient = larkClient;
    this.config = config;
    this.logger = (logger || Logger.getInstance()).child('WebhookHandler');

    this.registerDefaultHandlers();
  }

  /**
   * デフォルトハンドラーを登録
   */
  private registerDefaultHandlers(): void {
    // Larkイベントハンドラー
    this.registerLarkHandler('im.message.receive_v1', async (event) => {
      await this.handleLarkMessage(event);
    });

    this.registerLarkHandler('im.chat.member.user.added_v1', async (event) => {
      await this.handleLarkChatMemberAdded(event);
    });

    // Salesforceイベントハンドラー
    this.registerSalesforceHandler('Account', async (event) => {
      await this.handleSalesforceAccountChange(event);
    });

    this.registerSalesforceHandler('Opportunity', async (event) => {
      await this.handleSalesforceOpportunityChange(event);
    });
  }

  /**
   * Larkハンドラーを登録
   */
  registerLarkHandler(eventType: string, handler: WebhookEventHandler<LarkWebhookEvent>): void {
    this.larkHandlers.set(eventType, handler);
    this.logger.info(`Registered Lark handler for: ${eventType}`);
  }

  /**
   * Salesforceハンドラーを登録
   */
  registerSalesforceHandler(objectType: string, handler: WebhookEventHandler<SalesforceWebhookEvent>): void {
    this.sfHandlers.set(objectType, handler);
    this.logger.info(`Registered Salesforce handler for: ${objectType}`);
  }

  /**
   * Lark Webhookを処理
   */
  async handleLarkWebhook(payload: Record<string, unknown>): Promise<{ challenge?: string }> {
    // URL検証チャレンジ
    if (payload.challenge) {
      this.logger.info('Lark webhook challenge received');
      return this.larkClient.handleChallenge(payload.challenge as string);
    }

    // イベント処理
    const header = payload.header as Record<string, unknown> | undefined;
    const eventType = header?.event_type as string;

    if (!eventType) {
      this.logger.warn('Unknown Lark webhook event', { payload });
      return {};
    }

    const event: LarkWebhookEvent = {
      type: eventType,
      timestamp: new Date((header?.create_time as number) || Date.now()),
      payload,
    };

    const handler = this.larkHandlers.get(eventType);
    if (handler) {
      try {
        await handler(event);
        this.logger.info(`Processed Lark event: ${eventType}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Failed to process Lark event: ${eventType}`, err);
      }
    } else {
      this.logger.debug(`No handler for Lark event: ${eventType}`);
    }

    return {};
  }

  /**
   * Salesforce Webhookを処理
   */
  async handleSalesforceWebhook(payload: Record<string, unknown>): Promise<void> {
    const objectType = payload.sobject_type as string || payload.objectType as string;
    const changeType = payload.change_type as string || payload.changeType as string;

    if (!objectType) {
      this.logger.warn('Unknown Salesforce webhook event', { payload });
      return;
    }

    const event: SalesforceWebhookEvent = {
      objectType,
      changeType: changeType as 'created' | 'updated' | 'deleted',
      recordId: (payload.record_id as string) || (payload.recordId as string) || '',
      timestamp: new Date(),
      payload,
    };

    const handler = this.sfHandlers.get(objectType);
    if (handler) {
      try {
        await handler(event);
        this.logger.info(`Processed Salesforce event: ${objectType}/${changeType}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Failed to process Salesforce event: ${objectType}`, err);
      }
    } else {
      this.logger.debug(`No handler for Salesforce object: ${objectType}`);
    }
  }

  /**
   * Larkメッセージを処理
   */
  private async handleLarkMessage(event: LarkWebhookEvent): Promise<void> {
    const eventData = event.payload.event as Record<string, unknown> | undefined;
    const message = eventData?.message as Record<string, unknown> | undefined;

    if (!message) return;

    const chatId = message.chat_id as string;
    const content = message.content as string;
    const messageType = message.message_type as string;

    this.logger.info('Received Lark message', { chatId, messageType });

    // テキストメッセージの場合、コマンド処理
    if (messageType === 'text' && content) {
      try {
        const parsed = JSON.parse(content);
        const text = parsed.text as string;

        if (text.startsWith('/sf ')) {
          await this.handleLarkSalesforceCommand(chatId, text.substring(4));
        }
      } catch {
        // JSONパース失敗は無視
      }
    }
  }

  /**
   * Larkチャットメンバー追加を処理
   */
  private async handleLarkChatMemberAdded(event: LarkWebhookEvent): Promise<void> {
    const eventData = event.payload.event as Record<string, unknown> | undefined;
    const chatId = eventData?.chat_id as string;
    const users = eventData?.users as Array<{ user_id: string }> | undefined;

    if (!chatId || !users) return;

    this.logger.info('New members added to Lark chat', { chatId, userCount: users.length });

    // ウェルカムメッセージ送信
    if (this.config.sendWelcomeMessage) {
      await this.larkClient.sendTextMessage(
        chatId,
        'Welcome! This chat is connected to Salesforce. Use /sf help for available commands.'
      );
    }
  }

  /**
   * Salesforce Accountの変更を処理
   */
  private async handleSalesforceAccountChange(event: SalesforceWebhookEvent): Promise<void> {
    const { changeType, recordId } = event;

    if (!this.config.notificationChatId) return;

    // Accountの詳細を取得
    const result = await this.sfClient.getAccount(recordId);
    if (!result.success || !result.data) return;

    const account = result.data;
    const message = `[Salesforce] Account ${changeType}: ${account.Name}\nType: ${account.Type || 'N/A'}\nIndustry: ${account.Industry || 'N/A'}`;

    await this.larkClient.sendTextMessage(this.config.notificationChatId, message);
  }

  /**
   * Salesforce Opportunityの変更を処理
   */
  private async handleSalesforceOpportunityChange(event: SalesforceWebhookEvent): Promise<void> {
    const { changeType, recordId } = event;

    if (!this.config.notificationChatId) return;

    // Opportunityの詳細を取得
    const result = await this.sfClient.getOpportunity(recordId);
    if (!result.success || !result.data) return;

    const opp = result.data;
    const amount = opp.Amount ? `$${opp.Amount.toLocaleString()}` : 'N/A';
    const message = `[Salesforce] Opportunity ${changeType}: ${opp.Name}\nStage: ${opp.StageName}\nAmount: ${amount}\nClose Date: ${opp.CloseDate}`;

    await this.larkClient.sendTextMessage(this.config.notificationChatId, message);
  }

  /**
   * LarkからのSalesforceコマンドを処理
   */
  private async handleLarkSalesforceCommand(chatId: string, command: string): Promise<void> {
    const parts = command.trim().split(' ');
    const action = parts[0].toLowerCase();

    try {
      switch (action) {
        case 'help':
          await this.sendSalesforceHelp(chatId);
          break;
        case 'accounts':
          await this.listSalesforceAccounts(chatId);
          break;
        case 'opps':
        case 'opportunities':
          await this.listSalesforceOpportunities(chatId);
          break;
        case 'search':
          await this.searchSalesforce(chatId, parts.slice(1).join(' '));
          break;
        default:
          await this.larkClient.sendTextMessage(chatId, `Unknown command: ${action}. Use /sf help for available commands.`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.larkClient.sendTextMessage(chatId, `Error: ${err.message}`);
    }
  }

  /**
   * Salesforceヘルプを送信
   */
  private async sendSalesforceHelp(chatId: string): Promise<void> {
    const help = `Salesforce Commands:
/sf help - Show this help
/sf accounts - List recent accounts
/sf opps - List recent opportunities
/sf search <query> - Search records`;

    await this.larkClient.sendTextMessage(chatId, help);
  }

  /**
   * Salesforce Accountsを一覧
   */
  private async listSalesforceAccounts(chatId: string): Promise<void> {
    const result = await this.sfClient.queryAccounts();
    if (!result.success || !result.data) {
      await this.larkClient.sendTextMessage(chatId, 'Failed to fetch accounts');
      return;
    }

    const accounts = result.data.records.slice(0, 10);
    const lines = accounts.map((a) => `• ${a.Name} (${a.Type || 'N/A'})`);
    const message = `Recent Accounts:\n${lines.join('\n')}`;

    await this.larkClient.sendTextMessage(chatId, message);
  }

  /**
   * Salesforce Opportunitiesを一覧
   */
  private async listSalesforceOpportunities(chatId: string): Promise<void> {
    const result = await this.sfClient.queryOpportunities();
    if (!result.success || !result.data) {
      await this.larkClient.sendTextMessage(chatId, 'Failed to fetch opportunities');
      return;
    }

    const opps = result.data.records.slice(0, 10);
    const lines = opps.map((o) => {
      const amount = o.Amount ? `$${o.Amount.toLocaleString()}` : 'N/A';
      return `• ${o.Name} - ${o.StageName} (${amount})`;
    });
    const message = `Recent Opportunities:\n${lines.join('\n')}`;

    await this.larkClient.sendTextMessage(chatId, message);
  }

  /**
   * Salesforceを検索
   */
  private async searchSalesforce(chatId: string, query: string): Promise<void> {
    if (!query) {
      await this.larkClient.sendTextMessage(chatId, 'Please provide a search query');
      return;
    }

    // Accountsを検索
    const condition = `Name LIKE '%${query}%'`;
    const result = await this.sfClient.queryAccounts(condition);

    if (!result.success || !result.data) {
      await this.larkClient.sendTextMessage(chatId, 'Search failed');
      return;
    }

    const accounts = result.data.records.slice(0, 5);
    if (accounts.length === 0) {
      await this.larkClient.sendTextMessage(chatId, `No results found for: ${query}`);
      return;
    }

    const lines = accounts.map((a) => `• ${a.Name} (${a.Type || 'N/A'})`);
    const message = `Search Results for "${query}":\n${lines.join('\n')}`;

    await this.larkClient.sendTextMessage(chatId, message);
  }
}

/**
 * Webhookハンドラーを作成
 */
export function createWebhookHandler(
  sfClient: SalesforceMCPClient,
  larkClient: LarkApiClient,
  config: WebhookConfig,
  logger?: Logger
): WebhookHandler {
  return new WebhookHandler(sfClient, larkClient, config, logger);
}
