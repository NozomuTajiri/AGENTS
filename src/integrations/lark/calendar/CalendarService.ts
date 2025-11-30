/**
 * Lark Calendar Service
 * カレンダー連携サービス
 */

import type { LarkCalendarEvent, ApiResponse } from '../../types';
import { LarkApiClient } from '../api/LarkApiClient';
import { Logger } from '../../common';

export interface MeetingRequest {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendeeUserIds?: string[];
  reminderMinutes?: number;
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  available: boolean;
}

/**
 * Calendar Service
 */
export class CalendarService {
  private client: LarkApiClient;
  private logger: Logger;
  private primaryCalendarId: string | null = null;

  constructor(client: LarkApiClient, logger?: Logger) {
    this.client = client;
    this.logger = (logger || Logger.getInstance()).child('CalendarService');
  }

  /**
   * プライマリカレンダーIDを取得
   */
  async getPrimaryCalendarId(): Promise<string> {
    if (this.primaryCalendarId) {
      return this.primaryCalendarId;
    }

    const result = await this.client.getPrimaryCalendar();
    if (!result.success || !result.data) {
      throw new Error('Failed to get primary calendar');
    }

    this.primaryCalendarId = result.data.calendar_id;
    return this.primaryCalendarId;
  }

  /**
   * ミーティングを作成
   */
  async createMeeting(request: MeetingRequest): Promise<ApiResponse<{ event_id: string }>> {
    const calendarId = await this.getPrimaryCalendarId();

    const event: Partial<LarkCalendarEvent> = {
      summary: request.title,
      description: request.description,
      startTime: {
        timestamp: Math.floor(request.startTime.getTime() / 1000).toString(),
      },
      endTime: {
        timestamp: Math.floor(request.endTime.getTime() / 1000).toString(),
      },
      location: request.location,
    };

    if (request.attendeeUserIds && request.attendeeUserIds.length > 0) {
      event.attendees = request.attendeeUserIds.map((userId) => ({
        type: 'user' as const,
        userId,
      }));
    }

    if (request.reminderMinutes) {
      event.reminders = [{ minutes: request.reminderMinutes }];
    }

    const result = await this.client.createCalendarEvent(calendarId, event);

    if (result.success) {
      this.logger.info('Meeting created', { eventId: result.data?.event_id, title: request.title });
    }

    return result;
  }

  /**
   * ミーティングを更新
   */
  async updateMeeting(
    eventId: string,
    updates: Partial<MeetingRequest>
  ): Promise<ApiResponse<void>> {
    const calendarId = await this.getPrimaryCalendarId();

    const event: Partial<LarkCalendarEvent> = {};

    if (updates.title) event.summary = updates.title;
    if (updates.description) event.description = updates.description;
    if (updates.location) event.location = updates.location;
    if (updates.startTime) {
      event.startTime = {
        timestamp: Math.floor(updates.startTime.getTime() / 1000).toString(),
      };
    }
    if (updates.endTime) {
      event.endTime = {
        timestamp: Math.floor(updates.endTime.getTime() / 1000).toString(),
      };
    }

    return this.client.updateCalendarEvent(calendarId, eventId, event);
  }

  /**
   * ミーティングを削除
   */
  async cancelMeeting(eventId: string): Promise<ApiResponse<void>> {
    const calendarId = await this.getPrimaryCalendarId();
    return this.client.deleteCalendarEvent(calendarId, eventId);
  }

  /**
   * 期間内のイベントを取得
   */
  async getEvents(startDate: Date, endDate: Date): Promise<LarkCalendarEvent[]> {
    const calendarId = await this.getPrimaryCalendarId();
    const startTime = Math.floor(startDate.getTime() / 1000).toString();
    const endTime = Math.floor(endDate.getTime() / 1000).toString();

    const result = await this.client.listCalendarEvents(calendarId, startTime, endTime);

    if (!result.success || !result.data) {
      return [];
    }

    return result.data.items;
  }

  /**
   * 今日のイベントを取得
   */
  async getTodayEvents(): Promise<LarkCalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getEvents(today, tomorrow);
  }

  /**
   * 今週のイベントを取得
   */
  async getWeekEvents(): Promise<LarkCalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return this.getEvents(today, nextWeek);
  }

  /**
   * クイックミーティング作成（30分）
   */
  async createQuickMeeting(
    title: string,
    startTime: Date,
    attendeeUserIds?: string[]
  ): Promise<ApiResponse<{ event_id: string }>> {
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    return this.createMeeting({
      title,
      startTime,
      endTime,
      attendeeUserIds,
      reminderMinutes: 5,
    });
  }

  /**
   * Salesforce Opportunityからフォローアップミーティングを作成
   */
  async createSalesFollowUp(
    opportunityName: string,
    opportunityId: string,
    contactUserId: string,
    proposedDate: Date
  ): Promise<ApiResponse<{ event_id: string }>> {
    const endTime = new Date(proposedDate);
    endTime.setHours(endTime.getHours() + 1);

    return this.createMeeting({
      title: `Sales Follow-up: ${opportunityName}`,
      description: `Follow-up meeting for Salesforce Opportunity: ${opportunityId}\n\nDiscuss next steps and address any questions.`,
      startTime: proposedDate,
      endTime,
      attendeeUserIds: [contactUserId],
      reminderMinutes: 15,
    });
  }

  /**
   * 日次サマリーを生成
   */
  async getDailySummary(): Promise<string> {
    const events = await this.getTodayEvents();

    if (events.length === 0) {
      return 'No meetings scheduled for today.';
    }

    const lines = ['**Today\'s Schedule:**', ''];

    for (const event of events) {
      const startTime = event.startTime.timestamp
        ? new Date(parseInt(event.startTime.timestamp) * 1000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : event.startTime.date || 'All day';

      lines.push(`• **${startTime}** - ${event.summary}`);
      if (event.location) {
        lines.push(`  📍 ${event.location}`);
      }
    }

    lines.push('', `Total: ${events.length} meeting(s)`);

    return lines.join('\n');
  }

  /**
   * 週次サマリーを生成
   */
  async getWeeklySummary(): Promise<string> {
    const events = await this.getWeekEvents();

    if (events.length === 0) {
      return 'No meetings scheduled for this week.';
    }

    // 日付でグループ化
    const byDate = new Map<string, LarkCalendarEvent[]>();
    for (const event of events) {
      const dateStr = event.startTime.timestamp
        ? new Date(parseInt(event.startTime.timestamp) * 1000).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : event.startTime.date || 'Unknown';

      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, []);
      }
      byDate.get(dateStr)!.push(event);
    }

    const lines = ['**This Week\'s Schedule:**', ''];

    for (const [date, dateEvents] of byDate) {
      lines.push(`**${date}** (${dateEvents.length} meeting(s))`);
      for (const event of dateEvents) {
        lines.push(`  • ${event.summary}`);
      }
      lines.push('');
    }

    lines.push(`Total: ${events.length} meeting(s) this week`);

    return lines.join('\n');
  }
}

export function createCalendarService(client: LarkApiClient, logger?: Logger): CalendarService {
  return new CalendarService(client, logger);
}
