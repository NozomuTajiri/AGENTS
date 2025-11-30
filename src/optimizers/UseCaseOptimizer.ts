/**
 * ユースケース特化型最適化レイヤー - 基底クラス
 * 特許: 生成AI画像のキャッシュシステム及び方法
 */

import type {
  GenerationRequest,
  GenerationResult,
  OptimizedRequest,
  MultiLayerVector,
  CacheItem,
  UseCaseType,
} from '../types/index.js';

/**
 * 最適化戦略
 */
export interface OptimizationStrategy {
  /** 戦略名 */
  name: string;
  /** 優先度（高いほど優先） */
  priority: number;
  /** 適用条件の評価 */
  canApply: (request: GenerationRequest) => boolean;
  /** 最適化の適用 */
  apply: (request: GenerationRequest) => OptimizedRequest;
}

/**
 * 最適化コンテキスト
 */
export interface OptimizationContext {
  /** リクエストID */
  requestId: string;
  /** 過去のキャッシュヒット */
  cacheHistory: CacheItem[];
  /** セッションコンテキスト */
  sessionData?: {
    previousRequests: GenerationRequest[];
    userPreferences: Record<string, unknown>;
  };
}

/**
 * 最適化結果
 */
export interface OptimizationResult {
  /** 最適化されたリクエスト */
  request: OptimizedRequest;
  /** 適用された戦略 */
  appliedStrategies: string[];
  /** 推定改善率（0-1） */
  estimatedImprovement: number;
  /** メタデータ */
  metadata: Record<string, unknown>;
}

/**
 * ユースケース最適化設定
 */
export interface UseCaseOptimizerConfig {
  /** ユースケースタイプ */
  useCaseType: UseCaseType;
  /** キャッシュ再利用を優先するか */
  prioritizeCacheReuse: boolean;
  /** 差分生成を優先するか */
  prioritizeDiffGeneration: boolean;
  /** 品質とスピードのバランス（0=速度優先, 1=品質優先） */
  qualitySpeedTradeoff: number;
}

/**
 * ユースケース特化型最適化基底クラス
 *
 * 各ユースケースに特化した最適化ロジックの基底となるクラス。
 * 継承して個別のユースケースに対応した最適化を実装します。
 */
export abstract class UseCaseOptimizer {
  protected config: UseCaseOptimizerConfig;
  protected strategies: OptimizationStrategy[] = [];

  constructor(config: UseCaseOptimizerConfig) {
    this.config = config;
    this.initializeStrategies();
  }

  /**
   * 最適化戦略の初期化
   * サブクラスでオーバーライドして独自の戦略を追加
   */
  protected abstract initializeStrategies(): void;

  /**
   * リクエストを最適化
   *
   * @param request - 生成リクエスト
   * @param context - 最適化コンテキスト
   * @returns 最適化結果
   */
  optimize(
    request: GenerationRequest,
    context?: OptimizationContext
  ): OptimizationResult {
    const startTime = performance.now();

    // 適用可能な戦略をフィルタリング
    const applicableStrategies = this.strategies
      .filter((strategy) => strategy.canApply(request))
      .sort((a, b) => b.priority - a.priority);

    // 最適化されたリクエストを作成
    let optimizedRequest: OptimizedRequest = {
      ...request,
      optimizations: [],
      priority: this.calculatePriority(request, context),
    };

    const appliedStrategyNames: string[] = [];

    // 戦略を順次適用
    for (const strategy of applicableStrategies) {
      const result = strategy.apply(optimizedRequest);
      optimizedRequest = result;
      appliedStrategyNames.push(strategy.name);
    }

    // ユースケース固有の後処理
    optimizedRequest = this.postProcess(optimizedRequest, context);

    const processingTime = performance.now() - startTime;

    return {
      request: optimizedRequest,
      appliedStrategies: appliedStrategyNames,
      estimatedImprovement: this.estimateImprovement(
        request,
        optimizedRequest,
        context
      ),
      metadata: {
        processingTime,
        useCaseType: this.config.useCaseType,
        strategyCount: appliedStrategyNames.length,
      },
    };
  }

  /**
   * リクエストの優先度を計算
   *
   * @param request - 生成リクエスト
   * @param context - 最適化コンテキスト
   * @returns 優先度（0-100）
   */
  protected calculatePriority(
    request: GenerationRequest,
    context?: OptimizationContext
  ): number {
    let priority = 50; // ベース優先度

    // 参照画像がある場合は優先度アップ
    if (request.referenceImages && request.referenceImages.length > 0) {
      priority += 10;
    }

    // 制約が厳しい場合は優先度アップ
    if (request.constraints) {
      const constraintCount = Object.keys(request.constraints).length;
      priority += constraintCount * 5;
    }

    // キャッシュヒット履歴がある場合は優先度アップ
    if (context?.cacheHistory && context.cacheHistory.length > 0) {
      priority += 15;
    }

    return Math.min(100, priority);
  }

  /**
   * 最適化後の後処理
   * サブクラスでオーバーライド可能
   *
   * @param request - 最適化されたリクエスト
   * @param context - 最適化コンテキスト
   * @returns 後処理済みリクエスト
   */
  protected postProcess(
    request: OptimizedRequest,
    context?: OptimizationContext
  ): OptimizedRequest {
    // デフォルトでは何もしない
    return request;
  }

  /**
   * 改善率の推定
   *
   * @param original - 元のリクエスト
   * @param optimized - 最適化されたリクエスト
   * @param context - 最適化コンテキスト
   * @returns 推定改善率（0-1）
   */
  protected estimateImprovement(
    original: GenerationRequest,
    optimized: OptimizedRequest,
    context?: OptimizationContext
  ): number {
    const optimizationCount = optimized.optimizations.length;

    // 基本的な改善率計算
    let improvement = 0;

    // 最適化が適用された数に基づく
    improvement += optimizationCount * 0.1;

    // キャッシュ再利用の可能性
    if (context?.cacheHistory && context.cacheHistory.length > 0) {
      improvement += 0.2;
    }

    // 差分生成の可能性
    if (original.referenceImages && original.referenceImages.length > 0) {
      improvement += 0.15;
    }

    return Math.min(1, improvement);
  }

  /**
   * 類似性スコアの計算
   * 2つのベクトル間の類似度を計算
   *
   * @param vector1 - ベクトル1
   * @param vector2 - ベクトル2
   * @returns 類似度スコア（0-1）
   */
  protected calculateSimilarity(
    vector1: MultiLayerVector,
    vector2: MultiLayerVector
  ): number {
    // コサイン類似度の計算（簡易版）
    const layers: Array<keyof Pick<MultiLayerVector, 'subject' | 'attribute' | 'style' | 'composition' | 'emotion'>> = [
      'subject',
      'attribute',
      'style',
      'composition',
      'emotion',
    ];

    let totalSimilarity = 0;
    let layerCount = 0;

    for (const layer of layers) {
      const v1 = vector1[layer];
      const v2 = vector2[layer];

      // ドット積の計算
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        norm1 += v1[i] * v1[i];
        norm2 += v2[i] * v2[i];
      }

      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      totalSimilarity += similarity;
      layerCount++;
    }

    return totalSimilarity / layerCount;
  }

  /**
   * キャッシュから最も類似したアイテムを検索
   *
   * @param vector - 検索対象のベクトル
   * @param cacheItems - キャッシュアイテムのリスト
   * @param threshold - 類似度閾値（デフォルト: 0.85）
   * @returns 最も類似したキャッシュアイテム（見つからない場合はundefined）
   */
  protected findMostSimilarCacheItem(
    vector: MultiLayerVector,
    cacheItems: CacheItem[],
    threshold: number = 0.85
  ): CacheItem | undefined {
    let bestMatch: CacheItem | undefined;
    let bestSimilarity = threshold;

    for (const item of cacheItems) {
      const similarity = this.calculateSimilarity(vector, item.vector);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = item;
      }
    }

    return bestMatch;
  }

  /**
   * 設定の更新
   *
   * @param config - 更新する設定
   */
  updateConfig(config: Partial<UseCaseOptimizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   *
   * @returns 現在の設定
   */
  getConfig(): UseCaseOptimizerConfig {
    return { ...this.config };
  }

  /**
   * 登録されている戦略の一覧を取得
   *
   * @returns 戦略名のリスト
   */
  getStrategies(): string[] {
    return this.strategies.map((s) => s.name);
  }
}
