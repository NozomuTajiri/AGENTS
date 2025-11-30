/**
 * ユースケース特化型最適化レイヤー
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * 各業界のニーズに最適化された画像生成を提供します。
 */

// 基底クラス
export {
  UseCaseOptimizer,
  type UseCaseOptimizerConfig,
  type OptimizationStrategy,
  type OptimizationContext,
  type OptimizationResult,
} from './UseCaseOptimizer.js';

// Eコマース向け最適化
export {
  EcommerceOptimizer,
  type EcommerceOptimizerConfig,
  type EcommerceContext,
} from './ecommerce/EcommerceOptimizer.js';

// 広告業界向け最適化
export {
  AdvertisingOptimizer,
  type AdvertisingOptimizerConfig,
  type AdvertisingContext,
} from './advertising/AdvertisingOptimizer.js';

// ゲーム開発向け最適化
export {
  GamingOptimizer,
  type GamingOptimizerConfig,
  type GamingContext,
  type VariationPipeline,
  type PipelineStep,
} from './gaming/GamingOptimizer.js';

// インポート（ファクトリー関数用）
import { UseCaseOptimizer } from './UseCaseOptimizer.js';
import { EcommerceOptimizer } from './ecommerce/EcommerceOptimizer.js';
import { AdvertisingOptimizer } from './advertising/AdvertisingOptimizer.js';
import { GamingOptimizer } from './gaming/GamingOptimizer.js';

/**
 * ファクトリー関数: ユースケースタイプに応じたOptimizerを生成
 *
 * @param useCaseType - ユースケースタイプ
 * @param config - 任意の設定
 * @returns 対応するOptimizer
 */
export function createOptimizer(
  useCaseType: 'ecommerce' | 'advertising' | 'gaming',
  config?: Record<string, unknown>
): UseCaseOptimizer {
  switch (useCaseType) {
    case 'ecommerce':
      return new EcommerceOptimizer(config);
    case 'advertising':
      return new AdvertisingOptimizer(config);
    case 'gaming':
      return new GamingOptimizer(config);
    default:
      throw new Error(`Unknown use case type: ${useCaseType}`);
  }
}
