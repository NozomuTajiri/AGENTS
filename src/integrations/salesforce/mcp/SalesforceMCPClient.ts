/**
 * Salesforce MCP Client
 * Model Context Protocol を通じたSalesforce連携
 */

import type {
  SalesforceConfig,
  SalesforceObject,
  Account,
  Opportunity,
  Task,
  Case,
  SalesforceQueryResult,
  ApiResponse,
} from '../../types';
import { SalesforceOAuthManager } from '../../common/auth/OAuthManager';
import { Logger, withRetry, type RetryConfig } from '../../common/logger/Logger';

/**
 * Salesforce REST APIクライアント
 * (MCPが利用できない環境用のフォールバック実装)
 */
export class SalesforceRestClient {
  private oauth: SalesforceOAuthManager;
  private logger: Logger;
  private config: SalesforceConfig;

  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'REQUEST_LIMIT_EXCEEDED'],
  };

  constructor(config: SalesforceConfig, logger?: Logger) {
    this.config = config;
    this.oauth = new SalesforceOAuthManager(config);
    this.logger = (logger || Logger.getInstance()).child('SalesforceRestClient');
  }

  /**
   * OAuth認証マネージャーを取得
   */
  getOAuth(): SalesforceOAuthManager {
    return this.oauth;
  }

  /**
   * APIリクエストを実行
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const token = await this.oauth.getValidToken();
    const url = `${this.oauth.getInstanceUrl()}/services/data/v${this.config.apiVersion}${endpoint}`;

    this.logger.debug(`${method} ${endpoint}`, { method, endpoint });

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: res.statusText })) as Array<{ message?: string }> | { message?: string };
            const errorMessage = Array.isArray(errorData)
              ? errorData[0]?.message
              : (errorData as { message?: string }).message;
            throw new Error(errorMessage || `HTTP ${res.status}`);
          }

          // DELETE は 204 No Content を返す
          if (res.status === 204) {
            return null;
          }

          return res.json();
        },
        this.retryConfig,
        this.logger
      );

      const latency = Date.now() - startTime;
      this.logger.info(`${method} ${endpoint} completed`, { method, endpoint, latency });

      return {
        success: true,
        data: response as T,
        metadata: {
          requestId: `sf_${Date.now()}`,
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
          code: 'SALESFORCE_API_ERROR',
          message: err.message,
        },
        metadata: {
          requestId: `sf_${Date.now()}`,
          timestamp: new Date(),
          latency: Date.now() - startTime,
        },
      };
    }
  }

  // ============================================
  // SOQL クエリ
  // ============================================

  /**
   * SOQLクエリを実行
   */
  async query<T extends SalesforceObject>(soql: string): Promise<ApiResponse<SalesforceQueryResult<T>>> {
    const encodedQuery = encodeURIComponent(soql);
    return this.request<SalesforceQueryResult<T>>('GET', `/query?q=${encodedQuery}`);
  }

  /**
   * 次ページのレコードを取得
   */
  async queryMore<T extends SalesforceObject>(nextRecordsUrl: string): Promise<ApiResponse<SalesforceQueryResult<T>>> {
    return this.request<SalesforceQueryResult<T>>('GET', nextRecordsUrl);
  }

  // ============================================
  // Account CRUD
  // ============================================

  async getAccount(id: string): Promise<ApiResponse<Account>> {
    return this.request<Account>('GET', `/sobjects/Account/${id}`);
  }

  async createAccount(data: Partial<Account>): Promise<ApiResponse<{ id: string; success: boolean }>> {
    return this.request<{ id: string; success: boolean }>('POST', '/sobjects/Account', data);
  }

  async updateAccount(id: string, data: Partial<Account>): Promise<ApiResponse<null>> {
    return this.request<null>('PATCH', `/sobjects/Account/${id}`, data);
  }

  async deleteAccount(id: string): Promise<ApiResponse<null>> {
    return this.request<null>('DELETE', `/sobjects/Account/${id}`);
  }

  async queryAccounts(conditions?: string): Promise<ApiResponse<SalesforceQueryResult<Account>>> {
    let soql = 'SELECT Id, Name, Type, Industry, Website, Phone, BillingCity, BillingCountry, Description, OwnerId, CreatedDate, LastModifiedDate FROM Account';
    if (conditions) {
      soql += ` WHERE ${conditions}`;
    }
    soql += ' ORDER BY LastModifiedDate DESC LIMIT 100';
    return this.query<Account>(soql);
  }

  // ============================================
  // Opportunity CRUD
  // ============================================

  async getOpportunity(id: string): Promise<ApiResponse<Opportunity>> {
    return this.request<Opportunity>('GET', `/sobjects/Opportunity/${id}`);
  }

  async createOpportunity(data: Partial<Opportunity>): Promise<ApiResponse<{ id: string; success: boolean }>> {
    return this.request<{ id: string; success: boolean }>('POST', '/sobjects/Opportunity', data);
  }

  async updateOpportunity(id: string, data: Partial<Opportunity>): Promise<ApiResponse<null>> {
    return this.request<null>('PATCH', `/sobjects/Opportunity/${id}`, data);
  }

  async deleteOpportunity(id: string): Promise<ApiResponse<null>> {
    return this.request<null>('DELETE', `/sobjects/Opportunity/${id}`);
  }

  async queryOpportunities(conditions?: string): Promise<ApiResponse<SalesforceQueryResult<Opportunity>>> {
    let soql = 'SELECT Id, Name, AccountId, StageName, Amount, CloseDate, Probability, Type, LeadSource, Description, OwnerId, CreatedDate, LastModifiedDate FROM Opportunity';
    if (conditions) {
      soql += ` WHERE ${conditions}`;
    }
    soql += ' ORDER BY CloseDate ASC LIMIT 100';
    return this.query<Opportunity>(soql);
  }

  // ============================================
  // Task CRUD
  // ============================================

  async getTask(id: string): Promise<ApiResponse<Task>> {
    return this.request<Task>('GET', `/sobjects/Task/${id}`);
  }

  async createTask(data: Partial<Task>): Promise<ApiResponse<{ id: string; success: boolean }>> {
    return this.request<{ id: string; success: boolean }>('POST', '/sobjects/Task', data);
  }

  async updateTask(id: string, data: Partial<Task>): Promise<ApiResponse<null>> {
    return this.request<null>('PATCH', `/sobjects/Task/${id}`, data);
  }

  async deleteTask(id: string): Promise<ApiResponse<null>> {
    return this.request<null>('DELETE', `/sobjects/Task/${id}`);
  }

  async queryTasks(conditions?: string): Promise<ApiResponse<SalesforceQueryResult<Task>>> {
    let soql = 'SELECT Id, Subject, Status, Priority, WhatId, WhoId, ActivityDate, Description, OwnerId, CreatedDate, LastModifiedDate FROM Task';
    if (conditions) {
      soql += ` WHERE ${conditions}`;
    }
    soql += ' ORDER BY ActivityDate ASC LIMIT 100';
    return this.query<Task>(soql);
  }

  // ============================================
  // Case CRUD
  // ============================================

  async getCase(id: string): Promise<ApiResponse<Case>> {
    return this.request<Case>('GET', `/sobjects/Case/${id}`);
  }

  async createCase(data: Partial<Case>): Promise<ApiResponse<{ id: string; success: boolean }>> {
    return this.request<{ id: string; success: boolean }>('POST', '/sobjects/Case', data);
  }

  async updateCase(id: string, data: Partial<Case>): Promise<ApiResponse<null>> {
    return this.request<null>('PATCH', `/sobjects/Case/${id}`, data);
  }

  async deleteCase(id: string): Promise<ApiResponse<null>> {
    return this.request<null>('DELETE', `/sobjects/Case/${id}`);
  }

  async queryCases(conditions?: string): Promise<ApiResponse<SalesforceQueryResult<Case>>> {
    let soql = 'SELECT Id, CaseNumber, Subject, Status, Priority, Origin, Type, AccountId, ContactId, Description, OwnerId, CreatedDate, LastModifiedDate FROM Case';
    if (conditions) {
      soql += ` WHERE ${conditions}`;
    }
    soql += ' ORDER BY CreatedDate DESC LIMIT 100';
    return this.query<Case>(soql);
  }

  // ============================================
  // Generic CRUD
  // ============================================

  async getRecord<T extends SalesforceObject>(objectType: string, id: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', `/sobjects/${objectType}/${id}`);
  }

  async createRecord<T extends SalesforceObject>(
    objectType: string,
    data: Partial<T>
  ): Promise<ApiResponse<{ id: string; success: boolean }>> {
    return this.request<{ id: string; success: boolean }>('POST', `/sobjects/${objectType}`, data);
  }

  async updateRecord<T extends SalesforceObject>(
    objectType: string,
    id: string,
    data: Partial<T>
  ): Promise<ApiResponse<null>> {
    return this.request<null>('PATCH', `/sobjects/${objectType}/${id}`, data);
  }

  async deleteRecord(objectType: string, id: string): Promise<ApiResponse<null>> {
    return this.request<null>('DELETE', `/sobjects/${objectType}/${id}`);
  }

  // ============================================
  // メタデータ
  // ============================================

  async describeObject(objectType: string): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('GET', `/sobjects/${objectType}/describe`);
  }

  async getGlobalDescribe(): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('GET', '/sobjects');
  }
}

/**
 * Salesforce MCPクライアント
 * MCPサーバー経由でSalesforceと連携
 */
export class SalesforceMCPClient {
  private restClient: SalesforceRestClient;
  private logger: Logger;
  private mcpEnabled: boolean = false;

  constructor(config: SalesforceConfig, logger?: Logger) {
    this.restClient = new SalesforceRestClient(config, logger);
    this.logger = (logger || Logger.getInstance()).child('SalesforceMCPClient');
  }

  /**
   * MCPサーバーに接続
   */
  async connect(): Promise<void> {
    // TODO: MCPサーバーへの接続実装
    // 現時点ではREST APIにフォールバック
    this.logger.info('MCP connection not available, using REST API fallback');
    this.mcpEnabled = false;
  }

  /**
   * REST APIクライアントを取得（直接アクセス用）
   */
  getRest(): SalesforceRestClient {
    return this.restClient;
  }

  /**
   * OAuth認証マネージャーを取得
   */
  getOAuth(): SalesforceOAuthManager {
    return this.restClient.getOAuth();
  }

  /**
   * MCPが有効かチェック
   */
  isMCPEnabled(): boolean {
    return this.mcpEnabled;
  }

  // 以下、MCPメソッド（REST APIにデリゲート）

  async queryAccounts(conditions?: string) {
    return this.restClient.queryAccounts(conditions);
  }

  async getAccount(id: string) {
    return this.restClient.getAccount(id);
  }

  async createAccount(data: Partial<Account>) {
    return this.restClient.createAccount(data);
  }

  async updateAccount(id: string, data: Partial<Account>) {
    return this.restClient.updateAccount(id, data);
  }

  async queryOpportunities(conditions?: string) {
    return this.restClient.queryOpportunities(conditions);
  }

  async getOpportunity(id: string) {
    return this.restClient.getOpportunity(id);
  }

  async createOpportunity(data: Partial<Opportunity>) {
    return this.restClient.createOpportunity(data);
  }

  async updateOpportunity(id: string, data: Partial<Opportunity>) {
    return this.restClient.updateOpportunity(id, data);
  }

  async queryTasks(conditions?: string) {
    return this.restClient.queryTasks(conditions);
  }

  async createTask(data: Partial<Task>) {
    return this.restClient.createTask(data);
  }

  async queryCases(conditions?: string) {
    return this.restClient.queryCases(conditions);
  }

  async createCase(data: Partial<Case>) {
    return this.restClient.createCase(data);
  }
}

// ファクトリー関数
export function createSalesforceClient(config: SalesforceConfig, logger?: Logger): SalesforceMCPClient {
  return new SalesforceMCPClient(config, logger);
}
