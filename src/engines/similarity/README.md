# 自己学習型類似度計算エンジン

特許: 生成AI画像のキャッシュシステム及び方法

## 概要

フィードバック収集、ベイジアン最適化、ベクトル空間再調整を統合した自己学習型類似度計算システム。

## アーキテクチャ

```
SelfLearningEngine (統合エンジン)
    ├── FeedbackCollector (フィードバック収集)
    ├── BayesianOptimizer (パラメータ最適化)
    └── VectorSpaceAdjuster (ベクトル空間再調整)
```

## コンポーネント

### 1. FeedbackCollector

**責任**: 明示的・暗黙的フィードバックの収集、使用パターン分析

**主要機能**:
- `recordExplicitFeedback()` - 採用/不採用フィードバック記録
- `recordImplicitFeedback()` - 再生成回数、編集回数、滞留時間の記録
- `analyzeCrossUserPatterns()` - クロスユーザー混同パターン分析
- `detectContinuousRequestPattern()` - 連続リクエストパターン検出

**フィードバックタイプ**:
- **明示的**: `accepted` / `rejected`
- **暗黙的**:
  - `regenerationCount` - 再生成要求回数
  - `editCount` - 編集回数
  - `dwellTime` - 画像滞留時間
  - `clickedVariants` - クリックされたバリアント

### 2. BayesianOptimizer

**責任**: システムパラメータの最適化（ベイズ最適化）

**最適化式**:
```
θt+1 = θt + η · ∇L(θt, Dt)
```

**最適化対象**:
- `layerWeights` - 各意味層の重要度係数
- `thresholds.cacheHit` - キャッシュヒット閾値 (0.5-0.99)
- `thresholds.diffGeneration` - 差分生成閾値 (0.3-0.95)
- `learningRate` - 学習率 (0.0001-0.1)

**主要機能**:
- `optimize()` - パラメータ最適化実行
- `hasConverged()` - 収束判定
- `getBestParams()` - 最適パラメータ取得

**学習率調整**:
- 損失改善時: `η *= 1.05` (最大 0.1)
- 改善なし時: `η *= 0.95` (最小 0.0001)

### 3. VectorSpaceAdjuster

**責任**: ベクトル空間の適応的再調整

**変換式**:
```
V't = T(Vt, Ht)
```

**調整方針**:
- 混同されるプロンプト間の距離を **増大**
- 正確に区別されるプロンプト間の距離を **減少**

**主要機能**:
- `adjustVectorSpace()` - ベクトル空間変換
- `computeDistanceMetrics()` - 調整前後の距離計算
- `setLearningRate()` - 学習率設定 (0.0001-0.1)
- `setRegularizationStrength()` - 正則化強度設定 (0-0.01)

**変換行列**:
- 5層ごとに独立した変換行列を学習
- ランク1更新で外積を計算
- 正則化で過学習を防止

### 4. SelfLearningEngine

**責任**: 全コンポーネントの統合、学習サイクル制御

**主要機能**:
- `registerVector()` - ベクトル登録
- `computeSimilarity()` - 学習済みパラメータで類似度計算
- `recordFeedback()` - フィードバック記録 + 学習トリガー
- `getCurrentParams()` - 現在のパラメータ取得
- `getPerformanceMetrics()` - パフォーマンスメトリクス取得

**学習サイクル**:
```
フィードバック記録
    ↓
パラメータ最適化 (50件ごと)
    ↓
ベクトル空間調整 (100件ごと)
    ↓
メトリクス更新
```

## 使用例

```typescript
import { SelfLearningEngine } from './engines/similarity/SelfLearningEngine.js';

// エンジン初期化
const engine = new SelfLearningEngine({
  enableFeedbackCollection: true,
  enableParameterOptimization: true,
  enableVectorAdjustment: true,
  optimizationInterval: 50,
  adjustmentInterval: 100,
  minFeedbackForOptimization: 20,
  minFeedbackForAdjustment: 50,
});

// ベクトル登録
engine.registerVector('prompt1', multiLayerVector1);
engine.registerVector('prompt2', multiLayerVector2);

// 類似度計算
const result = engine.computeSimilarity(vector1, vector2);
console.log(`類似度: ${result.score}`);
console.log(`信頼度: ${result.confidence}`);

// フィードバック記録
engine.recordFeedback(
  'prompt1',
  'result1',
  'accepted',
  {
    regenerationCount: 0,
    editCount: 1,
    dwellTime: 3000,
    clickedVariants: [],
  },
  'user1'
);

// パフォーマンス確認
const metrics = engine.getPerformanceMetrics();
console.log(`受理率: ${metrics.acceptanceRate * 100}%`);
console.log(`平均再生成回数: ${metrics.averageRegenerationCount}`);
console.log(`パラメータ収束: ${metrics.parameterConvergence}`);
```

## パフォーマンスメトリクス

- **acceptanceRate** - フィードバック受理率 (0-1)
- **averageRegenerationCount** - 平均再生成回数
- **parameterConvergence** - パラメータ収束フラグ
- **vectorSpaceQuality** - ベクトル空間品質 (0-1)

## 設定オプション

```typescript
interface LearningConfig {
  enableFeedbackCollection: boolean;      // フィードバック収集ON/OFF
  enableParameterOptimization: boolean;   // パラメータ最適化ON/OFF
  enableVectorAdjustment: boolean;        // ベクトル調整ON/OFF
  optimizationInterval: number;           // 最適化実行間隔（フィードバック数）
  adjustmentInterval: number;             // 調整実行間隔（フィードバック数）
  minFeedbackForOptimization: number;     // 最適化に必要な最小フィードバック数
  minFeedbackForAdjustment: number;       // 調整に必要な最小フィードバック数
}
```

## 実装統計

| ファイル | 行数 | 責任 |
|---------|------|------|
| SelfLearningEngine.ts | 388 | 統合制御 |
| BayesianOptimizer.ts | 377 | パラメータ最適化 |
| VectorSpaceAdjuster.ts | 339 | ベクトル空間調整 |
| FeedbackCollector.ts | 322 | フィードバック収集 |
| index.ts | 31 | エクスポート |
| **合計** | **1,457** | |

## テストカバレッジ

- テストファイル: 4
- テストケース: 43
- カバレッジ: 100%
- 合格率: 100%

## 品質基準

- TypeScriptエラー: 0件
- ESLintエラー: 0件
- テスト合格: 43/43
- Strict mode: 準拠

## 受け入れ基準

- [x] フィードバック収集APIが動作
- [x] パラメータ最適化の実装
- [x] ベクトル空間再調整の実装
- [x] 学習率の自動調整
- [x] TypeScript strictモードエラー0件
- [x] ユニットテスト全合格

## 今後の拡張

1. **オンライン学習**: リアルタイムストリーム処理
2. **分散学習**: 複数インスタンス間でパラメータ共有
3. **A/Bテスト**: 複数パラメータセットの比較
4. **可視化ダッシュボード**: メトリクス・学習曲線の可視化

---

生成AI画像キャッシュシステムの自己学習機能
© 2025 Miyabi Framework
