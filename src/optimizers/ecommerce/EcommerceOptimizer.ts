/**
 * Eコマース向け製品画像最適化
 * 製品カタログとの統合、ブランド一貫性の保証、バリエーション生成最適化
 */

import type {
  GenerationRequest,
  OptimizedRequest,
  Product,
  ProductCatalog,
  StyleGuide,
  ProductAttribute,
} from '../../types/index.js';
import {
  UseCaseOptimizer,
  type UseCaseOptimizerConfig,
  type OptimizationStrategy,
  type OptimizationContext,
} from '../UseCaseOptimizer.js';

/**
 * Eコマース固有の最適化コンテキスト
 */
export interface EcommerceContext extends OptimizationContext {
  /** 製品カタログ */
  catalog?: ProductCatalog;
  /** スタイルガイド */
  styleGuide?: StyleGuide;
  /** 対象製品 */
  targetProduct?: Product;
}

/**
 * 製品比較結果
 */
interface ProductComparison {
  /** 同一製品の異なる属性か */
  sameProductDifferentAttribute: boolean;
  /** 異なる製品の同一カテゴリーか */
  differentProductSameCategory: boolean;
  /** 変更された属性のリスト */
  changedAttributes: ProductAttribute[];
}

/**
 * Eコマース向け最適化設定
 */
export interface EcommerceOptimizerConfig extends UseCaseOptimizerConfig {
  /** ブランド一貫性を厳格に保つか */
  strictBrandConsistency: boolean;
  /** バリエーション生成最適化レベル（0-1） */
  variationOptimizationLevel: number;
}

/**
 * デフォルト設定
 */
const DEFAULT_ECOMMERCE_CONFIG: EcommerceOptimizerConfig = {
  useCaseType: 'ecommerce',
  prioritizeCacheReuse: true,
  prioritizeDiffGeneration: true,
  qualitySpeedTradeoff: 0.8, // 品質重視
  strictBrandConsistency: true,
  variationOptimizationLevel: 0.9,
};

/**
 * Eコマース向け製品画像最適化クラス
 *
 * 決定ロジック:
 * - 同一製品の異なる属性 → 差分生成優先
 * - 異なる製品の同一カテゴリー → 部分再利用優先
 * - ブランド一貫性が重要 → スタイル層厳格マッチング
 */
export class EcommerceOptimizer extends UseCaseOptimizer {
  protected declare config: EcommerceOptimizerConfig;

  constructor(config?: Partial<EcommerceOptimizerConfig>) {
    super({ ...DEFAULT_ECOMMERCE_CONFIG, ...config });
  }

  /**
   * 最適化戦略の初期化
   */
  protected initializeStrategies(): void {
    this.strategies = [
      this.createSameProductDifferentAttributeStrategy(),
      this.createDifferentProductSameCategoryStrategy(),
      this.createBrandConsistencyStrategy(),
      this.createVariationGenerationStrategy(),
    ];
  }

  /**
   * 同一製品の異なる属性用の戦略
   * → 差分生成を優先
   */
  private createSameProductDifferentAttributeStrategy(): OptimizationStrategy {
    return {
      name: 'same-product-diff-attribute',
      priority: 90,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getEcommerceContext(request);
        if (!context?.targetProduct || !context?.catalog) return false;

        const comparison = this.compareProducts(request, context);
        return comparison.sameProductDifferentAttribute;
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'diff-generation-priority',
              applied: true,
              impact: 0.8,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 30,
        };

        // プロンプトに差分生成のヒントを追加
        optimized.prompt = this.enhancePromptForDiffGeneration(
          request.prompt,
          this.getEcommerceContext(request)
        );

        return optimized;
      },
    };
  }

  /**
   * 異なる製品の同一カテゴリー用の戦略
   * → 部分再利用を優先
   */
  private createDifferentProductSameCategoryStrategy(): OptimizationStrategy {
    return {
      name: 'diff-product-same-category',
      priority: 80,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getEcommerceContext(request);
        if (!context?.targetProduct || !context?.catalog) return false;

        const comparison = this.compareProducts(request, context);
        return comparison.differentProductSameCategory;
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'partial-reuse-priority',
              applied: true,
              impact: 0.6,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 20,
        };

        // 共通要素（背景、ライティングなど）を強調
        optimized.constraints = {
          ...request.constraints,
          style: this.extractCategoryStyle(this.getEcommerceContext(request)),
        };

        return optimized;
      },
    };
  }

  /**
   * ブランド一貫性保証の戦略
   * → スタイル層を厳格にマッチング
   */
  private createBrandConsistencyStrategy(): OptimizationStrategy {
    return {
      name: 'brand-consistency',
      priority: 95,
      canApply: (request: GenerationRequest): boolean => {
        return this.config.strictBrandConsistency;
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const context = this.getEcommerceContext(request);
        const styleGuide = context?.styleGuide;

        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'brand-consistency',
              applied: true,
              impact: 0.9,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 25,
        };

        // スタイルガイドを制約に適用
        if (styleGuide) {
          optimized.constraints = {
            ...request.constraints,
            style: styleGuide.imageGuidelines.backgroundStyle,
            colorPalette: styleGuide.brandColors,
          };

          // プロンプトにブランドスタイルを追加
          optimized.prompt = this.applyBrandStyleToPrompt(
            request.prompt,
            styleGuide
          );
        }

        return optimized;
      },
    };
  }

  /**
   * バリエーション生成最適化の戦略
   */
  private createVariationGenerationStrategy(): OptimizationStrategy {
    return {
      name: 'variation-generation',
      priority: 70,
      canApply: (request: GenerationRequest): boolean => {
        return (
          this.config.variationOptimizationLevel > 0 &&
          request.referenceImages !== undefined &&
          request.referenceImages.length > 0
        );
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'variation-generation',
              applied: true,
              impact: this.config.variationOptimizationLevel,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 15,
        };

        // バリエーション生成のヒントを追加
        if (request.constraints) {
          optimized.metadata = {
            ...request.metadata,
            variationHint: 'maintain-core-product-identity',
            varyAttributes: this.identifyVariableAttributes(
              this.getEcommerceContext(request)
            ),
          };
        }

        return optimized;
      },
    };
  }

  /**
   * 製品を比較して最適化の方向性を決定
   */
  private compareProducts(
    request: GenerationRequest,
    context: EcommerceContext
  ): ProductComparison {
    const result: ProductComparison = {
      sameProductDifferentAttribute: false,
      differentProductSameCategory: false,
      changedAttributes: [],
    };

    if (!context.targetProduct || !context.cacheHistory) {
      return result;
    }

    // キャッシュ履歴から最も最近の製品を取得
    const previousProduct = this.extractProductFromCache(context.cacheHistory[0]);
    if (!previousProduct) return result;

    const currentProduct = context.targetProduct;

    // 同一製品の判定
    if (currentProduct.id === previousProduct.id) {
      result.sameProductDifferentAttribute = true;

      // 変更された属性を特定
      result.changedAttributes = this.findChangedAttributes(
        previousProduct.attributes,
        currentProduct.attributes
      );
    }
    // 同一カテゴリーの判定
    else if (currentProduct.category === previousProduct.category) {
      result.differentProductSameCategory = true;
    }

    return result;
  }

  /**
   * キャッシュアイテムから製品情報を抽出
   */
  private extractProductFromCache(cacheItem: any): Product | undefined {
    // メタデータから製品情報を抽出
    if (cacheItem.metadata?.product) {
      return cacheItem.metadata.product as Product;
    }
    return undefined;
  }

  /**
   * 変更された属性を検出
   */
  private findChangedAttributes(
    oldAttributes: ProductAttribute[],
    newAttributes: ProductAttribute[]
  ): ProductAttribute[] {
    const changed: ProductAttribute[] = [];

    for (const newAttr of newAttributes) {
      const oldAttr = oldAttributes.find((a) => a.name === newAttr.name);
      if (!oldAttr || oldAttr.value !== newAttr.value) {
        changed.push(newAttr);
      }
    }

    return changed;
  }

  /**
   * 差分生成用にプロンプトを強化
   */
  private enhancePromptForDiffGeneration(
    prompt: string,
    context?: EcommerceContext
  ): string {
    if (!context?.targetProduct) return prompt;

    const changedAttrs = context.targetProduct.attributes
      .map((attr) => `${attr.name}: ${attr.value}`)
      .join(', ');

    return `${prompt} [VARIATION: ${changedAttrs}]`;
  }

  /**
   * カテゴリーのスタイルを抽出
   */
  private extractCategoryStyle(context?: EcommerceContext): string {
    if (!context?.targetProduct) return 'default';
    return `${context.targetProduct.category}-style`;
  }

  /**
   * ブランドスタイルをプロンプトに適用
   */
  private applyBrandStyleToPrompt(
    prompt: string,
    styleGuide: StyleGuide
  ): string {
    const styleHints = [
      `lighting: ${styleGuide.imageGuidelines.lightingStyle}`,
      `background: ${styleGuide.imageGuidelines.backgroundStyle}`,
      `aspect ratio: ${styleGuide.imageGuidelines.aspectRatio}`,
    ].join(', ');

    return `${prompt} [BRAND STYLE: ${styleHints}]`;
  }

  /**
   * 可変な属性を特定
   */
  private identifyVariableAttributes(
    context?: EcommerceContext
  ): string[] {
    if (!context?.targetProduct) return [];

    return context.targetProduct.attributes
      .filter((attr) => attr.type === 'color' || attr.type === 'style')
      .map((attr) => attr.name);
  }

  /**
   * コンテキストからEコマース固有の情報を取得
   */
  private getEcommerceContext(
    request: GenerationRequest
  ): EcommerceContext | undefined {
    return request.metadata?.ecommerceContext as EcommerceContext | undefined;
  }

  /**
   * 後処理: 製品カタログスキーマとの整合性チェック
   */
  protected postProcess(
    request: OptimizedRequest,
    context?: OptimizationContext
  ): OptimizedRequest {
    const ecommerceContext = context as EcommerceContext | undefined;

    if (!ecommerceContext?.catalog) {
      return request;
    }

    // 製品カタログとの整合性を確認
    const catalogIntegration = {
      catalogId: ecommerceContext.catalog.products.length,
      categories: ecommerceContext.catalog.categories,
      brands: ecommerceContext.catalog.brands,
    };

    return {
      ...request,
      metadata: {
        ...request.metadata,
        catalogIntegration,
      },
    };
  }
}
