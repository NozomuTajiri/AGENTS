/**
 * 自己学習型マルチレイヤーセマンティック解析システム - 型定義
 * 特許: 生成AI画像のキャッシュシステム及び方法
 */

// ==================== 基本型 ====================

export type LayerType = 'subject' | 'attribute' | 'style' | 'composition' | 'emotion';

export interface LayerDimensions {
  subject: 128;
  attribute: 96;
  style: 64;
  composition: 48;
  emotion: 32;
}

export const LAYER_DIMENSIONS: LayerDimensions = {
  subject: 128,
  attribute: 96,
  style: 64,
  composition: 48,
  emotion: 32,
};

// ==================== 入力処理 ====================

export interface ProcessedPrompt {
  original: string;
  normalized: string;
  language: string;
  tokens: string[];
  metadata: PromptMetadata;
}

export interface PromptMetadata {
  wordCount: number;
  charCount: number;
  hasSpecialChars: boolean;
  detectedEntities: string[];
}

export interface ProcessedImage {
  id: string;
  format: 'png' | 'jpg' | 'webp';
  width: number;
  height: number;
  data: Buffer;
  thumbnail: Buffer;
}

export interface ProcessedSketch {
  id: string;
  lines: SketchLine[];
  boundingBox: BoundingBox;
}

export interface SketchLine {
  points: Point[];
  strokeWidth: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MultiModalInput {
  text?: string;
  image?: Buffer;
  sketch?: Buffer;
  referenceImages?: Buffer[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ==================== ベクトル化 ====================

export interface MultiLayerVector {
  subject: Float32Array;      // 128次元
  attribute: Float32Array;    // 96次元
  style: Float32Array;        // 64次元
  composition: Float32Array;  // 48次元
  emotion: Float32Array;      // 32次元
  relationMatrix: number[][];  // 5x5
  timestamp: Date;
}

export interface LayerVectors {
  [key: string]: Float32Array;
}

export interface RelationMatrix {
  data: number[][];
  layers: LayerType[];
}

// ==================== フィードバック・学習 ====================

export interface FeedbackData {
  promptId: string;
  resultId: string;
  explicit: 'accepted' | 'rejected' | null;
  implicit: ImplicitFeedback;
  timestamp: Date;
  userId?: string;
}

export interface ImplicitFeedback {
  regenerationCount: number;
  editCount: number;
  dwellTime: number;
  clickedVariants: string[];
}

export interface UsageHistory {
  userId: string;
  sessions: SessionData[];
  preferences: UserPreferences;
}

export interface SessionData {
  sessionId: string;
  prompts: string[];
  results: string[];
  feedback: FeedbackData[];
  startTime: Date;
  endTime?: Date;
}

export interface UserPreferences {
  preferredStyles: string[];
  colorPreferences: string[];
  qualityPreference: 'speed' | 'balanced' | 'quality';
}

export interface SystemParams {
  layerWeights: Record<LayerType, number>;
  thresholds: Thresholds;
  learningRate: number;
}

export interface Thresholds {
  cacheHit: number;      // 閾値1: キャッシュヒット
  diffGeneration: number; // 閾値2: 差分生成
}

export interface LayerWeights {
  subject: number;
  attribute: number;
  style: number;
  composition: number;
  emotion: number;
}

export interface Gradient {
  layerWeights: Record<LayerType, number>;
  thresholds: Partial<Thresholds>;
}

// ==================== 類似度計算 ====================

export interface SimilarityMetrics {
  cosine: number;
  semanticTree: number;
  latentSemantic: number;
  contextualCoherence: number;
}

export interface DecisionResult {
  action: 'cache_hit' | 'diff_generation' | 'new_generation';
  confidence: number;
  uncertainty: number;
  matchedItem?: CacheItem;
  diffStrength?: number;
  metrics: SimilarityMetrics;
}

// ==================== 画像管理 ====================

export type ImagePartType = 'foreground' | 'background' | 'detail' | 'global';

export interface ImagePart {
  id: string;
  type: ImagePartType;
  boundingBox: BoundingBox;
  mask: Uint8Array;
  vectors: MultiLayerVector;
  metadata: PartMetadata;
}

export interface PartMetadata {
  tags: string[];
  confidence: number;
  generationParams?: GenerationParams;
}

export interface GenerationParams {
  model: string;
  seed: number;
  steps: number;
  cfgScale: number;
  denoisingStrength?: number;
}

export interface PromptDelta {
  addedTerms: string[];
  removedTerms: string[];
  modifiedTerms: Array<{ from: string; to: string }>;
  semanticDistance: number;
}

export interface CompositionResult {
  image: Buffer;
  parts: ImagePart[];
  blendWeights: number[];
  quality: number;
}

// ==================== ストレージ ====================

export type StorageLevel = 'L1' | 'L2' | 'L3' | 'cold';

export interface StorageLayer {
  level: StorageLevel;
  capacity: number;
  currentUsage: number;
  latency: number;
  items: Map<string, CacheItem>;
}

export interface CacheItem {
  id: string;
  vector: MultiLayerVector;
  image: Buffer;
  metadata: ImageMetadata;
  accessCount: number;
  lastAccess: Date;
  generationDifficulty: number;
  storageLevel: StorageLevel;
}

export interface ImageMetadata {
  prompt: string;
  generationParams: GenerationParams;
  createdAt: Date;
  size: number;
  format: string;
  dimensions: { width: number; height: number };
}

export interface QueryContext {
  userId?: string;
  sessionId?: string;
  previousPrompts: string[];
  timeOfDay: number;
}

// ==================== ユースケース最適化 ====================

export type UseCaseType = 'ecommerce' | 'advertising' | 'gaming';

export interface GenerationRequest {
  prompt: string;
  referenceImages?: Buffer[];
  constraints?: GenerationConstraints;
  useCase?: UseCaseType;
  metadata?: Record<string, unknown>;
}

export interface GenerationConstraints {
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: string;
  style?: string;
  colorPalette?: string[];
}

export interface GenerationResult {
  id: string;
  image: Buffer;
  prompt: string;
  vector: MultiLayerVector;
  metadata: ImageMetadata;
  fromCache: boolean;
  processingTime: number;
}

export interface OptimizedRequest extends GenerationRequest {
  optimizations: Optimization[];
  priority: number;
}

export interface Optimization {
  type: string;
  applied: boolean;
  impact: number;
}

export interface ProcessedResult extends GenerationResult {
  postProcessing: PostProcessingInfo;
}

export interface PostProcessingInfo {
  applied: string[];
  duration: number;
}

// ==================== Eコマース ====================

export interface Product {
  id: string;
  name: string;
  category: string;
  attributes: ProductAttribute[];
  images: string[];
}

export interface ProductAttribute {
  name: string;
  value: string;
  type: 'color' | 'size' | 'material' | 'style' | 'other';
}

export interface ProductCatalog {
  products: Product[];
  categories: string[];
  brands: string[];
}

export interface StyleGuide {
  brandColors: string[];
  typography: TypographySettings;
  imageGuidelines: ImageGuidelines;
}

export interface TypographySettings {
  primaryFont: string;
  secondaryFont: string;
  headingSize: number;
  bodySize: number;
}

export interface ImageGuidelines {
  aspectRatio: string;
  minResolution: number;
  backgroundStyle: string;
  lightingStyle: string;
}

// ==================== 広告 ====================

export interface Campaign {
  id: string;
  name: string;
  targetDemographics: Demographic[];
  theme: string;
  templates: Template[];
}

export interface Demographic {
  ageRange: [number, number];
  gender?: 'male' | 'female' | 'all';
  interests: string[];
  region?: string;
}

export interface Template {
  id: string;
  name: string;
  layout: string;
  placeholders: Placeholder[];
}

export interface Placeholder {
  id: string;
  type: 'image' | 'text' | 'logo';
  position: BoundingBox;
  constraints: PlaceholderConstraints;
}

export interface PlaceholderConstraints {
  minWidth?: number;
  maxWidth?: number;
  aspectRatio?: string;
  allowedFormats?: string[];
}

export interface CampaignCache {
  templateImages: Map<string, Buffer>;
  demographicVariations: Map<string, Buffer[]>;
  messageOverlays: Map<string, Buffer>;
}

// ==================== ゲーム ====================

export interface GameCharacter {
  id: string;
  name: string;
  baseAppearance: CharacterAppearance;
  variations: CharacterVariation[];
}

export interface CharacterAppearance {
  body: string;
  face: string;
  clothing: string;
  accessories: string[];
}

export interface CharacterVariation {
  name: string;
  type: 'pose' | 'expression' | 'outfit' | 'color';
  parameters: Record<string, unknown>;
}

export interface CharacterRegistry {
  characters: GameCharacter[];
  styles: GameStyleGuide;
}

export interface GameStyleGuide {
  artStyle: string;
  colorPalette: string[];
  lightingPresets: LightingPreset[];
}

export interface LightingPreset {
  name: string;
  direction: [number, number, number];
  intensity: number;
  color: string;
}

export interface Asset {
  id: string;
  type: 'character' | 'environment' | 'prop' | 'effect';
  baseImage: Buffer;
  metadata: AssetMetadata;
}

export interface AssetMetadata {
  tags: string[];
  category: string;
  compatible: string[];
}

export type VariationType = 'pose' | 'expression' | 'lighting' | 'color' | 'background';

// ==================== ベンチマーク ====================

export interface BenchmarkResult {
  latency: LatencyMetrics;
  throughput: number;
  cacheHitRate: number;
  resourceUsage: ResourceUsage;
  timestamp: Date;
}

export interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
}

export interface ResourceUsage {
  cpu: number;
  gpu: number;
  memory: number;
  storage: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  assertions: AssertionResult[];
}

export interface AssertionResult {
  description: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
}

export interface BenchmarkReport {
  summary: BenchmarkSummary;
  details: BenchmarkResult[];
  recommendations: string[];
}

export interface BenchmarkSummary {
  totalTests: number;
  passedTests: number;
  averageLatency: number;
  peakThroughput: number;
  overallScore: number;
}
