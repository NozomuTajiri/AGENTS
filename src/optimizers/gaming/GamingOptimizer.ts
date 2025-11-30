/**
 * ゲーム開発向けアセット管理最適化
 * キャラクター一貫性維持、環境バリエーション生成、スタイルガイド整合性
 */

import type {
  GenerationRequest,
  OptimizedRequest,
  GameCharacter,
  CharacterRegistry,
  GameStyleGuide,
  Asset,
  VariationType,
  LightingPreset,
} from '../../types/index.js';
import {
  UseCaseOptimizer,
  type UseCaseOptimizerConfig,
  type OptimizationStrategy,
  type OptimizationContext,
} from '../UseCaseOptimizer.js';

/**
 * ゲーム固有の最適化コンテキスト
 */
export interface GamingContext extends OptimizationContext {
  /** キャラクターレジストリ */
  characterRegistry?: CharacterRegistry;
  /** 対象キャラクター */
  targetCharacter?: GameCharacter;
  /** 生成するバリエーションタイプ */
  variationType?: VariationType;
  /** 既存アセット */
  existingAssets?: Asset[];
}

/**
 * バリエーション生成パイプライン
 */
export interface VariationPipeline {
  /** パイプライン名 */
  name: string;
  /** ステップのリスト */
  steps: PipelineStep[];
  /** 推定処理時間（ミリ秒） */
  estimatedTime: number;
}

/**
 * パイプラインステップ
 */
export interface PipelineStep {
  /** ステップ名 */
  name: string;
  /** 処理タイプ */
  type: 'base' | 'variation' | 'overlay' | 'adjustment' | 'composition';
  /** パラメータ */
  parameters: Record<string, unknown>;
}

/**
 * ゲーム向け最適化設定
 */
export interface GamingOptimizerConfig extends UseCaseOptimizerConfig {
  /** キャラクター一貫性の重要度（0-1） */
  characterConsistencyWeight: number;
  /** 環境バリエーション効率化レベル（0-1） */
  environmentVariationLevel: number;
  /** ゲームエンジン互換性チェック */
  enforceEngineCompatibility: boolean;
}

/**
 * デフォルト設定
 */
const DEFAULT_GAMING_CONFIG: GamingOptimizerConfig = {
  useCaseType: 'gaming',
  prioritizeCacheReuse: true,
  prioritizeDiffGeneration: true,
  qualitySpeedTradeoff: 0.85, // 品質重視
  characterConsistencyWeight: 0.95,
  environmentVariationLevel: 0.9,
  enforceEngineCompatibility: true,
};

/**
 * ゲーム開発向けアセット管理最適化クラス
 *
 * パイプライン例:
 * character_base → pose_variation → expression_overlay →
 * lighting_adjustment → background_composition
 *
 * 最適化の特徴:
 * - キャラクターの一貫性を厳格に維持
 * - ポーズ、表情、ライティングなどの段階的バリエーション生成
 * - 環境バリエーションの効率的生成
 * - ゲームエンジンとの互換性保証
 */
export class GamingOptimizer extends UseCaseOptimizer {
  protected declare config: GamingOptimizerConfig;

  constructor(config?: Partial<GamingOptimizerConfig>) {
    super({ ...DEFAULT_GAMING_CONFIG, ...config });
  }

  /**
   * 最適化戦略の初期化
   */
  protected initializeStrategies(): void {
    this.strategies = [
      this.createCharacterConsistencyStrategy(),
      this.createVariationPipelineStrategy(),
      this.createEnvironmentVariationStrategy(),
      this.createStyleGuideStrategy(),
    ];
  }

  /**
   * キャラクター一貫性戦略
   * キャラクターの核となる特徴を維持
   */
  private createCharacterConsistencyStrategy(): OptimizationStrategy {
    return {
      name: 'character-consistency',
      priority: 95,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getGamingContext(request);
        return (
          context?.targetCharacter !== undefined &&
          this.config.characterConsistencyWeight > 0
        );
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const context = this.getGamingContext(request);
        const character = context?.targetCharacter;

        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'character-consistency',
              applied: true,
              impact: this.config.characterConsistencyWeight,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 30,
        };

        if (character) {
          // キャラクターの基本外観をプロンプトに統合
          optimized.prompt = this.integrateCharacterAppearance(
            request.prompt,
            character
          );

          // メタデータにキャラクター情報を追加
          optimized.metadata = {
            ...request.metadata,
            characterId: character.id,
            baseAppearance: character.baseAppearance,
          };
        }

        return optimized;
      },
    };
  }

  /**
   * バリエーションパイプライン戦略
   * 段階的なバリエーション生成
   */
  private createVariationPipelineStrategy(): OptimizationStrategy {
    return {
      name: 'variation-pipeline',
      priority: 90,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getGamingContext(request);
        return context?.variationType !== undefined;
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const context = this.getGamingContext(request);
        const variationType = context?.variationType;

        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'variation-pipeline',
              applied: true,
              impact: 0.85,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 25,
        };

        if (variationType) {
          // バリエーションタイプに基づいてパイプラインを構築
          const pipeline = this.buildVariationPipeline(
            variationType,
            context?.targetCharacter
          );

          optimized.metadata = {
            ...request.metadata,
            variationPipeline: pipeline,
          };

          // パイプラインの最初のステップに基づいてプロンプトを調整
          optimized.prompt = this.applyPipelineToPrompt(
            request.prompt,
            pipeline
          );
        }

        return optimized;
      },
    };
  }

  /**
   * 環境バリエーション戦略
   * 環境アセットの効率的なバリエーション生成
   */
  private createEnvironmentVariationStrategy(): OptimizationStrategy {
    return {
      name: 'environment-variation',
      priority: 85,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getGamingContext(request);
        return (
          context?.variationType === 'background' &&
          this.config.environmentVariationLevel > 0
        );
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'environment-variation',
              applied: true,
              impact: this.config.environmentVariationLevel,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 20,
        };

        // 環境バリエーションの効率化ヒントを追加
        optimized.metadata = {
          ...request.metadata,
          environmentOptimization: {
            reuseBaseLighting: true,
            maintainAtmosphere: true,
            variableElements: ['time-of-day', 'weather', 'season'],
          },
        };

        return optimized;
      },
    };
  }

  /**
   * スタイルガイド戦略
   * ゲームのアートスタイルとの整合性を保証
   */
  private createStyleGuideStrategy(): OptimizationStrategy {
    return {
      name: 'game-style-guide',
      priority: 88,
      canApply: (request: GenerationRequest): boolean => {
        const context = this.getGamingContext(request);
        return context?.characterRegistry?.styles !== undefined;
      },
      apply: (request: GenerationRequest): OptimizedRequest => {
        const context = this.getGamingContext(request);
        const styleGuide = context?.characterRegistry?.styles;

        const optimized: OptimizedRequest = {
          ...request,
          optimizations: [
            ...(request as OptimizedRequest).optimizations || [],
            {
              type: 'game-style-guide',
              applied: true,
              impact: 0.9,
            },
          ],
          priority: (request as OptimizedRequest).priority || 50 + 22,
        };

        if (styleGuide) {
          // スタイルガイドをプロンプトに適用
          optimized.prompt = this.applyGameStyleGuide(
            request.prompt,
            styleGuide
          );

          // 色パレットを制約に追加
          optimized.constraints = {
            ...request.constraints,
            colorPalette: styleGuide.colorPalette,
            style: styleGuide.artStyle,
          };
        }

        return optimized;
      },
    };
  }

  /**
   * キャラクターの外観をプロンプトに統合
   */
  private integrateCharacterAppearance(
    prompt: string,
    character: GameCharacter
  ): string {
    const appearance = character.baseAppearance;
    const appearanceString = [
      `body: ${appearance.body}`,
      `face: ${appearance.face}`,
      `clothing: ${appearance.clothing}`,
      appearance.accessories.length > 0
        ? `accessories: ${appearance.accessories.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join(', ');

    return `${prompt} [CHARACTER: ${character.name}, ${appearanceString}]`;
  }

  /**
   * バリエーションパイプラインを構築
   */
  private buildVariationPipeline(
    variationType: VariationType,
    character?: GameCharacter
  ): VariationPipeline {
    const steps: PipelineStep[] = [];

    // 基本ステップ: キャラクターベース
    if (character) {
      steps.push({
        name: 'character-base',
        type: 'base',
        parameters: {
          characterId: character.id,
          baseAppearance: character.baseAppearance,
        },
      });
    }

    // バリエーションタイプに応じてステップを追加
    switch (variationType) {
      case 'pose':
        steps.push({
          name: 'pose-variation',
          type: 'variation',
          parameters: { variationType: 'pose' },
        });
        break;

      case 'expression':
        steps.push({
          name: 'expression-overlay',
          type: 'overlay',
          parameters: { variationType: 'expression' },
        });
        break;

      case 'lighting':
        steps.push({
          name: 'lighting-adjustment',
          type: 'adjustment',
          parameters: { variationType: 'lighting' },
        });
        break;

      case 'color':
        steps.push({
          name: 'color-adjustment',
          type: 'adjustment',
          parameters: { variationType: 'color' },
        });
        break;

      case 'background':
        steps.push({
          name: 'background-composition',
          type: 'composition',
          parameters: { variationType: 'background' },
        });
        break;
    }

    // 推定処理時間の計算（ステップ数 × 基本時間）
    const estimatedTime = steps.length * 100;

    return {
      name: `${variationType}-pipeline`,
      steps,
      estimatedTime,
    };
  }

  /**
   * パイプラインをプロンプトに適用
   */
  private applyPipelineToPrompt(
    prompt: string,
    pipeline: VariationPipeline
  ): string {
    const stepNames = pipeline.steps.map((s) => s.name).join(' → ');
    return `${prompt} [PIPELINE: ${stepNames}]`;
  }

  /**
   * ゲームスタイルガイドをプロンプトに適用
   */
  private applyGameStyleGuide(
    prompt: string,
    styleGuide: GameStyleGuide
  ): string {
    const styleHints = [
      `art style: ${styleGuide.artStyle}`,
      `color palette: ${styleGuide.colorPalette.slice(0, 3).join(', ')}`,
    ];

    // ライティングプリセットがある場合は追加
    if (styleGuide.lightingPresets.length > 0) {
      const primaryLighting = styleGuide.lightingPresets[0];
      styleHints.push(`lighting: ${primaryLighting.name}`);
    }

    const styleString = styleHints.join(', ');
    return `${prompt} [GAME STYLE: ${styleString}]`;
  }

  /**
   * ライティングプリセットを適用
   *
   * @param request - 生成リクエスト
   * @param preset - ライティングプリセット
   * @returns 最適化されたリクエスト
   */
  applyLightingPreset(
    request: GenerationRequest,
    preset: LightingPreset
  ): OptimizedRequest {
    const optimized: OptimizedRequest = {
      ...request,
      optimizations: [],
      priority: 50,
    };

    // ライティング情報をメタデータに追加
    optimized.metadata = {
      ...request.metadata,
      lighting: {
        preset: preset.name,
        direction: preset.direction,
        intensity: preset.intensity,
        color: preset.color,
      },
    };

    // プロンプトにライティング情報を追加
    optimized.prompt = `${request.prompt} [LIGHTING: ${preset.name}, intensity: ${preset.intensity}]`;

    return optimized;
  }

  /**
   * アセットの互換性チェック
   *
   * @param asset - チェック対象のアセット
   * @param targetEngine - ターゲットゲームエンジン
   * @returns 互換性があるかどうか
   */
  checkAssetCompatibility(asset: Asset, targetEngine: string): boolean {
    if (!this.config.enforceEngineCompatibility) {
      return true;
    }

    return asset.metadata.compatible.includes(targetEngine);
  }

  /**
   * コンテキストからゲーム固有の情報を取得
   */
  private getGamingContext(
    request: GenerationRequest
  ): GamingContext | undefined {
    return request.metadata?.gamingContext as GamingContext | undefined;
  }

  /**
   * 後処理: ゲームエンジン互換性情報の追加
   */
  protected postProcess(
    request: OptimizedRequest,
    context?: OptimizationContext
  ): OptimizedRequest {
    const gamingContext = context as GamingContext | undefined;

    if (!gamingContext?.characterRegistry) {
      return request;
    }

    const registry = gamingContext.characterRegistry;

    // ゲームメトリクスを追加
    const gameMetrics = {
      charactersCount: registry.characters.length,
      artStyle: registry.styles.artStyle,
      lightingPresetsCount: registry.styles.lightingPresets.length,
    };

    // ゲームエンジン互換性情報を追加
    if (this.config.enforceEngineCompatibility) {
      return {
        ...request,
        metadata: {
          ...request.metadata,
          gameMetrics,
          engineCompatibility: {
            enforced: true,
            supportedEngines: ['Unity', 'Unreal', 'Godot'],
          },
        },
      };
    }

    return {
      ...request,
      metadata: {
        ...request.metadata,
        gameMetrics,
      },
    };
  }

  /**
   * バッチバリエーション生成の最適化
   * 複数のバリエーションを効率的に生成
   *
   * @param baseRequest - ベースリクエスト
   * @param variationTypes - 生成するバリエーションタイプのリスト
   * @returns 最適化されたリクエストのリスト
   */
  optimizeBatchVariations(
    baseRequest: GenerationRequest,
    variationTypes: VariationType[]
  ): OptimizedRequest[] {
    const optimizedRequests: OptimizedRequest[] = [];

    for (const variationType of variationTypes) {
      const contextWithVariation: GamingContext = {
        ...this.getGamingContext(baseRequest),
        requestId: `${baseRequest.metadata?.requestId || 'req'}-${variationType}`,
        variationType,
        cacheHistory: [],
      };

      const requestWithContext: GenerationRequest = {
        ...baseRequest,
        metadata: {
          ...baseRequest.metadata,
          gamingContext: contextWithVariation,
        },
      };

      const result = this.optimize(requestWithContext, contextWithVariation);
      optimizedRequests.push(result.request);
    }

    return optimizedRequests;
  }
}
