/**
 * Semantic Cache System - Configuration Types
 *
 * システム全体の設定を定義します。
 *
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * @module SystemConfig
 */

import type {
  SystemParams,
  LayerType,
  StorageLevel,
  UseCaseType,
} from '../types/index.js';

/**
 * システム全体の設定
 */
export interface SystemConfig {
  /**
   * 入力処理設定
   */
  input?: InputConfig;

  /**
   * ベクトル化設定
   */
  vectorization?: VectorizationConfig;

  /**
   * 類似度計算設定
   */
  similarity?: SimilarityConfig;

  /**
   * 決定エンジン設定
   */
  decision?: DecisionConfig;

  /**
   * 画像処理設定
   */
  image?: ImageConfig;

  /**
   * ストレージ設定
   */
  storage?: StorageConfig;

  /**
   * 最適化設定
   */
  optimization?: OptimizationConfig;

  /**
   * システムパラメータ
   */
  systemParams?: SystemParams;

  /**
   * メモリ制限（0-1の範囲で指定、デフォルト: 0.92）
   */
  memoryLimit?: number;
}

/**
 * 入力処理設定
 */
export interface InputConfig {
  /**
   * 最大テキスト長
   */
  maxTextLength?: number;

  /**
   * 最大画像サイズ（バイト）
   */
  maxImageSize?: number;

  /**
   * サポートされる画像フォーマット
   */
  supportedFormats?: string[];

  /**
   * バリデーション有効化
   */
  enableValidation?: boolean;
}

/**
 * ベクトル化設定
 */
export interface VectorizationConfig {
  /**
   * 各レイヤーの次元数
   */
  layerDimensions?: Record<LayerType, number>;

  /**
   * 埋め込みモデル
   */
  embeddingModel?: string;

  /**
   * 関係マトリクス計算有効化
   */
  enableRelationMatrix?: boolean;
}

/**
 * 類似度計算設定
 */
export interface SimilarityConfig {
  /**
   * 学習率
   */
  learningRate?: number;

  /**
   * バッチサイズ
   */
  batchSize?: number;

  /**
   * フィードバック収集有効化
   */
  enableFeedback?: boolean;

  /**
   * ベイズ最適化有効化
   */
  enableBayesianOptimization?: boolean;
}

/**
 * 決定エンジン設定
 */
export interface DecisionConfig {
  /**
   * キャッシュヒット閾値
   */
  cacheHitThreshold?: number;

  /**
   * 差分生成閾値
   */
  diffGenerationThreshold?: number;

  /**
   * 不確実性定量化有効化
   */
  enableUncertaintyQuantification?: boolean;

  /**
   * アンサンブルモデル有効化
   */
  enableEnsemble?: boolean;

  /**
   * 適応的閾値有効化
   */
  enableAdaptiveThreshold?: boolean;
}

/**
 * 画像処理設定
 */
export interface ImageConfig {
  /**
   * セグメンテーション有効化
   */
  enableSegmentation?: boolean;

  /**
   * 最小パーツサイズ（ピクセル）
   */
  minPartSize?: number;

  /**
   * コンポジション品質閾値
   */
  compositionQualityThreshold?: number;

  /**
   * 差分生成有効化
   */
  enableDiffGeneration?: boolean;
}

/**
 * ストレージ設定
 */
export interface StorageConfig {
  /**
   * シャード数
   */
  numShards?: number;

  /**
   * 各レベルの容量（バイト）
   */
  levelCapacities?: Record<StorageLevel, number>;

  /**
   * プリフェッチ有効化
   */
  enablePrefetch?: boolean;

  /**
   * 自動昇格有効化
   */
  enableAutoPromotion?: boolean;

  /**
   * キャッシュ置換ポリシー
   */
  replacementPolicy?: 'LRU' | 'LFU' | 'LRFU' | 'ARC';
}

/**
 * 最適化設定
 */
export interface OptimizationConfig {
  /**
   * ユースケースタイプ
   */
  useCaseType?: UseCaseType;

  /**
   * ユースケース固有の設定
   */
  useCaseConfig?: Record<string, unknown>;

  /**
   * 最適化有効化
   */
  enableOptimization?: boolean;
}

/**
 * システム統計情報
 */
export interface SystemStats {
  /**
   * 総リクエスト数
   */
  totalRequests: number;

  /**
   * キャッシュヒット数
   */
  cacheHits: number;

  /**
   * 差分生成数
   */
  diffGenerations: number;

  /**
   * 新規生成数
   */
  newGenerations: number;

  /**
   * キャッシュヒット率
   */
  cacheHitRate: number;

  /**
   * 平均処理時間（ミリ秒）
   */
  avgProcessingTime: number;

  /**
   * メモリ使用量（バイト）
   */
  memoryUsage: number;

  /**
   * メモリ使用率（0-1）
   */
  memoryUsageRatio: number;

  /**
   * ストレージレベル別統計
   */
  storageStats: {
    [K in StorageLevel]: {
      items: number;
      usageBytes: number;
      hitRate: number;
    };
  };

  /**
   * システム稼働時間（秒）
   */
  uptime: number;

  /**
   * 最終更新時刻
   */
  lastUpdated: Date;
}

/**
 * ヘルスチェック結果
 */
export interface HealthCheckResult {
  /**
   * システム全体の健全性
   */
  healthy: boolean;

  /**
   * ステータス
   */
  status: 'ok' | 'degraded' | 'error';

  /**
   * 各コンポーネントの状態
   */
  components: {
    input: ComponentHealth;
    vectorization: ComponentHealth;
    similarity: ComponentHealth;
    decision: ComponentHealth;
    image: ComponentHealth;
    storage: ComponentHealth;
  };

  /**
   * システムメトリクス
   */
  metrics: {
    memoryUsage: number;
    cpuUsage?: number;
    responseTime: number;
  };

  /**
   * エラーまたは警告
   */
  issues: HealthIssue[];

  /**
   * チェック実行時刻
   */
  timestamp: Date;
}

/**
 * コンポーネント健全性
 */
export interface ComponentHealth {
  /**
   * 健全性
   */
  healthy: boolean;

  /**
   * レスポンスタイム（ミリ秒）
   */
  responseTime?: number;

  /**
   * エラーメッセージ
   */
  error?: string;
}

/**
 * ヘルスチェック問題
 */
export interface HealthIssue {
  /**
   * 重要度
   */
  severity: 'warning' | 'error' | 'critical';

  /**
   * コンポーネント名
   */
  component: string;

  /**
   * メッセージ
   */
  message: string;

  /**
   * 詳細
   */
  details?: string;
}

/**
 * デフォルトのシステム設定
 */
export const DEFAULT_SYSTEM_CONFIG: Required<SystemConfig> = {
  input: {
    maxTextLength: 10000,
    maxImageSize: 10 * 1024 * 1024, // 10MB
    supportedFormats: ['png', 'jpg', 'jpeg', 'webp'],
    enableValidation: true,
  },
  vectorization: {
    layerDimensions: {
      subject: 128,
      attribute: 96,
      style: 64,
      composition: 48,
      emotion: 32,
    },
    embeddingModel: 'default',
    enableRelationMatrix: true,
  },
  similarity: {
    learningRate: 0.01,
    batchSize: 32,
    enableFeedback: true,
    enableBayesianOptimization: true,
  },
  decision: {
    cacheHitThreshold: 0.85,
    diffGenerationThreshold: 0.65,
    enableUncertaintyQuantification: true,
    enableEnsemble: true,
    enableAdaptiveThreshold: true,
  },
  image: {
    enableSegmentation: true,
    minPartSize: 64,
    compositionQualityThreshold: 0.7,
    enableDiffGeneration: true,
  },
  storage: {
    numShards: 8,
    levelCapacities: {
      L1: 100 * 1024 * 1024,      // 100MB
      L2: 500 * 1024 * 1024,      // 500MB
      L3: 2 * 1024 * 1024 * 1024, // 2GB
      cold: 10 * 1024 * 1024 * 1024, // 10GB
    },
    enablePrefetch: true,
    enableAutoPromotion: true,
    replacementPolicy: 'ARC',
  },
  optimization: {
    useCaseType: undefined,
    useCaseConfig: {},
    enableOptimization: false,
  },
  systemParams: {
    layerWeights: {
      subject: 0.3,
      attribute: 0.25,
      style: 0.2,
      composition: 0.15,
      emotion: 0.1,
    },
    thresholds: {
      cacheHit: 0.85,
      diffGeneration: 0.65,
    },
    learningRate: 0.01,
  },
  memoryLimit: 0.92,
};
