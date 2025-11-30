/**
 * Salesforce Opportunity Handler
 * Opportunity オブジェクトの高度な操作
 */

import type { Opportunity, ApiResponse, SalesforceQueryResult, Task } from '../../types';
import { SalesforceRestClient } from '../mcp/SalesforceMCPClient';
import { Logger } from '../../common';

export interface OpportunitySearchCriteria {
  name?: string;
  accountId?: string;
  stageName?: string;
  minAmount?: number;
  maxAmount?: number;
  closeDateFrom?: Date;
  closeDateTo?: Date;
  ownerId?: string;
}

export interface OpportunityPipeline {
  stage: string;
  count: number;
  totalAmount: number;
  weightedAmount: number;
}

export interface SalesForecast {
  period: string;
  closedWon: number;
  pipeline: number;
  weighted: number;
  opportunities: Array<{
    id: string;
    name: string;
    amount: number;
    probability: number;
    closeDate: string;
    stage: string;
  }>;
}

/**
 * Opportunity Handler
 */
export class OpportunityHandler {
  private client: SalesforceRestClient;
  private logger: Logger;

  constructor(client: SalesforceRestClient, logger?: Logger) {
    this.client = client;
    this.logger = (logger || Logger.getInstance()).child('OpportunityHandler');
  }

  /**
   * 高度な検索
   */
  async search(criteria: OpportunitySearchCriteria): Promise<ApiResponse<SalesforceQueryResult<Opportunity>>> {
    const conditions: string[] = [];

    if (criteria.name) {
      conditions.push(`Name LIKE '%${this.escapeSOQL(criteria.name)}%'`);
    }
    if (criteria.accountId) {
      conditions.push(`AccountId = '${criteria.accountId}'`);
    }
    if (criteria.stageName) {
      conditions.push(`StageName = '${this.escapeSOQL(criteria.stageName)}'`);
    }
    if (criteria.minAmount !== undefined) {
      conditions.push(`Amount >= ${criteria.minAmount}`);
    }
    if (criteria.maxAmount !== undefined) {
      conditions.push(`Amount <= ${criteria.maxAmount}`);
    }
    if (criteria.closeDateFrom) {
      conditions.push(`CloseDate >= ${criteria.closeDateFrom.toISOString().split('T')[0]}`);
    }
    if (criteria.closeDateTo) {
      conditions.push(`CloseDate <= ${criteria.closeDateTo.toISOString().split('T')[0]}`);
    }
    if (criteria.ownerId) {
      conditions.push(`OwnerId = '${criteria.ownerId}'`);
    }

    const condition = conditions.length > 0 ? conditions.join(' AND ') : undefined;
    return this.client.queryOpportunities(condition);
  }

  /**
   * パイプライン分析
   */
  async getPipeline(): Promise<OpportunityPipeline[]> {
    const result = await this.client.queryOpportunities("IsClosed = false");
    if (!result.success || !result.data) {
      return [];
    }

    const stageMap = new Map<string, OpportunityPipeline>();

    for (const opp of result.data.records) {
      const stage = opp.StageName;
      const amount = opp.Amount || 0;
      const probability = opp.Probability || 0;

      if (!stageMap.has(stage)) {
        stageMap.set(stage, {
          stage,
          count: 0,
          totalAmount: 0,
          weightedAmount: 0,
        });
      }

      const pipeline = stageMap.get(stage)!;
      pipeline.count++;
      pipeline.totalAmount += amount;
      pipeline.weightedAmount += amount * (probability / 100);
    }

    return Array.from(stageMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * 売上予測を取得
   */
  async getForecast(year: number, quarter?: number): Promise<SalesForecast> {
    let startDate: Date;
    let endDate: Date;
    let period: string;

    if (quarter) {
      const quarterStartMonth = (quarter - 1) * 3;
      startDate = new Date(year, quarterStartMonth, 1);
      endDate = new Date(year, quarterStartMonth + 3, 0);
      period = `Q${quarter} ${year}`;
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
      period = `FY${year}`;
    }

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    const condition = `CloseDate >= ${dateFrom} AND CloseDate <= ${dateTo}`;
    const result = await this.client.queryOpportunities(condition);

    if (!result.success || !result.data) {
      return { period, closedWon: 0, pipeline: 0, weighted: 0, opportunities: [] };
    }

    let closedWon = 0;
    let pipeline = 0;
    let weighted = 0;
    const opportunities: SalesForecast['opportunities'] = [];

    for (const opp of result.data.records) {
      const amount = opp.Amount || 0;
      const probability = opp.Probability || 0;

      if (opp.StageName === 'Closed Won') {
        closedWon += amount;
      } else if (opp.StageName !== 'Closed Lost') {
        pipeline += amount;
        weighted += amount * (probability / 100);
      }

      opportunities.push({
        id: opp.Id,
        name: opp.Name || '',
        amount,
        probability,
        closeDate: opp.CloseDate,
        stage: opp.StageName,
      });
    }

    return { period, closedWon, pipeline, weighted, opportunities };
  }

  /**
   * ステージ変更
   */
  async updateStage(opportunityId: string, newStage: string, notes?: string): Promise<ApiResponse<null>> {
    const updateData: Partial<Opportunity> = {
      StageName: newStage,
    };

    if (notes) {
      updateData.Description = notes;
    }

    const result = await this.client.updateOpportunity(opportunityId, updateData);

    if (result.success) {
      this.logger.info('Opportunity stage updated', { opportunityId, newStage });

      // フォローアップタスクを作成（特定のステージの場合）
      if (newStage === 'Proposal/Price Quote' || newStage === 'Negotiation/Review') {
        await this.createFollowUpTask(opportunityId, newStage);
      }
    }

    return result;
  }

  /**
   * フォローアップタスク作成
   */
  private async createFollowUpTask(opportunityId: string, stage: string): Promise<void> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // 3日後

    const task: Partial<Task> = {
      Subject: `Follow up on ${stage}`,
      WhatId: opportunityId,
      ActivityDate: dueDate.toISOString().split('T')[0],
      Priority: 'High',
      Status: 'Not Started',
      Description: `Auto-generated follow-up task for opportunity stage: ${stage}`,
    };

    await this.client.createTask(task);
    this.logger.info('Follow-up task created', { opportunityId, stage });
  }

  /**
   * 関連アクティビティを取得
   */
  async getActivities(opportunityId: string): Promise<Task[]> {
    const result = await this.client.queryTasks(`WhatId = '${opportunityId}'`);
    return result.success && result.data ? result.data.records : [];
  }

  /**
   * 勝率分析
   */
  async getWinRateAnalysis(): Promise<{
    overallWinRate: number;
    byStage: Record<string, { total: number; won: number; rate: number }>;
    byAmount: Array<{ range: string; winRate: number; count: number }>;
  }> {
    const closedResult = await this.client.queryOpportunities("IsClosed = true");
    if (!closedResult.success || !closedResult.data) {
      return { overallWinRate: 0, byStage: {}, byAmount: [] };
    }

    const opportunities = closedResult.data.records;
    let totalClosed = 0;
    let totalWon = 0;

    const stageAnalysis: Record<string, { total: number; won: number }> = {};
    const amountBuckets = [
      { range: '< $10K', min: 0, max: 10000, won: 0, total: 0 },
      { range: '$10K - $50K', min: 10000, max: 50000, won: 0, total: 0 },
      { range: '$50K - $100K', min: 50000, max: 100000, won: 0, total: 0 },
      { range: '> $100K', min: 100000, max: Infinity, won: 0, total: 0 },
    ];

    for (const opp of opportunities) {
      totalClosed++;
      const isWon = opp.StageName === 'Closed Won';
      if (isWon) totalWon++;

      // Amount bucket
      const amount = opp.Amount || 0;
      for (const bucket of amountBuckets) {
        if (amount >= bucket.min && amount < bucket.max) {
          bucket.total++;
          if (isWon) bucket.won++;
          break;
        }
      }
    }

    const byStage: Record<string, { total: number; won: number; rate: number }> = {};
    for (const [stage, data] of Object.entries(stageAnalysis)) {
      byStage[stage] = {
        ...data,
        rate: data.total > 0 ? (data.won / data.total) * 100 : 0,
      };
    }

    const byAmount = amountBuckets.map((bucket) => ({
      range: bucket.range,
      winRate: bucket.total > 0 ? (bucket.won / bucket.total) * 100 : 0,
      count: bucket.total,
    }));

    return {
      overallWinRate: totalClosed > 0 ? (totalWon / totalClosed) * 100 : 0,
      byStage,
      byAmount,
    };
  }

  /**
   * SOQLエスケープ
   */
  private escapeSOQL(value: string): string {
    return value.replace(/'/g, "\\'");
  }
}

export function createOpportunityHandler(client: SalesforceRestClient, logger?: Logger): OpportunityHandler {
  return new OpportunityHandler(client, logger);
}
