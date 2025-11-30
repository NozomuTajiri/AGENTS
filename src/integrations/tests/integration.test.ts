/**
 * Integration Tests
 * Salesforce ↔ Lark 統合テスト
 */

import type {
  SalesforceConfig,
  LarkConfig,
  SyncConfig,
  WebhookConfig,
  Account,
  Opportunity,
  ObjectMapping,
} from '../types';
import { SalesforceLarkIntegration, createIntegration } from '../index';
import { Logger } from '../common';

// テスト設定
const TEST_SF_CONFIG: SalesforceConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  instanceUrl: 'https://test.salesforce.com',
  apiVersion: '58.0',
  sandbox: true,
};

const TEST_LARK_CONFIG: LarkConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  appId: 'test-app-id',
  appSecret: 'test-app-secret',
};

const TEST_SYNC_CONFIG: SyncConfig = {
  source: 'salesforce',
  target: 'lark',
  objectMapping: [],
  syncMode: 'batch',
  batchInterval: 60,
};

const TEST_WEBHOOK_CONFIG: WebhookConfig = {
  notificationChatId: 'test-chat-id',
  sendWelcomeMessage: true,
  enableSalesforceNotifications: true,
  enableLarkCommands: true,
};

/**
 * テストランナー
 */
export class IntegrationTestRunner {
  private logger: Logger;
  private results: TestResult[] = [];

  constructor(logger?: Logger) {
    this.logger = (logger || Logger.getInstance()).child('IntegrationTestRunner');
  }

  /**
   * 全テスト実行
   */
  async runAll(): Promise<TestSummary> {
    this.results = [];
    this.logger.info('Starting integration tests');

    // 初期化テスト
    await this.runTest('Integration Initialization', this.testInitialization.bind(this));

    // クライアント取得テスト
    await this.runTest('Client Accessors', this.testClientAccessors.bind(this));

    // 型定義テスト
    await this.runTest('Type Definitions', this.testTypeDefinitions.bind(this));

    // オブジェクトマッピングテスト
    await this.runTest('Object Mapping', this.testObjectMapping.bind(this));

    // エラーハンドリングテスト
    await this.runTest('Error Handling', this.testErrorHandling.bind(this));

    // ログ機能テスト
    await this.runTest('Logging', this.testLogging.bind(this));

    return this.getSummary();
  }

  /**
   * 個別テスト実行
   */
  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      this.results.push({
        name,
        passed: true,
        duration: Date.now() - startTime,
      });
      this.logger.info(`✓ ${name} passed`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.results.push({
        name,
        passed: false,
        duration: Date.now() - startTime,
        error: err.message,
      });
      this.logger.error(`✗ ${name} failed`, err);
    }
  }

  /**
   * 初期化テスト
   */
  private async testInitialization(): Promise<void> {
    const integration = createIntegration({
      salesforce: TEST_SF_CONFIG,
      lark: TEST_LARK_CONFIG,
      sync: TEST_SYNC_CONFIG,
      webhook: TEST_WEBHOOK_CONFIG,
    });

    assert(integration !== null, 'Integration should be created');
    assert(integration instanceof SalesforceLarkIntegration, 'Should be SalesforceLarkIntegration instance');
  }

  /**
   * クライアントアクセサテスト
   */
  private async testClientAccessors(): Promise<void> {
    const integration = createIntegration({
      salesforce: TEST_SF_CONFIG,
      lark: TEST_LARK_CONFIG,
    });

    const sfClient = integration.getSalesforce();
    assert(sfClient !== null, 'Salesforce client should be accessible');

    const larkClient = integration.getLark();
    assert(larkClient !== null, 'Lark client should be accessible');
  }

  /**
   * 型定義テスト
   */
  private async testTypeDefinitions(): Promise<void> {
    // Account型
    const account: Account = {
      Id: '001xxx',
      Name: 'Test Account',
      Type: 'Customer',
      Industry: 'Technology',
    };
    assert(account.Id === '001xxx', 'Account ID should match');

    // Opportunity型
    const opportunity: Opportunity = {
      Id: '006xxx',
      Name: 'Test Opportunity',
      StageName: 'Prospecting',
      CloseDate: '2024-12-31',
      Amount: 100000,
    };
    assert(opportunity.StageName === 'Prospecting', 'Opportunity stage should match');

    // ObjectMapping型
    const mapping: ObjectMapping = {
      sourceObject: 'Account',
      targetObject: 'LarkContact',
      fieldMappings: [
        { sourceField: 'Name', targetField: 'name' },
        { sourceField: 'Phone', targetField: 'phone' },
      ],
    };
    assert(mapping.fieldMappings.length === 2, 'Field mappings should have 2 entries');
  }

  /**
   * オブジェクトマッピングテスト
   */
  private async testObjectMapping(): Promise<void> {
    const mapping: ObjectMapping = {
      sourceObject: 'Opportunity',
      targetObject: 'LarkDeal',
      fieldMappings: [
        { sourceField: 'Name', targetField: 'title' },
        {
          sourceField: 'Amount',
          targetField: 'value',
          transform: (val) => `$${val}`,
        },
      ],
      direction: 'sf_to_lark',
      notificationChatId: 'chat-xxx',
    };

    assert(mapping.direction === 'sf_to_lark', 'Direction should match');
    assert(mapping.fieldMappings[1].transform !== undefined, 'Transform should be defined');

    // Transform function test
    const transformedValue = mapping.fieldMappings[1].transform!(50000);
    assert(transformedValue === '$50000', 'Transform should format value');
  }

  /**
   * エラーハンドリングテスト
   */
  private async testErrorHandling(): Promise<void> {
    const integration = createIntegration({
      salesforce: TEST_SF_CONFIG,
      lark: TEST_LARK_CONFIG,
    });

    // Sync without engine should return null
    const syncResult = await integration.startSync({
      sourceObject: 'Account',
      targetObject: 'LarkContact',
      fieldMappings: [],
    });
    assert(syncResult === null, 'Sync without engine should return null');

    // Webhook without handler should return empty
    const webhookResult = await integration.handleLarkWebhook({});
    assert(Object.keys(webhookResult).length === 0, 'Webhook without handler should return empty');
  }

  /**
   * ログ機能テスト
   */
  private async testLogging(): Promise<void> {
    const logger = Logger.getInstance();

    // ログレベル設定
    logger.setLevel('debug');
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');

    // 子ロガー作成
    const childLogger = logger.child('TestChild');
    childLogger.info('Child logger message');

    // ログ履歴取得
    const logs = logger.getLogs('info', 10);
    assert(logs.length > 0, 'Should have log entries');
  }

  /**
   * テストサマリーを取得
   */
  private getSummary(): TestSummary {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      total: this.results.length,
      passed,
      failed,
      duration: totalDuration,
      results: this.results,
    };
  }
}

/**
 * テスト結果
 */
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

/**
 * テストサマリー
 */
interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
}

/**
 * アサーション
 */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * テスト実行エントリーポイント
 */
export async function runIntegrationTests(): Promise<TestSummary> {
  const runner = new IntegrationTestRunner();
  const summary = await runner.runAll();

  console.log('\n========================================');
  console.log('Integration Test Results');
  console.log('========================================');
  console.log(`Total: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Duration: ${summary.duration}ms`);
  console.log('========================================\n');

  if (summary.failed > 0) {
    console.log('Failed Tests:');
    for (const result of summary.results.filter((r) => !r.passed)) {
      console.log(`  - ${result.name}: ${result.error}`);
    }
  }

  return summary;
}
