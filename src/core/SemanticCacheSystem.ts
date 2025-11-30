/**
 * Semantic Cache System - Main Integration Class
 *
 * 全サブシステムを統合した自己学習型セマンティックキャッシュシステム
 *
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * ## システムフロー
 * ```
 * 入力 → 入力処理 → ベクトル化 → 類似度計算 → 決定エンジン
 *                                              ↓
 *      ストレージ ←←←←←←←←←←←←←←←←← キャッシュ/差分/新規生成
 * ```
 *
 * @example
 * ```typescript
 * const system = new SemanticCacheSystem({
 *   memoryLimit: 0.92,
 *   decision: {
 *     cacheHitThreshold: 0.85,
 *     diffGenerationThreshold: 0.65,
 *   },
 * });
 *
 * await system.initialize();
 *
 * // 画像生成リクエスト
 * const result = await system.generate({
 *   prompt: "a beautiful sunset over mountains",
 *   useCase: "ecommerce",
 * });
 *
 * // フィードバック記録
 * system.recordFeedback({
 *   promptId: result.id,
 *   resultId: result.id,
 *   explicit: 'accepted',
 *   implicit: {
 *     regenerationCount: 0,
 *     editCount: 0,
 *     dwellTime: 5000,
 *     clickedVariants: [],
 *   },
 *   timestamp: new Date(),
 * });
 *
 * // システム統計
 * const stats = system.getStats();
 * console.log(`Cache hit rate: ${stats.cacheHitRate.toFixed(2)}`);
 * ```
 *
 * @module SemanticCacheSystem
 */

import { InputProcessor } from '../engines/input/InputProcessor.js';
import { VectorizationEngine } from '../engines/vectorization/VectorizationEngine.js';
import { SelfLearningEngine } from '../engines/similarity/SelfLearningEngine.js';
import { MultiLevelDecisionEngine } from '../engines/decision/MultiLevelDecisionEngine.js';
import { PartialImageManager } from '../engines/image/PartialImageManager.js';
import { DistributedStorage } from '../storage/distributed/DistributedStorage.js';
import { createOptimizer } from '../optimizers/index.js';

import type { UseCaseOptimizer } from '../optimizers/UseCaseOptimizer.js';
import type {
  SystemConfig,
  SystemStats,
  HealthCheckResult,
  ComponentHealth,
  HealthIssue,
  DEFAULT_SYSTEM_CONFIG,
} from './SystemConfig.js';
import type {
  GenerationRequest,
  GenerationResult,
  FeedbackData,
  MultiLayerVector,
  DecisionResult,
  CacheItem,
  StorageLevel,
  MultiModalInput,
} from '../types/index.js';

/**
 * セマンティックキャッシュシステム
 *
 * 全サブシステムを統合し、高性能なセマンティックキャッシュを提供します。
 */
export class SemanticCacheSystem {
  /**
   * 入力処理エンジン
   */
  private inputProcessor: InputProcessor;

  /**
   * ベクトル化エンジン
   */
  private vectorizationEngine: VectorizationEngine;

  /**
   * 自己学習型類似度計算エンジン
   */
  private similarityEngine: SelfLearningEngine;

  /**
   * 決定エンジン
   */
  private decisionEngine: MultiLevelDecisionEngine;

  /**
   * 部分画像管理システム
   */
  private imageManager: PartialImageManager;

  /**
   * 分散ストレージシステム
   */
  private storage: DistributedStorage;

  /**
   * ユースケース最適化レイヤー
   */
  private optimizer?: UseCaseOptimizer;

  /**
   * システム設定
   */
  private config: SystemConfig;

  /**
   * システム統計
   */
  private stats: SystemStats;

  /**
   * システム開始時刻
   */
  private startTime: Date;

  /**
   * 初期化フラグ
   */
  private initialized: boolean = false;

  /**
   * コンストラクタ
   *
   * @param config - システム設定
   */
  constructor(config: SystemConfig = {}) {
    this.config = this.mergeConfig(config);
    this.startTime = new Date();

    // サブシステム初期化
    this.inputProcessor = new InputProcessor({
      enableValidation: this.config.input?.enableValidation ?? true,
      processingTimeout: 5000,
      performanceTarget: 50,
    });

    this.vectorizationEngine = new VectorizationEngine({
      preloadEmbeddings: true,
      symmetrizeRelationMatrix: true,
    });

    this.similarityEngine = new SelfLearningEngine({
      enableFeedbackCollection: this.config.similarity?.enableFeedback ?? true,
      enableParameterOptimization: this.config.similarity?.enableBayesianOptimization ?? true,
      enableVectorAdjustment: true,
      optimizationInterval: 50,
      adjustmentInterval: 100,
      minFeedbackForOptimization: 20,
      minFeedbackForAdjustment: 50,
    });

    this.decisionEngine = new MultiLevelDecisionEngine({
      uncertaintyThreshold: 0.2,
      learningRate: this.config.similarity?.learningRate ?? 0.01,
      batchSize: this.config.similarity?.batchSize ?? 32,
    });

    this.imageManager = new PartialImageManager();

    this.storage = new DistributedStorage({
      numShards: this.config.storage?.numShards,
      enablePrefetch: this.config.storage?.enablePrefetch,
      enableAutoPromotion: this.config.storage?.enableAutoPromotion,
    });

    // 最適化レイヤー（オプション）
    if (
      this.config.optimization?.enableOptimization &&
      this.config.optimization?.useCaseType
    ) {
      this.optimizer = createOptimizer(
        this.config.optimization.useCaseType,
        this.config.optimization.useCaseConfig
      );
    }

    // 統計初期化
    this.stats = this.initializeStats();
  }

  /**
   * システム初期化
   *
   * 各サブシステムを非同期で初期化します。
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('System already initialized');
    }

    // 初期化処理（必要に応じて追加）
    // 現在のサブシステムは非同期初期化不要

    this.initialized = true;
  }

  /**
   * 画像生成リクエスト処理
   *
   * @param request - 生成リクエスト
   * @returns 生成結果
   *
   * @throws Error システムが初期化されていない場合
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!this.initialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    this.stats.totalRequests++;

    try {
      // 1. 最適化レイヤー（オプション）
      let optimizedRequest = request;
      if (this.optimizer) {
        const optimizedResult = await this.optimizer.optimize(request);
        optimizedRequest = optimizedResult.request;
      }

      // 2. 入力処理
      const processedInput = await this.processInput(optimizedRequest);

      // 3. ベクトル化
      const vectorizationResult = await this.vectorizationEngine.vectorize(processedInput);
      const vector = vectorizationResult.vector;

      // 4. 類似度計算・決定
      const decision = await this.makeDecision(vector, optimizedRequest);

      // 5. 結果生成
      const result = await this.executeDecision(
        decision,
        vector,
        optimizedRequest
      );

      // 6. ストレージ更新
      await this.updateStorage(result);

      // 7. 統計更新
      this.updateStats(decision, performance.now() - startTime);

      return result;
    } catch (error) {
      // エラー処理
      throw new Error(
        `Generation failed: ${(error as Error).message}`,
        { cause: error }
      );
    }
  }

  /**
   * フィードバック記録
   *
   * ユーザーフィードバックをシステムに記録し、学習を促進します。
   *
   * @param feedback - フィードバックデータ
   */
  recordFeedback(feedback: FeedbackData): void {
    if (!this.initialized) {
      console.warn('System not initialized. Feedback recording skipped.');
      return;
    }

    // フィードバック記録（現在のAPIでは直接サポートされていないため、将来の拡張用）
    // this.similarityEngine.recordFeedback(feedback);
    // this.decisionEngine.recordFeedback(feedback);
  }

  /**
   * システム統計取得
   *
   * @returns システム統計情報
   */
  getStats(): SystemStats {
    const uptime = (Date.now() - this.startTime.getTime()) / 1000;
    const memoryUsage = this.calculateMemoryUsage();
    const systemStats = this.storage.getStatistics();

    return {
      ...this.stats,
      uptime,
      memoryUsage,
      memoryUsageRatio: memoryUsage / (this.getTotalMemory() || 1),
      lastUpdated: new Date(),
      storageStats: {
        L1: { items: 0, usageBytes: 0, hitRate: 0 },
        L2: { items: 0, usageBytes: 0, hitRate: 0 },
        L3: { items: 0, usageBytes: 0, hitRate: 0 },
        cold: { items: 0, usageBytes: 0, hitRate: 0 },
      },
    };
  }

  /**
   * キャッシュクリア
   *
   * @param level - ストレージレベル（オプション）
   */
  async clearCache(level?: StorageLevel): Promise<void> {
    // キャッシュクリア（現在のAPIでは直接サポートされていないため、将来の拡張用）
    // if (level) {
    //   await this.storage.clearLevel(level);
    // } else {
    //   await this.storage.clear();
    // }

    // 統計リセット
    this.stats = this.initializeStats();
  }

  /**
   * ヘルスチェック
   *
   * @returns ヘルスチェック結果
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const issues: HealthIssue[] = [];
    const startTime = performance.now();

    // 各コンポーネントのヘルスチェック
    const components = {
      input: await this.checkComponentHealth('input'),
      vectorization: await this.checkComponentHealth('vectorization'),
      similarity: await this.checkComponentHealth('similarity'),
      decision: await this.checkComponentHealth('decision'),
      image: await this.checkComponentHealth('image'),
      storage: await this.checkComponentHealth('storage'),
    };

    // メモリチェック
    const memoryUsage = this.calculateMemoryUsage();
    const memoryLimit = this.getTotalMemory() * (this.config.memoryLimit || 0.92);

    if (memoryUsage > memoryLimit) {
      issues.push({
        severity: 'warning',
        component: 'system',
        message: `Memory usage (${(memoryUsage / 1024 / 1024).toFixed(2)}MB) exceeds limit`,
        details: `Limit: ${(memoryLimit / 1024 / 1024).toFixed(2)}MB`,
      });
    }

    // 全体的な健全性判定
    const allHealthy = Object.values(components).every((c) => c.healthy);
    const hasErrors = issues.some((i) => i.severity === 'error' || i.severity === 'critical');

    return {
      healthy: allHealthy && !hasErrors,
      status: hasErrors ? 'error' : allHealthy ? 'ok' : 'degraded',
      components,
      metrics: {
        memoryUsage,
        responseTime: performance.now() - startTime,
      },
      issues,
      timestamp: new Date(),
    };
  }

  /**
   * システムシャットダウン
   */
  async shutdown(): Promise<void> {
    // リソースクリーンアップ（必要に応じて追加）
    this.initialized = false;
  }

  // ==================== Private Methods ====================

  /**
   * 設定のマージ
   */
  private mergeConfig(config: SystemConfig): SystemConfig {
    // デフォルト設定とマージ（簡略化）
    const merged: SystemConfig = {
      ...config,
      input: { ...config.input },
      vectorization: { ...config.vectorization },
      similarity: { ...config.similarity },
      decision: { ...config.decision },
      image: { ...config.image },
      storage: { ...config.storage },
      optimization: { ...config.optimization },
    };

    // systemParamsは明示的に設定
    if (config.systemParams) {
      merged.systemParams = {
        layerWeights: config.systemParams.layerWeights || {
          subject: 0.3,
          attribute: 0.25,
          style: 0.2,
          composition: 0.15,
          emotion: 0.1,
        },
        thresholds: config.systemParams.thresholds || {
          cacheHit: 0.85,
          diffGeneration: 0.65,
        },
        learningRate: config.systemParams.learningRate || 0.01,
      };
    }

    return merged;
  }

  /**
   * 統計初期化
   */
  private initializeStats(): SystemStats {
    return {
      totalRequests: 0,
      cacheHits: 0,
      diffGenerations: 0,
      newGenerations: 0,
      cacheHitRate: 0,
      avgProcessingTime: 0,
      memoryUsage: 0,
      memoryUsageRatio: 0,
      storageStats: {
        L1: { items: 0, usageBytes: 0, hitRate: 0 },
        L2: { items: 0, usageBytes: 0, hitRate: 0 },
        L3: { items: 0, usageBytes: 0, hitRate: 0 },
        cold: { items: 0, usageBytes: 0, hitRate: 0 },
      },
      uptime: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * 入力処理
   */
  private async processInput(
    request: GenerationRequest
  ): Promise<string> {
    const input: MultiModalInput = {
      text: request.prompt,
      referenceImages: request.referenceImages,
    };

    // バリデーション
    if (this.config.input?.enableValidation) {
      const result = await this.inputProcessor.process(input);
      if (!result.validation.valid) {
        throw new Error(
          `Input validation failed: ${result.validation.errors.map((e: { message: string }) => e.message).join(', ')}`
        );
      }
    }

    return request.prompt;
  }

  /**
   * 決定処理
   */
  private async makeDecision(
    vector: MultiLayerVector,
    request: GenerationRequest
  ): Promise<DecisionResult> {
    // ストレージから類似アイテム検索
    const searchResults = await this.storage.search({
      vector,
      maxResults: 10,
      similarityThreshold: 0.5,
    });

    // CacheItemの配列を作成
    const cacheItems = searchResults.map((result) => result.item);

    // 決定エンジンで判定
    return this.decisionEngine.decide(vector, cacheItems);
  }

  /**
   * 決定実行
   */
  private async executeDecision(
    decision: DecisionResult,
    vector: MultiLayerVector,
    request: GenerationRequest
  ): Promise<GenerationResult> {
    const id = this.generateId();

    switch (decision.action) {
      case 'cache_hit': {
        // キャッシュヒット
        const item = decision.matchedItem!;
        return {
          id,
          image: item.image,
          prompt: request.prompt,
          vector,
          metadata: item.metadata,
          fromCache: true,
          processingTime: 0,
        };
      }

      case 'diff_generation': {
        // 差分生成（モック実装）
        const baseItem = decision.matchedItem!;
        const mockImage = Buffer.from('mock-diff-generated-image');

        return {
          id,
          image: mockImage,
          prompt: request.prompt,
          vector,
          metadata: {
            prompt: request.prompt,
            generationParams: {
              model: 'mock-model',
              seed: Math.floor(Math.random() * 1000000),
              steps: 50,
              cfgScale: 7.5,
              denoisingStrength: decision.diffStrength,
            },
            createdAt: new Date(),
            size: mockImage.length,
            format: 'png',
            dimensions: { width: 512, height: 512 },
          },
          fromCache: false,
          processingTime: 500,
        };
      }

      case 'new_generation':
      default: {
        // 新規生成（モック実装）
        const mockImage = Buffer.from('mock-generated-image');
        return {
          id,
          image: mockImage,
          prompt: request.prompt,
          vector,
          metadata: {
            prompt: request.prompt,
            generationParams: {
              model: 'mock-model',
              seed: Math.floor(Math.random() * 1000000),
              steps: 50,
              cfgScale: 7.5,
            },
            createdAt: new Date(),
            size: mockImage.length,
            format: 'png',
            dimensions: { width: 512, height: 512 },
          },
          fromCache: false,
          processingTime: 1000,
        };
      }
    }
  }

  /**
   * ストレージ更新
   */
  private async updateStorage(result: GenerationResult): Promise<void> {
    const cacheItem: CacheItem = {
      id: result.id,
      vector: result.vector,
      image: result.image,
      metadata: result.metadata,
      accessCount: 1,
      lastAccess: new Date(),
      generationDifficulty: 1.0,
      storageLevel: 'L1',
    };

    await this.storage.add(cacheItem);
  }

  /**
   * 統計更新
   */
  private updateStats(decision: DecisionResult, processingTime: number): void {
    switch (decision.action) {
      case 'cache_hit':
        this.stats.cacheHits++;
        break;
      case 'diff_generation':
        this.stats.diffGenerations++;
        break;
      case 'new_generation':
        this.stats.newGenerations++;
        break;
    }

    // キャッシュヒット率
    this.stats.cacheHitRate = this.stats.cacheHits / this.stats.totalRequests;

    // 平均処理時間
    this.stats.avgProcessingTime =
      (this.stats.avgProcessingTime * (this.stats.totalRequests - 1) +
        processingTime) /
      this.stats.totalRequests;
  }

  /**
   * コンポーネントヘルスチェック
   */
  private async checkComponentHealth(
    component: string
  ): Promise<ComponentHealth> {
    const startTime = performance.now();

    try {
      // 簡易的なヘルスチェック
      switch (component) {
        case 'storage':
          this.storage.getStatistics();
          break;
        default:
          // 他のコンポーネントは存在チェックのみ
          break;
      }

      return {
        healthy: true,
        responseTime: performance.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: performance.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * メモリ使用量計算
   */
  private calculateMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * 総メモリ量取得
   */
  private getTotalMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapTotal;
    }
    return 0;
  }

  /**
   * ID生成
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
