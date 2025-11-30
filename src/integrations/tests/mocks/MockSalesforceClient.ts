/**
 * Mock Salesforce Client
 * テスト用モッククライアント
 */

import type {
  Account,
  Opportunity,
  Task,
  Case,
  SalesforceQueryResult,
  ApiResponse,
} from '../../types';

/**
 * Mock データ
 */
const MOCK_ACCOUNTS: Account[] = [
  {
    Id: '001000000000001',
    Name: 'Acme Corporation',
    Type: 'Customer - Direct',
    Industry: 'Technology',
    BillingCountry: 'USA',
    Phone: '+1-555-0100',
    Website: 'https://acme.example.com',
  },
  {
    Id: '001000000000002',
    Name: 'Global Industries',
    Type: 'Customer - Channel',
    Industry: 'Manufacturing',
    BillingCountry: 'Japan',
    Phone: '+81-3-1234-5678',
  },
  {
    Id: '001000000000003',
    Name: 'Tech Startup Inc',
    Type: 'Prospect',
    Industry: 'Technology',
    BillingCountry: 'USA',
  },
];

const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    Id: '006000000000001',
    Name: 'Acme - Enterprise License',
    AccountId: '001000000000001',
    StageName: 'Negotiation/Review',
    Amount: 150000,
    CloseDate: '2024-03-31',
    Probability: 75,
  },
  {
    Id: '006000000000002',
    Name: 'Global - Annual Contract',
    AccountId: '001000000000002',
    StageName: 'Proposal/Price Quote',
    Amount: 80000,
    CloseDate: '2024-02-28',
    Probability: 50,
  },
  {
    Id: '006000000000003',
    Name: 'Tech Startup - Pilot',
    AccountId: '001000000000003',
    StageName: 'Prospecting',
    Amount: 25000,
    CloseDate: '2024-04-30',
    Probability: 20,
  },
  {
    Id: '006000000000004',
    Name: 'Acme - Support Extension',
    AccountId: '001000000000001',
    StageName: 'Closed Won',
    Amount: 30000,
    CloseDate: '2024-01-15',
    Probability: 100,
  },
];

const MOCK_TASKS: Task[] = [
  {
    Id: '00T000000000001',
    Subject: 'Follow up on proposal',
    Status: 'Not Started',
    Priority: 'High',
    WhatId: '006000000000001',
    ActivityDate: '2024-02-01',
  },
  {
    Id: '00T000000000002',
    Subject: 'Schedule demo',
    Status: 'In Progress',
    Priority: 'Medium',
    WhatId: '006000000000003',
    ActivityDate: '2024-02-05',
  },
];

const MOCK_CASES: Case[] = [
  {
    Id: '500000000000001',
    Subject: 'Cannot access dashboard',
    Status: 'New',
    Priority: 'High',
    Origin: 'Web',
    Type: 'Problem',
    AccountId: '001000000000001',
  },
];

/**
 * Mock Salesforce Client
 */
export class MockSalesforceClient {
  private accounts = [...MOCK_ACCOUNTS];
  private opportunities = [...MOCK_OPPORTUNITIES];
  private tasks = [...MOCK_TASKS];
  private cases = [...MOCK_CASES];

  // Account methods
  async getAccount(id: string): Promise<ApiResponse<Account>> {
    const account = this.accounts.find((a) => a.Id === id);
    return account
      ? this.success(account)
      : this.error('Account not found');
  }

  async queryAccounts(conditions?: string): Promise<ApiResponse<SalesforceQueryResult<Account>>> {
    let filtered = this.accounts;
    if (conditions) {
      filtered = this.applyConditions(filtered, conditions);
    }
    return this.success(this.toQueryResult(filtered));
  }

  async createAccount(data: Partial<Account>): Promise<ApiResponse<{ id: string; success: boolean }>> {
    const id = `001${Date.now()}`;
    const account: Account = {
      Id: id,
      Name: data.Name || 'New Account',
      ...data,
    };
    this.accounts.push(account);
    return this.success({ id, success: true });
  }

  async updateAccount(id: string, data: Partial<Account>): Promise<ApiResponse<null>> {
    const index = this.accounts.findIndex((a) => a.Id === id);
    if (index === -1) {
      return this.error('Account not found');
    }
    this.accounts[index] = { ...this.accounts[index], ...data };
    return this.success(null);
  }

  // Opportunity methods
  async getOpportunity(id: string): Promise<ApiResponse<Opportunity>> {
    const opp = this.opportunities.find((o) => o.Id === id);
    return opp
      ? this.success(opp)
      : this.error('Opportunity not found');
  }

  async queryOpportunities(conditions?: string): Promise<ApiResponse<SalesforceQueryResult<Opportunity>>> {
    let filtered = this.opportunities;
    if (conditions) {
      filtered = this.applyConditions(filtered, conditions);
    }
    return this.success(this.toQueryResult(filtered));
  }

  async createOpportunity(data: Partial<Opportunity>): Promise<ApiResponse<{ id: string; success: boolean }>> {
    const id = `006${Date.now()}`;
    const opp: Opportunity = {
      Id: id,
      Name: data.Name || 'New Opportunity',
      StageName: data.StageName || 'Prospecting',
      CloseDate: data.CloseDate || new Date().toISOString().split('T')[0],
      ...data,
    };
    this.opportunities.push(opp);
    return this.success({ id, success: true });
  }

  // Task methods
  async queryTasks(conditions?: string): Promise<ApiResponse<SalesforceQueryResult<Task>>> {
    let filtered = this.tasks;
    if (conditions) {
      filtered = this.applyConditions(filtered, conditions);
    }
    return this.success(this.toQueryResult(filtered));
  }

  async createTask(data: Partial<Task>): Promise<ApiResponse<{ id: string; success: boolean }>> {
    const id = `00T${Date.now()}`;
    const task: Task = {
      Id: id,
      Subject: data.Subject || 'New Task',
      Status: data.Status || 'Not Started',
      ...data,
    };
    this.tasks.push(task);
    return this.success({ id, success: true });
  }

  // Case methods
  async queryCases(conditions?: string): Promise<ApiResponse<SalesforceQueryResult<Case>>> {
    let filtered = this.cases;
    if (conditions) {
      filtered = this.applyConditions(filtered, conditions);
    }
    return this.success(this.toQueryResult(filtered));
  }

  // Generic query
  async query<T>(soql: string): Promise<ApiResponse<{ totalSize: number; done: boolean; records: T[] }>> {
    // 簡易SOQL解析
    if (soql.includes('Account')) {
      return this.queryAccounts() as unknown as Promise<ApiResponse<{ totalSize: number; done: boolean; records: T[] }>>;
    }
    if (soql.includes('Opportunity')) {
      return this.queryOpportunities() as unknown as Promise<ApiResponse<{ totalSize: number; done: boolean; records: T[] }>>;
    }
    return this.success({ totalSize: 0, done: true, records: [] as T[] });
  }

  // Helper methods
  private success<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        requestId: `mock_${Date.now()}`,
        timestamp: new Date(),
        latency: Math.random() * 100,
      },
    };
  }

  private error<T>(message: string): ApiResponse<T> {
    return {
      success: false,
      error: {
        code: 'MOCK_ERROR',
        message,
      },
      metadata: {
        requestId: `mock_${Date.now()}`,
        timestamp: new Date(),
        latency: 0,
      },
    };
  }

  private toQueryResult<T>(records: T[]): { totalSize: number; done: boolean; records: T[] } {
    return {
      totalSize: records.length,
      done: true,
      records,
    };
  }

  private applyConditions<T extends Record<string, unknown>>(items: T[], conditions: string): T[] {
    // 簡易条件解析
    if (conditions.includes('IsClosed = false')) {
      return items.filter((item) =>
        !String(item.StageName || '').includes('Closed')
      );
    }
    if (conditions.includes('IsClosed = true')) {
      return items.filter((item) =>
        String(item.StageName || '').includes('Closed')
      );
    }
    if (conditions.includes("Status != 'Completed'")) {
      return items.filter((item) => item.Status !== 'Completed');
    }
    return items;
  }

  // Reset to initial state
  reset(): void {
    this.accounts = [...MOCK_ACCOUNTS];
    this.opportunities = [...MOCK_OPPORTUNITIES];
    this.tasks = [...MOCK_TASKS];
    this.cases = [...MOCK_CASES];
  }

  // Get all data (for assertions)
  getAllAccounts(): Account[] {
    return this.accounts;
  }

  getAllOpportunities(): Opportunity[] {
    return this.opportunities;
  }
}

export function createMockSalesforceClient(): MockSalesforceClient {
  return new MockSalesforceClient();
}
