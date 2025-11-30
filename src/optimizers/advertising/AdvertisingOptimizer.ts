/**
 * 広告業界向けターゲティング最適化
 * デモグラフィック反映、メッセージング一貫性、A/Bテスト向けバリエーション生成
 */

import type {
  GenerationRequest,
  OptimizedRequest,
  Campaign,
  Demographic,
  Template,
  CampaignCache,
} from '../../types/index.js';
import {
  UseCaseOptimizer,
  type UseCaseOptimizerConfig,
  type OptimizationStrategy,
  type OptimizationContext,
} from '../UseCaseOptimizer.js';

/**
 * 広告固有の最適化コンテキスト
 */
export interface AdvertisingContext extends OptimizationContext {
  /** キャンペーン情報 */
  campaign?: Campaign;
  /** キャンペーンキャッシュ */
  campaignCache?: CampaignCache;
  /** ターゲットデモグラフィック */
  targetDemographic?: Demographic;
  /** A/Bテストモード */
  isABTest?: boolean;
}

/**
 * 広告向け最適化設定
 */
export interface AdvertisingOptimizerConfig extends UseCaseOptimizerConfig {
  /** デモグラフィック適応の強度（0-1） */
  demographicAdaptationStrength: number;
  /** メッセージング一貫性の重要度（0-1） */
  messagingConsistencyWeight: number;
  /** A/Bテストバリエーション生成レベル（0-1） */
  abTestVariationLevel: number;
}

/**
 * デフォルト設定
 */
const DEFAULT_ADVERTISING_CONFIG: AdvertisingOptimizerConfig = {
  useCaseType: 'advertising',
  prioritizeCacheReuse: true,
  prioritizeDiffGeneration: true,
  qualitySpeedTradeoff: 0.7, // バランス重視
  demographicAdaptationStrength: 0.9,
  messagingConsistencyWeight: 0.95,
  abTestVariationLevel: 0.8,
};

/**
 * 広告業界向けターゲティング最適化クラス
 *
 * 最適化の特徴:
 * - ターゲットデモグラフィックに応じた画像生成
 * - キャンペーンテーマとの整合性維持
 * - A/Bテスト向けの効率的なバリエーション生成
 * - メッセージング一貫性の保証
 */
export class AdvertisingOptimizer extends UseCaseOptimizer {
  protected declare config: AdvertisingOptimizerConfig;

  constructor(config?: Partial<AdvertisingOptimizerConfig>) {
    super({ ...DEFAULT_ADVERTISING_CONFIG, ...config });
  }

  /**
   * 最適化戦略の初期化
   */
  protected initializeStrategies(): void {
    this.strategies = [
      this.createDemographicTargetingStrategy(),
      this.createMessagingConsistencyStrategy(),
      this.createCampaignThemeStrategy(),
      this.createABTestVariationStrategy(),
    ];
  }

  /**
   * デモグラフィックターゲティング戦略
   * ターゲット層に最適化された画像を生成
   */
  private createDemographicTargetingStrategy(): OptimizationStrategy {
    return {
      name: 'demographic-targeting',
      priority: 95,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getAdvertisingContext(request);
        return (
          context?.targetDemographic !== undefined &&
          this.config.demographicAdaptationStrength > 0
        );
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const context = this.getAdvertisingContext(request);
        const demographic = context?.targetDemographic;

        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'demographic-targeting',
              applied: true,
              impact: this.config.demographicAdaptationStrength,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 30,
        };

        if (demographic) {
          // デモグラフィックに基づいてプロンプトを調整
          optimized.prompt = this.adaptPromptToDemographic(
            request.prompt,
            demographic
          );

          // メタデータにターゲット情報を追加
          optimized.metadata = {
            ...request.metadata,
            targetDemographic: {
              ageRange: demographic.ageRange,
              gender: demographic.gender,
              interests: demographic.interests,
            },
          };
        }

        return optimized;
      },
    };
  }

  /**
   * メッセージング一貫性戦略
   * キャンペーン全体でメッセージの一貫性を保つ
   */
  private createMessagingConsistencyStrategy(): OptimizationStrategy {
    return {
      name: 'messaging-consistency',
      priority: 90,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getAdvertisingContext(request);
        return (
          context?.campaign !== undefined &&
          this.config.messagingConsistencyWeight > 0
        );
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const context = this.getAdvertisingContext(request);
        const campaign = context?.campaign;

        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'messaging-consistency',
              applied: true,
              impact: this.config.messagingConsistencyWeight,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 25,
        };

        if (campaign) {
          // キャンペーンテーマをプロンプトに統合
          optimized.prompt = this.integrateMessaging(
            request.prompt,
            campaign.theme
          );

          // キャンペーンのビジュアルスタイルを制約に追加
          optimized.constraints = {
            ...request.constraints,
            style: `campaign-${campaign.id}-style`,
          };
        }

        return optimized;
      },
    };
  }

  /**
   * キャンペーンテーマ戦略
   * キャンペーンテーマとの整合性を確保
   */
  private createCampaignThemeStrategy(): OptimizationStrategy {
    return {
      name: 'campaign-theme',
      priority: 85,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getAdvertisingContext(request);
        return context?.campaign !== undefined;
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const context = this.getAdvertisingContext(request);
        const campaign = context?.campaign;

        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'campaign-theme',
              applied: true,
              impact: 0.8,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 20,
        };

        if (campaign && context?.campaignCache) {
          // キャンペーンキャッシュから再利用可能な要素を特定
          const reusableElements = this.identifyReusableElements(
            campaign,
            context.campaignCache
          );

          optimized.metadata = {
            ...request.metadata,
            campaignTheme: campaign.theme,
            reusableElements,
          };
        }

        return optimized;
      },
    };
  }

  /**
   * A/Bテストバリエーション戦略
   * 効率的なバリエーション生成
   */
  private createABTestVariationStrategy(): OptimizationStrategy {
    return {
      name: 'ab-test-variation',
      priority: 80,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getAdvertisingContext(request);
        return (
          context?.isABTest === true &&
          this.config.abTestVariationLevel > 0
        );
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'ab-test-variation',
              applied: true,
              impact: this.config.abTestVariationLevel,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 15,
        };

        // A/Bテストのバリエーション生成ヒントを追加
        optimized.metadata = {
          ...request.metadata,
          abTestMode: true,
          variationStrategy: this.determineVariationStrategy(request),
        };

        return optimized;
      },
    };
  }

  /**
   * デモグラフィックに応じてプロンプトを適応
   */
  private adaptPromptToDemographic(
    prompt: string,
    demographic: Demographic
  ): string {
    const adaptations: string[] = [];

    // 年齢層に基づく調整
    const [minAge, maxAge] = demographic.ageRange;
    if (maxAge <= 25) {
      adaptations.push('youthful, energetic, trendy');
    } else if (minAge >= 50) {
      adaptations.push('sophisticated, mature, classic');
    } else {
      adaptations.push('contemporary, professional');
    }

    // 興味に基づく調整
    if (demographic.interests.length > 0) {
      const interestHints = demographic.interests.slice(0, 3).join(', ');
      adaptations.push(`interests: ${interestHints}`);
    }

    // 性別に基づく調整（必要な場合）
    if (demographic.gender && demographic.gender !== 'all') {
      adaptations.push(`targeting: ${demographic.gender}`);
    }

    const adaptationString = adaptations.join(', ');
    return `${prompt} [DEMOGRAPHIC: ${adaptationString}]`;
  }

  /**
   * キャンペーンメッセージをプロンプトに統合
   */
  private integrateMessaging(prompt: string, theme: string): string {
    return `${prompt} [CAMPAIGN THEME: ${theme}]`;
  }

  /**
   * キャンペーンキャッシュから再利用可能な要素を特定
   */
  private identifyReusableElements(
    campaign: Campaign,
    cache: CampaignCache
  ): string[] {
    const reusable: string[] = [];

    // テンプレート画像の再利用可能性をチェック
    if (cache.templateImages.size > 0) {
      reusable.push('template-images');
    }

    // デモグラフィックバリエーションの再利用
    if (cache.demographicVariations.size > 0) {
      reusable.push('demographic-variations');
    }

    // メッセージオーバーレイの再利用
    if (cache.messageOverlays.size > 0) {
      reusable.push('message-overlays');
    }

    return reusable;
  }

  /**
   * A/Bテストのバリエーション戦略を決定
   */
  private determineVariationStrategy(request: GenerationRequest): string {
    // 参照画像がある場合は差分ベース
    if (request.referenceImages && request.referenceImages.length > 0) {
      return 'diff-based';
    }

    // 制約が厳しい場合は制約ベース
    if (request.constraints && Object.keys(request.constraints).length > 3) {
      return 'constraint-based';
    }

    // デフォルトは自由生成
    return 'free-generation';
  }

  /**
   * コンテキストから広告固有の情報を取得
   */
  private getAdvertisingContext(
    request: GenerationRequest
  ): AdvertisingContext | undefined {
    return request.metadata?.advertisingContext as
      | AdvertisingContext
      | undefined;
  }

  /**
   * 後処理: キャンペーンメトリクスの追加
   */
  protected postProcess(
    request: OptimizedRequest,
    context?: OptimizationContext
  ): OptimizedRequest {
    const advertisingContext = context as AdvertisingContext | undefined;

    if (!advertisingContext?.campaign) {
      return request;
    }

    const campaign = advertisingContext.campaign;

    // キャンペーンメトリクスを追加
    const campaignMetrics = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      targetDemographicsCount: campaign.targetDemographics.length,
      templatesCount: campaign.templates.length,
      theme: campaign.theme,
    };

    return {
      ...request,
      metadata: {
        ...request.metadata,
        campaignMetrics,
      },
    };
  }

  /**
   * テンプレート適用の最適化
   *
   * @param request - 生成リクエスト
   * @param template - 適用するテンプレート
   * @returns 最適化されたリクエスト
   */
  applyTemplate(
    request: GenerationRequest,
    template: Template
  ): OptimizedRequest {
    const optimized: OptimizedRequest = {
      ...request,
      optimizations: [],
      priority: 50,
    };

    // テンプレートのレイアウトを制約に追加
    optimized.constraints = {
      ...request.constraints,
      aspectRatio: template.layout,
    };

    // プレースホルダー情報をメタデータに追加
    optimized.metadata = {
      ...request.metadata,
      templateId: template.id,
      placeholders: template.placeholders,
    };

    return optimized;
  }
}
