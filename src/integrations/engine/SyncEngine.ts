/**
 * Sync Engine
 * Salesforce ↔ Lark データ同期エンジン
 */

import type {
  SyncConfig,
  SyncJob,
  SyncResult,
  ObjectMapping,
  ConflictResolution,
  ApiResponse,
  SalesforceObject,
} from '../types';
import { SalesforceMCPClient } from '../salesforce';
import { LarkApiClient } from '../lark';
import { Logger, DeadLetterQueue } from '../common';

/**
 * 同期エンジン
 */
export class SyncEngine {
  private sfClient: SalesforceMCPClient;
  private larkClient: LarkApiClient;
  private logger: Logger;
  private dlq: DeadLetterQueue<SyncJob>;
  private config: SyncConfig;
  private jobs: Map<string, SyncJob> = new Map();

  constructor(
    sfClient: SalesforceMCPClient,
    larkClient: LarkApiClient,
    config: SyncConfig,
    logger?: Logger
  ) {
    this.sfClient = sfClient;
    this.larkClient = larkClient;
    this.config = config;
    this.logger = (logger || Logger.getInstance()).child('SyncEngine');
    this.dlq = new DeadLetterQueue(1000, this.logger);
  }

  /**
   * 同期ジョブを開始
   */
  async startSync(mapping: ObjectMapping): Promise<SyncJob> {
    const jobId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: SyncJob = {
      id: jobId,
      status: 'pending',
      mapping,
      startTime: new Date(),
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
    };

    this.jobs.set(jobId, job);
    this.logger.info(`Sync job started: ${jobId}`, { mapping: mapping.sourceObject });

    // 非同期で実行
    this.executeSync(job).catch((error) => {
      this.logger.error(`Sync job failed: ${jobId}`, error);
    });

    return job;
  }

  /**
   * 同期を実行
   */
  private async executeSync(job: SyncJob): Promise<void> {
    job.status = 'running';

    try {
      const { mapping } = job;
      const direction = mapping.direction || 'bidirectional';

      if (direction === 'sf_to_lark' || direction === 'bidirectional') {
        await this.syncSalesforceToLark(job);
      }

      if (direction === 'lark_to_sf' || direction === 'bidirectional') {
        await this.syncLarkToSalesforce(job);
      }

      job.status = job.recordsFailed > 0 ? 'completed_with_errors' : 'completed';
      job.endTime = new Date();

      this.logger.info(`Sync job completed: ${job.id}`, {
        processed: job.recordsProcessed,
        failed: job.recordsFailed,
      });
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      const err = error instanceof Error ? error : new Error(String(error));
      job.errors.push(err.message);

      // DLQに追加
      this.dlq.add(job, err, 'SyncEngine');
      throw error;
    }
  }

  /**
   * Salesforce → Lark 同期
   */
  private async syncSalesforceToLark(job: SyncJob): Promise<void> {
    const { mapping } = job;

    // Salesforceからデータ取得
    const result = await this.querySalesforce(mapping.sourceObject, mapping.filter);

    if (!result.success || !result.data) {
      throw new Error(`Failed to query Salesforce: ${result.error?.message}`);
    }

    const records = result.data.records;
    this.logger.info(`Fetched ${records.length} records from Salesforce`);

    for (const record of records) {
      try {
        await this.pushToLark(record, mapping);
        job.recordsProcessed++;
      } catch (error) {
        job.recordsFailed++;
        const err = error instanceof Error ? error : new Error(String(error));
        job.errors.push(`Record ${record.Id}: ${err.message}`);
        this.logger.warn(`Failed to sync record ${record.Id}`, { error: err.message });
      }
    }
  }

  /**
   * Lark → Salesforce 同期
   */
  private async syncLarkToSalesforce(_job: SyncJob): Promise<void> {
    // Larkからのデータ取得は主にWebhook経由
    // ここではポーリングベースの実装（必要に応じて）
    this.logger.info('Lark to Salesforce sync (webhook-based)');
  }

  /**
   * Salesforceクエリ実行
   */
  private async querySalesforce(
    objectType: string,
    filter?: string
  ): Promise<ApiResponse<{ records: SalesforceObject[] }>> {
    const rest = this.sfClient.getRest();

    switch (objectType) {
      case 'Account':
        return rest.queryAccounts(filter) as unknown as ApiResponse<{ records: SalesforceObject[] }>;
      case 'Opportunity':
        return rest.queryOpportunities(filter) as unknown as ApiResponse<{ records: SalesforceObject[] }>;
      case 'Task':
        return rest.queryTasks(filter) as unknown as ApiResponse<{ records: SalesforceObject[] }>;
      case 'Case':
        return rest.queryCases(filter) as unknown as ApiResponse<{ records: SalesforceObject[] }>;
      default:
        const soql = `SELECT Id, Name FROM ${objectType}${filter ? ` WHERE ${filter}` : ''} LIMIT 100`;
        return rest.query(soql) as unknown as ApiResponse<{ records: SalesforceObject[] }>;
    }
  }

  /**
   * Larkにデータをプッシュ
   */
  private async pushToLark(record: SalesforceObject, mapping: ObjectMapping): Promise<void> {
    const { targetObject, fieldMappings, notificationChatId } = mapping;

    // フィールドマッピングを適用
    const mappedData = this.applyFieldMappings(record, fieldMappings);

    // 通知先チャットIDが指定されている場合はメッセージ送信
    if (notificationChatId) {
      const message = this.formatNotificationMessage(record, targetObject);
      await this.larkClient.sendTextMessage(notificationChatId, message);
    }

    this.logger.debug(`Pushed record to Lark`, { recordId: record.Id, target: targetObject });
  }

  /**
   * フィールドマッピングを適用
   */
  private applyFieldMappings(
    record: SalesforceObject,
    fieldMappings: ObjectMapping['fieldMappings']
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of fieldMappings) {
      const sourceValue = (record as Record<string, unknown>)[mapping.sourceField];

      if (mapping.transform) {
        result[mapping.targetField] = mapping.transform(sourceValue);
      } else {
        result[mapping.targetField] = sourceValue;
      }
    }

    return result;
  }

  /**
   * 通知メッセージをフォーマット
   */
  private formatNotificationMessage(record: SalesforceObject, targetObject: string): string {
    const recordData = record as Record<string, unknown>;
    const name = recordData.Name || recordData.Subject || record.Id;

    return `[Salesforce Sync] ${targetObject}: ${name}\nID: ${record.Id}\nUpdated: ${new Date().toISOString()}`;
  }

  /**
   * コンフリクト解決
   */
  resolveConflict(
    sourceData: Record<string, unknown>,
    targetData: Record<string, unknown>,
    strategy: ConflictResolution
  ): Record<string, unknown> {
    switch (strategy) {
      case 'source_wins':
        return { ...targetData, ...sourceData };
      case 'target_wins':
        return { ...sourceData, ...targetData };
      case 'latest_wins':
        const sourceTime = new Date(sourceData.LastModifiedDate as string).getTime();
        const targetTime = new Date(targetData.LastModifiedDate as string).getTime();
        return sourceTime > targetTime
          ? { ...targetData, ...sourceData }
          : { ...sourceData, ...targetData };
      case 'manual':
      default:
        // マニュアル解決が必要な場合はソースを返す（後でレビュー）
        return sourceData;
    }
  }

  /**
   * ジョブステータスを取得
   */
  getJobStatus(jobId: string): SyncJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * 全ジョブを取得
   */
  getAllJobs(): SyncJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * DLQアイテムを取得
   */
  getDeadLetterItems(): ReturnType<typeof this.dlq.getAll> {
    return this.dlq.getAll();
  }

  /**
   * DLQアイテムを再試行
   */
  async retryDeadLetterItem(id: string): Promise<boolean> {
    const item = this.dlq.get(id);
    if (!item) return false;

    try {
      await this.executeSync(item.payload);
      this.dlq.remove(id);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 同期エンジンを作成
 */
export function createSyncEngine(
  sfClient: SalesforceMCPClient,
  larkClient: LarkApiClient,
  config: SyncConfig,
  logger?: Logger
): SyncEngine {
  return new SyncEngine(sfClient, larkClient, config, logger);
}
