/**
 * Lark Bot Handler
 * Botコマンドとインタラクション処理
 */

import type {
  LarkBotCommand,
  LarkBotCommandParams,
  LarkMessageContent,
  LarkInteractiveCard,
} from '../../types';
import { LarkApiClient } from '../api/LarkApiClient';
import { Logger } from '../../common';

export interface BotConfig {
  prefix: string;
  helpCommand: string;
  unknownCommandMessage: string;
}

const DEFAULT_CONFIG: BotConfig = {
  prefix: '/',
  helpCommand: 'help',
  unknownCommandMessage: 'Unknown command. Use /help to see available commands.',
};

/**
 * Lark Bot Handler
 */
export class LarkBotHandler {
  private client: LarkApiClient;
  private logger: Logger;
  private config: BotConfig;
  private commands: Map<string, LarkBotCommand> = new Map();
  private cardActionHandlers: Map<string, (value: Record<string, unknown>, userId: string) => Promise<void>> = new Map();

  constructor(client: LarkApiClient, config?: Partial<BotConfig>, logger?: Logger) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = (logger || Logger.getInstance()).child('LarkBotHandler');

    this.registerDefaultCommands();
  }

  /**
   * デフォルトコマンドを登録
   */
  private registerDefaultCommands(): void {
    this.registerCommand({
      command: 'help',
      description: 'Show available commands',
      handler: async () => this.buildHelpResponse(),
    });

    this.registerCommand({
      command: 'ping',
      description: 'Check bot status',
      handler: async () => ({ text: 'Pong! 🏓 Bot is running.' }),
    });
  }

  /**
   * コマンドを登録
   */
  registerCommand(command: LarkBotCommand): void {
    this.commands.set(command.command.toLowerCase(), command);
    this.logger.info(`Command registered: ${command.command}`);
  }

  /**
   * コマンドを削除
   */
  unregisterCommand(command: string): void {
    this.commands.delete(command.toLowerCase());
    this.logger.info(`Command unregistered: ${command}`);
  }

  /**
   * カードアクションハンドラーを登録
   */
  registerCardAction(action: string, handler: (value: Record<string, unknown>, userId: string) => Promise<void>): void {
    this.cardActionHandlers.set(action, handler);
    this.logger.info(`Card action handler registered: ${action}`);
  }

  /**
   * メッセージを処理
   */
  async handleMessage(
    chatId: string,
    userId: string,
    messageId: string,
    content: string
  ): Promise<void> {
    // JSONコンテンツをパース
    let text: string;
    try {
      const parsed = JSON.parse(content);
      text = parsed.text || '';
    } catch {
      text = content;
    }

    // コマンドかチェック
    if (!text.startsWith(this.config.prefix)) {
      return;
    }

    const commandText = text.substring(this.config.prefix.length).trim();
    const [commandName, ...args] = commandText.split(/\s+/);

    const command = this.commands.get(commandName.toLowerCase());

    if (!command) {
      await this.client.sendTextMessage(chatId, this.config.unknownCommandMessage);
      return;
    }

    const params: LarkBotCommandParams = {
      userId,
      chatId,
      command: commandName,
      args,
      messageId,
    };

    try {
      this.logger.info(`Executing command: ${commandName}`, { userId, chatId, args });
      const response = await command.handler(params);
      await this.sendResponse(chatId, response);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Command execution failed: ${commandName}`, err);
      await this.client.sendTextMessage(chatId, `Error: ${err.message}`);
    }
  }

  /**
   * カードアクションを処理
   */
  async handleCardAction(
    action: string,
    value: Record<string, unknown>,
    userId: string,
    chatId?: string
  ): Promise<{ toast?: { type: string; content: string } }> {
    const handler = this.cardActionHandlers.get(action);

    if (!handler) {
      this.logger.warn(`No handler for card action: ${action}`);
      return { toast: { type: 'info', content: 'Action not supported' } };
    }

    try {
      await handler(value, userId);
      return { toast: { type: 'success', content: 'Action completed' } };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Card action failed: ${action}`, err);
      return { toast: { type: 'error', content: err.message } };
    }
  }

  /**
   * ヘルプレスポンスを構築
   */
  private buildHelpResponse(): LarkMessageContent {
    const lines = ['**Available Commands:**', ''];

    for (const [name, cmd] of this.commands) {
      lines.push(`• \`${this.config.prefix}${name}\` - ${cmd.description}`);
    }

    return { text: lines.join('\n') };
  }

  /**
   * レスポンスを送信
   */
  private async sendResponse(chatId: string, content: LarkMessageContent): Promise<void> {
    if (content.text) {
      await this.client.sendTextMessage(chatId, content.text);
    } else if (content.interactive) {
      await this.client.sendInteractiveCard(chatId, content.interactive);
    } else if (content.post) {
      await this.client.sendPostMessage(
        chatId,
        content.post.title,
        content.post.content.map((row) =>
          row.map((el) => ({
            tag: el.tag,
            text: el.text,
            href: el.href,
            user_id: el.userId,
          }))
        )
      );
    }
  }

  /**
   * カードビルダー - シンプルなカード作成
   */
  buildSimpleCard(
    title: string,
    content: string,
    color: 'blue' | 'green' | 'red' | 'orange' | 'purple' = 'blue'
  ): LarkInteractiveCard {
    return {
      config: { wideScreenMode: true },
      header: {
        title: { tag: 'plain_text', content: title },
        template: color,
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content },
        },
      ],
    };
  }

  /**
   * カードビルダー - ボタン付きカード作成
   */
  buildCardWithButtons(
    title: string,
    content: string,
    buttons: Array<{ text: string; action: string; value?: Record<string, unknown>; type?: 'default' | 'primary' | 'danger' }>,
    color: 'blue' | 'green' | 'red' | 'orange' | 'purple' = 'blue'
  ): LarkInteractiveCard {
    return {
      config: { wideScreenMode: true },
      header: {
        title: { tag: 'plain_text', content: title },
        template: color,
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content },
        },
        {
          tag: 'action',
          actions: buttons.map((btn) => ({
            tag: 'button' as const,
            text: { tag: 'plain_text' as const, content: btn.text },
            type: btn.type || 'default',
            value: { action: btn.action, ...btn.value },
          })),
        },
      ],
    };
  }

  /**
   * 登録済みコマンド一覧を取得
   */
  getCommands(): LarkBotCommand[] {
    return Array.from(this.commands.values());
  }
}

export function createLarkBotHandler(
  client: LarkApiClient,
  config?: Partial<BotConfig>,
  logger?: Logger
): LarkBotHandler {
  return new LarkBotHandler(client, config, logger);
}
