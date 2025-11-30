/**
 * Lark・Salesforce統合 型定義
 */

// ============================================
// 共通型定義
// ============================================

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scopes?: string[];
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: Date;
  latency: number;
}

// ============================================
// Salesforce型定義
// ============================================

export interface SalesforceConfig extends AuthConfig {
  instanceUrl: string;
  apiVersion: string;
  sandbox?: boolean;
}

export interface SalesforceObject {
  Id: string;
  Name?: string;
  CreatedDate?: string;
  LastModifiedDate?: string;
  [key: string]: unknown;
}

export interface Account extends SalesforceObject {
  Type?: string;
  Industry?: string;
  Website?: string;
  Phone?: string;
  BillingCity?: string;
  BillingCountry?: string;
  Description?: string;
  OwnerId?: string;
}

export interface Opportunity extends SalesforceObject {
  AccountId?: string;
  StageName: string;
  Amount?: number;
  CloseDate: string;
  Probability?: number;
  Type?: string;
  LeadSource?: string;
  Description?: string;
  OwnerId?: string;
}

export interface Task extends SalesforceObject {
  Subject: string;
  Status: string;
  Priority?: string;
  WhatId?: string;
  WhoId?: string;
  ActivityDate?: string;
  Description?: string;
  OwnerId?: string;
}

export interface Case extends SalesforceObject {
  Subject: string;
  Status: string;
  Priority?: string;
  Origin?: string;
  Type?: string;
  AccountId?: string;
  ContactId?: string;
  Description?: string;
  OwnerId?: string;
}

export interface SalesforceQuery {
  query: string;
  nextRecordsUrl?: string;
}

export interface SalesforceQueryResult<T extends SalesforceObject> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface SalesforceWebhookEvent {
  objectType: string;
  changeType: 'created' | 'updated' | 'deleted';
  recordId: string;
  timestamp: Date;
  id?: string;
  type?: 'create' | 'update' | 'delete' | 'undelete';
  changedFields?: string[];
  payload?: Record<string, unknown>;
}

// ============================================
// Lark型定義
// ============================================

export interface LarkConfig extends AuthConfig {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
}

export interface LarkUser {
  userId: string;
  openId: string;
  name: string;
  email?: string;
  mobile?: string;
  avatar?: string;
  departmentIds?: string[];
}

export interface LarkMessage {
  messageId: string;
  chatId: string;
  senderId: string;
  createTime: string;
  messageType: LarkMessageType;
  content: LarkMessageContent;
}

export type LarkMessageType = 'text' | 'post' | 'image' | 'file' | 'audio' | 'media' | 'sticker' | 'interactive';

export interface LarkMessageContent {
  text?: string;
  post?: LarkPostContent;
  image?: LarkImageContent;
  file?: LarkFileContent;
  interactive?: LarkInteractiveCard;
}

export interface LarkPostContent {
  title: string;
  content: LarkPostElement[][];
}

export interface LarkPostElement {
  tag: 'text' | 'a' | 'at' | 'img';
  text?: string;
  href?: string;
  userId?: string;
  imageKey?: string;
}

export interface LarkImageContent {
  imageKey: string;
}

export interface LarkFileContent {
  fileKey: string;
  fileName: string;
}

export interface LarkInteractiveCard {
  config?: {
    wideScreenMode?: boolean;
    enableForward?: boolean;
  };
  header?: {
    title: {
      tag: 'plain_text' | 'lark_md';
      content: string;
    };
    template?: string;
  };
  elements: LarkCardElement[];
}

export type LarkCardElement =
  | LarkCardDiv
  | LarkCardAction
  | LarkCardNote
  | LarkCardHr;

export interface LarkCardDiv {
  tag: 'div';
  text?: {
    tag: 'plain_text' | 'lark_md';
    content: string;
  };
  fields?: {
    is_short: boolean;
    text: {
      tag: 'plain_text' | 'lark_md';
      content: string;
    };
  }[];
}

export interface LarkCardAction {
  tag: 'action';
  actions: LarkCardButton[];
}

export interface LarkCardButton {
  tag: 'button';
  text: {
    tag: 'plain_text' | 'lark_md';
    content: string;
  };
  type?: 'default' | 'primary' | 'danger';
  value?: Record<string, unknown>;
}

export interface LarkCardNote {
  tag: 'note';
  elements: {
    tag: 'plain_text' | 'lark_md' | 'img';
    content?: string;
    imgKey?: string;
  }[];
}

export interface LarkCardHr {
  tag: 'hr';
}

export interface LarkChat {
  chatId: string;
  name: string;
  description?: string;
  avatar?: string;
  ownerId: string;
  chatType: 'private' | 'group';
  memberCount?: number;
}

export interface LarkCalendarEvent {
  eventId: string;
  calendarId: string;
  summary: string;
  description?: string;
  startTime: LarkEventTime;
  endTime: LarkEventTime;
  location?: string;
  attendees?: LarkAttendee[];
  reminders?: LarkReminder[];
}

export interface LarkEventTime {
  date?: string;
  timestamp?: string;
  timezone?: string;
}

export interface LarkAttendee {
  type: 'user' | 'chat' | 'resource' | 'thirdParty';
  userId?: string;
  chatId?: string;
  email?: string;
  status?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}

export interface LarkReminder {
  minutes: number;
}

export interface LarkBotCommand {
  command: string;
  description: string;
  handler: (params: LarkBotCommandParams) => Promise<LarkMessageContent>;
}

export interface LarkBotCommandParams {
  userId: string;
  chatId: string;
  command: string;
  args: string[];
  messageId: string;
}

export interface LarkWebhookEvent {
  type: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  schema?: string;
  header?: {
    eventId: string;
    eventType: string;
    createTime: string;
    token: string;
    appId: string;
  };
  event?: Record<string, unknown>;
}

// ============================================
// 連携エンジン型定義
// ============================================

export interface SyncConfig {
  source: 'salesforce' | 'lark';
  target: 'salesforce' | 'lark';
  objectMapping: ObjectMapping[];
  syncMode: 'realtime' | 'batch';
  batchInterval?: number; // minutes
}

export interface ObjectMapping {
  sourceObject: string;
  targetObject: string;
  fieldMappings: FieldMapping[];
  syncDirection?: 'unidirectional' | 'bidirectional';
  direction?: SyncDirection;
  filter?: string;
  notificationChatId?: string;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: (value: unknown) => unknown;
}

export interface SyncResult {
  id: string;
  config: SyncConfig;
  status: 'success' | 'partial' | 'failed';
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  errors: SyncError[];
  startTime: Date;
  endTime: Date;
}

export interface SyncError {
  recordId: string;
  sourceObject: string;
  error: string;
  timestamp: Date;
}

export interface NotificationConfig {
  salesforceEvents: string[];
  larkChatIds: string[];
  template: string;
  filters?: NotificationFilter[];
}

export interface NotificationFilter {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: unknown;
}

// ============================================
// 追加型定義
// ============================================

export type SyncDirection = 'sf_to_lark' | 'lark_to_sf' | 'bidirectional';

export type ConflictResolution = 'source_wins' | 'target_wins' | 'latest_wins' | 'manual';

export interface SyncJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'completed_with_errors' | 'failed';
  mapping: ObjectMapping;
  startTime: Date;
  endTime?: Date;
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
}

export interface WebhookConfig {
  notificationChatId?: string;
  sendWelcomeMessage?: boolean;
  enableSalesforceNotifications?: boolean;
  enableLarkCommands?: boolean;
}

export interface ApiMetadata {
  requestId: string;
  timestamp: Date;
  latency: number;
}
