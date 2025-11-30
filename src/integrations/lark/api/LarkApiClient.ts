/**
 * Lark API Client
 * Lark Open Platform REST API 連携
 */

import type {
  LarkConfig,
  LarkUser,
  LarkMessage,
  LarkMessageContent,
  LarkChat,
  LarkCalendarEvent,
  LarkInteractiveCard,
  ApiResponse,
} from '../../types';
import { LarkOAuthManager } from '../../common/auth/OAuthManager';
import { Logger, withRetry, type RetryConfig } from '../../common/logger/Logger';

/**
 * Lark API クライアント
 */
export class LarkApiClient {
  private oauth: LarkOAuthManager;
  private logger: Logger;
  private config: LarkConfig;

  private static readonly BASE_URL = 'https://open.larksuite.com/open-apis';

  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', '99991400'],
  };

  constructor(config: LarkConfig, logger?: Logger) {
    this.config = config;
    this.oauth = new LarkOAuthManager(config);
    this.logger = (logger || Logger.getInstance()).child('LarkApiClient');
  }

  /**
   * OAuth認証マネージャーを取得
   */
  getOAuth(): LarkOAuthManager {
    return this.oauth;
  }

  /**
   * APIリクエストを実行（Tenant Token使用）
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: unknown,
    useUserToken: boolean = false
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const token = useUserToken
      ? (await this.oauth.getValidToken()).accessToken
      : await this.oauth.getTenantAccessToken();
    const url = `${LarkApiClient.BASE_URL}${endpoint}`;

    this.logger.debug(`${method} ${endpoint}`, { method, endpoint });

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
          });

          const data = await res.json() as { code: number; msg?: string; data?: unknown };

          if (data.code !== 0) {
            throw new Error(`Lark API error: ${data.msg} (code: ${data.code})`);
          }

          return data;
        },
        this.retryConfig,
        this.logger
      );

      const latency = Date.now() - startTime;
      this.logger.info(`${method} ${endpoint} completed`, { method, endpoint, latency });

      const responseData = response as { data?: unknown };
      return {
        success: true,
        data: responseData.data as T,
        metadata: {
          requestId: `lark_${Date.now()}`,
          timestamp: new Date(),
          latency,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`${method} ${endpoint} failed`, err, { method, endpoint });

      return {
        success: false,
        error: {
          code: 'LARK_API_ERROR',
          message: err.message,
        },
        metadata: {
          requestId: `lark_${Date.now()}`,
          timestamp: new Date(),
          latency: Date.now() - startTime,
        },
      };
    }
  }

  // ============================================
  // メッセージ送信
  // ============================================

  /**
   * テキストメッセージを送信
   */
  async sendTextMessage(
    receiveId: string,
    text: string,
    receiveIdType: 'open_id' | 'user_id' | 'chat_id' = 'chat_id'
  ): Promise<ApiResponse<{ message_id: string }>> {
    return this.request<{ message_id: string }>(
      'POST',
      `/im/v1/messages?receive_id_type=${receiveIdType}`,
      {
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      }
    );
  }

  /**
   * インタラクティブカードを送信
   */
  async sendInteractiveCard(
    receiveId: string,
    card: LarkInteractiveCard,
    receiveIdType: 'open_id' | 'user_id' | 'chat_id' = 'chat_id'
  ): Promise<ApiResponse<{ message_id: string }>> {
    return this.request<{ message_id: string }>(
      'POST',
      `/im/v1/messages?receive_id_type=${receiveIdType}`,
      {
        receive_id: receiveId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      }
    );
  }

  /**
   * リッチテキストメッセージを送信
   */
  async sendPostMessage(
    receiveId: string,
    title: string,
    content: Array<Array<{ tag: string; text?: string; href?: string; user_id?: string }>>,
    receiveIdType: 'open_id' | 'user_id' | 'chat_id' = 'chat_id'
  ): Promise<ApiResponse<{ message_id: string }>> {
    return this.request<{ message_id: string }>(
      'POST',
      `/im/v1/messages?receive_id_type=${receiveIdType}`,
      {
        receive_id: receiveId,
        msg_type: 'post',
        content: JSON.stringify({
          zh_cn: { title, content },
          ja_jp: { title, content },
        }),
      }
    );
  }

  /**
   * メッセージに返信
   */
  async replyMessage(
    messageId: string,
    content: LarkMessageContent,
    msgType: string = 'text'
  ): Promise<ApiResponse<{ message_id: string }>> {
    return this.request<{ message_id: string }>(
      'POST',
      `/im/v1/messages/${messageId}/reply`,
      {
        msg_type: msgType,
        content: JSON.stringify(content),
      }
    );
  }

  /**
   * メッセージを取得
   */
  async getMessage(messageId: string): Promise<ApiResponse<LarkMessage>> {
    return this.request<LarkMessage>('GET', `/im/v1/messages/${messageId}`);
  }

  // ============================================
  // チャット管理
  // ============================================

  /**
   * チャット情報を取得
   */
  async getChat(chatId: string): Promise<ApiResponse<LarkChat>> {
    return this.request<LarkChat>('GET', `/im/v1/chats/${chatId}`);
  }

  /**
   * チャットを作成
   */
  async createChat(
    name: string,
    userIds: string[],
    description?: string
  ): Promise<ApiResponse<{ chat_id: string }>> {
    return this.request<{ chat_id: string }>('POST', '/im/v1/chats', {
      name,
      description,
      user_id_list: userIds,
    });
  }

  /**
   * チャットメンバーを追加
   */
  async addChatMembers(
    chatId: string,
    userIds: string[]
  ): Promise<ApiResponse<void>> {
    return this.request<void>('POST', `/im/v1/chats/${chatId}/members`, {
      id_list: userIds,
    });
  }

  /**
   * Botが参加しているチャット一覧を取得
   */
  async listChats(pageToken?: string): Promise<ApiResponse<{
    items: LarkChat[];
    page_token?: string;
    has_more: boolean;
  }>> {
    let endpoint = '/im/v1/chats';
    if (pageToken) {
      endpoint += `?page_token=${pageToken}`;
    }
    return this.request('GET', endpoint);
  }

  // ============================================
  // ユーザー情報
  // ============================================

  /**
   * ユーザー情報を取得
   */
  async getUser(
    userId: string,
    userIdType: 'open_id' | 'user_id' = 'open_id'
  ): Promise<ApiResponse<LarkUser>> {
    return this.request<LarkUser>(
      'GET',
      `/contact/v3/users/${userId}?user_id_type=${userIdType}`
    );
  }

  /**
   * ユーザーをバッチ取得
   */
  async batchGetUsers(
    userIds: string[],
    userIdType: 'open_id' | 'user_id' = 'open_id'
  ): Promise<ApiResponse<{ items: LarkUser[] }>> {
    return this.request<{ items: LarkUser[] }>(
      'POST',
      `/contact/v3/users/batch?user_id_type=${userIdType}`,
      { user_ids: userIds }
    );
  }

  // ============================================
  // カレンダー連携
  // ============================================

  /**
   * カレンダーイベントを作成
   */
  async createCalendarEvent(
    calendarId: string,
    event: Partial<LarkCalendarEvent>
  ): Promise<ApiResponse<{ event_id: string }>> {
    return this.request<{ event_id: string }>(
      'POST',
      `/calendar/v4/calendars/${calendarId}/events`,
      {
        summary: event.summary,
        description: event.description,
        start_time: event.startTime,
        end_time: event.endTime,
        location: event.location ? { name: event.location } : undefined,
        attendee_ability: 'can_modify_event',
        free_busy_status: 'busy',
        visibility: 'default',
      }
    );
  }

  /**
   * カレンダーイベントを更新
   */
  async updateCalendarEvent(
    calendarId: string,
    eventId: string,
    event: Partial<LarkCalendarEvent>
  ): Promise<ApiResponse<void>> {
    return this.request<void>(
      'PATCH',
      `/calendar/v4/calendars/${calendarId}/events/${eventId}`,
      {
        summary: event.summary,
        description: event.description,
        start_time: event.startTime,
        end_time: event.endTime,
        location: event.location ? { name: event.location } : undefined,
      }
    );
  }

  /**
   * カレンダーイベントを削除
   */
  async deleteCalendarEvent(
    calendarId: string,
    eventId: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>(
      'DELETE',
      `/calendar/v4/calendars/${calendarId}/events/${eventId}`
    );
  }

  /**
   * カレンダーイベント一覧を取得
   */
  async listCalendarEvents(
    calendarId: string,
    startTime: string,
    endTime: string
  ): Promise<ApiResponse<{ items: LarkCalendarEvent[] }>> {
    return this.request<{ items: LarkCalendarEvent[] }>(
      'GET',
      `/calendar/v4/calendars/${calendarId}/events?start_time=${startTime}&end_time=${endTime}`
    );
  }

  /**
   * プライマリカレンダーIDを取得
   */
  async getPrimaryCalendar(): Promise<ApiResponse<{ calendar_id: string }>> {
    return this.request<{ calendar_id: string }>('GET', '/calendar/v4/calendars/primary');
  }

  // ============================================
  // Webhook検証
  // ============================================

  /**
   * Webhookチャレンジに応答
   */
  handleChallenge(challenge: string): { challenge: string } {
    return { challenge };
  }

  /**
   * Webhook署名を検証
   */
  verifyWebhookSignature(
    timestamp: string,
    nonce: string,
    body: string,
    signature: string
  ): boolean {
    if (!this.config.verificationToken) {
      this.logger.warn('Verification token not configured');
      return false;
    }

    // 署名検証ロジック
    // 実際の実装ではcryptoを使用
    const expectedSignature = `${timestamp}${nonce}${this.config.verificationToken}${body}`;
    // TODO: SHA256ハッシュ計算
    return true; // 簡易実装
  }
}

// ファクトリー関数
export function createLarkClient(config: LarkConfig, logger?: Logger): LarkApiClient {
  return new LarkApiClient(config, logger);
}
