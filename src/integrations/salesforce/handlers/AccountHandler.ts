/**
 * Salesforce Account Handler
 * Account オブジェクトの高度な操作
 */

import type { Account, ApiResponse, SalesforceQueryResult } from '../../types';
import { SalesforceRestClient } from '../mcp/SalesforceMCPClient';
import { Logger } from '../../common';

export interface AccountSearchCriteria {
  name?: string;
  type?: string;
  industry?: string;
  billingCountry?: string;
  ownerId?: string;
  createdAfter?: Date;
  modifiedAfter?: Date;
}

export interface AccountStats {
  totalCount: number;
  byType: Record<string, number>;
  byIndustry: Record<string, number>;
  byCountry: Record<string, number>;
}

/**
 * Account Handler
 */
export class AccountHandler {
  private client: SalesforceRestClient;
  private logger: Logger;

  constructor(client: SalesforceRestClient, logger?: Logger) {
    this.client = client;
    this.logger = (logger || Logger.getInstance()).child('AccountHandler');
  }

  /**
   * 高度な検索
   */
  async search(criteria: AccountSearchCriteria): Promise<ApiResponse<SalesforceQueryResult<Account>>> {
    const conditions: string[] = [];

    if (criteria.name) {
      conditions.push(`Name LIKE '%${this.escapeSOQL(criteria.name)}%'`);
    }
    if (criteria.type) {
      conditions.push(`Type = '${this.escapeSOQL(criteria.type)}'`);
    }
    if (criteria.industry) {
      conditions.push(`Industry = '${this.escapeSOQL(criteria.industry)}'`);
    }
    if (criteria.billingCountry) {
      conditions.push(`BillingCountry = '${this.escapeSOQL(criteria.billingCountry)}'`);
    }
    if (criteria.ownerId) {
      conditions.push(`OwnerId = '${criteria.ownerId}'`);
    }
    if (criteria.createdAfter) {
      conditions.push(`CreatedDate >= ${criteria.createdAfter.toISOString()}`);
    }
    if (criteria.modifiedAfter) {
      conditions.push(`LastModifiedDate >= ${criteria.modifiedAfter.toISOString()}`);
    }

    const condition = conditions.length > 0 ? conditions.join(' AND ') : undefined;
    return this.client.queryAccounts(condition);
  }

  /**
   * 関連Opportunityを含めて取得
   */
  async getWithOpportunities(accountId: string): Promise<{
    account: Account | null;
    opportunities: Array<{ Id: string; Name: string; StageName: string; Amount?: number }>;
  }> {
    const accountResult = await this.client.getAccount(accountId);
    if (!accountResult.success || !accountResult.data) {
      return { account: null, opportunities: [] };
    }

    const oppResult = await this.client.queryOpportunities(`AccountId = '${accountId}'`);
    const opportunities = oppResult.success && oppResult.data
      ? oppResult.data.records.map((o) => ({
          Id: o.Id,
          Name: o.Name || '',
          StageName: o.StageName,
          Amount: o.Amount,
        }))
      : [];

    return {
      account: accountResult.data,
      opportunities,
    };
  }

  /**
   * 重複チェック
   */
  async findDuplicates(name: string, website?: string): Promise<Account[]> {
    const conditions: string[] = [`Name = '${this.escapeSOQL(name)}'`];

    if (website) {
      conditions.push(`Website = '${this.escapeSOQL(website)}'`);
    }

    const soql = `SELECT Id, Name, Type, Industry, Website, Phone FROM Account WHERE ${conditions.join(' OR ')}`;
    const result = await this.client.query<Account>(soql);

    return result.success && result.data ? result.data.records : [];
  }

  /**
   * バルク作成
   */
  async bulkCreate(accounts: Partial<Account>[]): Promise<{
    success: number;
    failed: number;
    results: Array<{ success: boolean; id?: string; error?: string }>;
  }> {
    const results: Array<{ success: boolean; id?: string; error?: string }> = [];
    let success = 0;
    let failed = 0;

    for (const account of accounts) {
      try {
        const result = await this.client.createAccount(account);
        if (result.success && result.data) {
          results.push({ success: true, id: result.data.id });
          success++;
        } else {
          results.push({ success: false, error: result.error?.message });
          failed++;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        results.push({ success: false, error: err.message });
        failed++;
      }
    }

    this.logger.info('Bulk create completed', { success, failed, total: accounts.length });
    return { success, failed, results };
  }

  /**
   * 統計情報を取得
   */
  async getStats(): Promise<AccountStats> {
    const result = await this.client.queryAccounts();
    if (!result.success || !result.data) {
      return { totalCount: 0, byType: {}, byIndustry: {}, byCountry: {} };
    }

    const accounts = result.data.records;
    const stats: AccountStats = {
      totalCount: accounts.length,
      byType: {},
      byIndustry: {},
      byCountry: {},
    };

    for (const account of accounts) {
      if (account.Type) {
        stats.byType[account.Type] = (stats.byType[account.Type] || 0) + 1;
      }
      if (account.Industry) {
        stats.byIndustry[account.Industry] = (stats.byIndustry[account.Industry] || 0) + 1;
      }
      if (account.BillingCountry) {
        stats.byCountry[account.BillingCountry] = (stats.byCountry[account.BillingCountry] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * 階層構造を取得（親子関係）
   */
  async getHierarchy(accountId: string): Promise<{
    parent?: Account;
    current: Account | null;
    children: Account[];
  }> {
    const currentResult = await this.client.getAccount(accountId);
    if (!currentResult.success || !currentResult.data) {
      return { current: null, children: [] };
    }

    const current = currentResult.data;
    let parent: Account | undefined;

    // 親を取得
    const parentId = (current as Record<string, unknown>).ParentId as string | undefined;
    if (parentId) {
      const parentResult = await this.client.getAccount(parentId);
      if (parentResult.success && parentResult.data) {
        parent = parentResult.data;
      }
    }

    // 子を取得
    const childrenResult = await this.client.query<Account>(
      `SELECT Id, Name, Type, Industry FROM Account WHERE ParentId = '${accountId}'`
    );
    const children = childrenResult.success && childrenResult.data
      ? childrenResult.data.records
      : [];

    return { parent, current, children };
  }

  /**
   * SOQLエスケープ
   */
  private escapeSOQL(value: string): string {
    return value.replace(/'/g, "\\'");
  }
}

export function createAccountHandler(client: SalesforceRestClient, logger?: Logger): AccountHandler {
  return new AccountHandler(client, logger);
}
