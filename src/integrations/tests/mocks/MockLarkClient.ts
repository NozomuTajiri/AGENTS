/**
 * Mock Lark Client
 * テスト用モッククライアント
 */

import type {
  LarkUser,
  LarkChat,
  LarkCalendarEvent,
  LarkInteractiveCard,
  ApiResponse,
} from '../../types';

/**
 * Mock データ
 */
const MOCK_USERS: LarkUser[] = [
  {
    userId: 'user001',
    openId: 'ou_xxx001',
    name: 'John Doe',
    email: 'john.doe@example.com',
    departmentIds: ['dept001'],
  },
  {
    userId: 'user002',
    openId: 'ou_xxx002',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    departmentIds: ['dept001', 'dept002'],
  },
];

const MOCK_CHATS: LarkChat[] = [
  {
    chatId: 'oc_xxx001',
    name: 'Sales Team',
    ownerId: 'user001',
    chatType: 'group',
    memberCount: 10,
  },
  {
    chatId: 'oc_xxx002',
    name: 'Support Channel',
    ownerId: 'user002',
    chatType: 'group',
    memberCount: 5,
  },
];

const MOCK_EVENTS: LarkCalendarEvent[] = [
  {
    eventId: 'event001',
    calendarId: 'cal001',
    summary: 'Team Standup',
    startTime: { timestamp: String(Math.floor(Date.now() / 1000) + 3600) },
    endTime: { timestamp: String(Math.floor(Date.now() / 1000) + 5400) },
    location: 'Conference Room A',
  },
  {
    eventId: 'event002',
    calendarId: 'cal001',
    summary: 'Client Meeting',
    startTime: { timestamp: String(Math.floor(Date.now() / 1000) + 7200) },
    endTime: { timestamp: String(Math.floor(Date.now() / 1000) + 10800) },
    location: 'Virtual',
  },
];

/**
 * 送信メッセージ記録
 */
interface SentMessage {
  chatId: string;
  type: 'text' | 'card' | 'post';
  content: string | LarkInteractiveCard | unknown;
  timestamp: Date;
}

/**
 * Mock Lark Client
 */
export class MockLarkClient {
  private users = [...MOCK_USERS];
  private chats = [...MOCK_CHATS];
  private events = [...MOCK_EVENTS];
  private sentMessages: SentMessage[] = [];
  private primaryCalendarId = 'cal001';

  // Message methods
  async sendTextMessage(
    receiveId: string,
    text: string,
    _receiveIdType: string = 'chat_id'
  ): Promise<ApiResponse<{ message_id: string }>> {
    const messageId = `msg_${Date.now()}`;
    this.sentMessages.push({
      chatId: receiveId,
      type: 'text',
      content: text,
      timestamp: new Date(),
    });
    return this.success({ message_id: messageId });
  }

  async sendInteractiveCard(
    receiveId: string,
    card: LarkInteractiveCard,
    _receiveIdType: string = 'chat_id'
  ): Promise<ApiResponse<{ message_id: string }>> {
    const messageId = `msg_${Date.now()}`;
    this.sentMessages.push({
      chatId: receiveId,
      type: 'card',
      content: card,
      timestamp: new Date(),
    });
    return this.success({ message_id: messageId });
  }

  async sendPostMessage(
    receiveId: string,
    title: string,
    content: unknown,
    _receiveIdType: string = 'chat_id'
  ): Promise<ApiResponse<{ message_id: string }>> {
    const messageId = `msg_${Date.now()}`;
    this.sentMessages.push({
      chatId: receiveId,
      type: 'post',
      content: { title, content },
      timestamp: new Date(),
    });
    return this.success({ message_id: messageId });
  }

  // User methods
  async getUser(userId: string): Promise<ApiResponse<LarkUser>> {
    const user = this.users.find((u) => u.userId === userId || u.openId === userId);
    return user
      ? this.success(user)
      : this.error('User not found');
  }

  // Chat methods
  async getChat(chatId: string): Promise<ApiResponse<LarkChat>> {
    const chat = this.chats.find((c) => c.chatId === chatId);
    return chat
      ? this.success(chat)
      : this.error('Chat not found');
  }

  async createChat(
    name: string,
    userIds: string[],
    description?: string
  ): Promise<ApiResponse<{ chat_id: string }>> {
    const chatId = `oc_${Date.now()}`;
    const chat: LarkChat = {
      chatId,
      name,
      description,
      ownerId: userIds[0] || 'system',
      chatType: 'group',
      memberCount: userIds.length,
    };
    this.chats.push(chat);
    return this.success({ chat_id: chatId });
  }

  async listChats(): Promise<ApiResponse<{ items: LarkChat[]; has_more: boolean }>> {
    return this.success({
      items: this.chats,
      has_more: false,
    });
  }

  // Calendar methods
  async getPrimaryCalendar(): Promise<ApiResponse<{ calendar_id: string }>> {
    return this.success({ calendar_id: this.primaryCalendarId });
  }

  async createCalendarEvent(
    calendarId: string,
    event: Partial<LarkCalendarEvent>
  ): Promise<ApiResponse<{ event_id: string }>> {
    const eventId = `event_${Date.now()}`;
    const newEvent: LarkCalendarEvent = {
      eventId,
      calendarId,
      summary: event.summary || 'New Event',
      startTime: event.startTime || { timestamp: String(Date.now() / 1000) },
      endTime: event.endTime || { timestamp: String(Date.now() / 1000 + 3600) },
      description: event.description,
      location: event.location,
    };
    this.events.push(newEvent);
    return this.success({ event_id: eventId });
  }

  async updateCalendarEvent(
    calendarId: string,
    eventId: string,
    event: Partial<LarkCalendarEvent>
  ): Promise<ApiResponse<void>> {
    const index = this.events.findIndex(
      (e) => e.eventId === eventId && e.calendarId === calendarId
    );
    if (index === -1) {
      return this.error('Event not found');
    }
    this.events[index] = { ...this.events[index], ...event };
    return this.success(undefined);
  }

  async deleteCalendarEvent(
    calendarId: string,
    eventId: string
  ): Promise<ApiResponse<void>> {
    const index = this.events.findIndex(
      (e) => e.eventId === eventId && e.calendarId === calendarId
    );
    if (index === -1) {
      return this.error('Event not found');
    }
    this.events.splice(index, 1);
    return this.success(undefined);
  }

  async listCalendarEvents(
    calendarId: string,
    _startTime: string,
    _endTime: string
  ): Promise<ApiResponse<{ items: LarkCalendarEvent[] }>> {
    const items = this.events.filter((e) => e.calendarId === calendarId);
    return this.success({ items });
  }

  // Webhook methods
  handleChallenge(challenge: string): { challenge: string } {
    return { challenge };
  }

  // Helper methods
  private success<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        requestId: `mock_lark_${Date.now()}`,
        timestamp: new Date(),
        latency: Math.random() * 50,
      },
    };
  }

  private error<T>(message: string): ApiResponse<T> {
    return {
      success: false,
      error: {
        code: 'MOCK_LARK_ERROR',
        message,
      },
      metadata: {
        requestId: `mock_lark_${Date.now()}`,
        timestamp: new Date(),
        latency: 0,
      },
    };
  }

  // Test utilities
  getSentMessages(): SentMessage[] {
    return this.sentMessages;
  }

  getLastMessage(): SentMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clearMessages(): void {
    this.sentMessages = [];
  }

  reset(): void {
    this.users = [...MOCK_USERS];
    this.chats = [...MOCK_CHATS];
    this.events = [...MOCK_EVENTS];
    this.sentMessages = [];
  }

  getAllEvents(): LarkCalendarEvent[] {
    return this.events;
  }
}

export function createMockLarkClient(): MockLarkClient {
  return new MockLarkClient();
}
