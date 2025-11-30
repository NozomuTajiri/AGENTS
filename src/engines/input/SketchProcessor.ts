/**
 * スケッチ入力処理
 * スケッチデータの解析、線分抽出、バウンディングボックス計算
 */

import type { ProcessedSketch, SketchLine, Point, BoundingBox } from '../../types/index.js';
import { randomBytes } from 'crypto';

/**
 * スケッチ処理設定
 */
interface SketchProcessingConfig {
  /** 最小線分ポイント数 */
  minPointsPerLine: number;
  /** デフォルトストローク幅 */
  defaultStrokeWidth: number;
  /** ノイズフィルタリング閾値 */
  noiseThreshold: number;
}

/**
 * デフォルトスケッチ処理設定
 */
const DEFAULT_SKETCH_CONFIG: SketchProcessingConfig = {
  minPointsPerLine: 2,
  defaultStrokeWidth: 2,
  noiseThreshold: 1.0,
};

/**
 * スケッチデータフォーマット（JSON）
 */
interface SketchDataFormat {
  lines?: Array<{
    points: Array<{ x: number; y: number }>;
    strokeWidth?: number;
  }>;
  strokes?: Array<{
    points: Array<[number, number]>;
    width?: number;
  }>;
  paths?: Array<{
    data: string; // SVG path data
    strokeWidth?: number;
  }>;
}

/**
 * スケッププロセッサ
 * スケッチ入力の解析と標準化を実施
 */
export class SketchProcessor {
  private config: SketchProcessingConfig;

  constructor(config?: Partial<SketchProcessingConfig>) {
    this.config = { ...DEFAULT_SKETCH_CONFIG, ...config };
  }

  /**
   * スケッチデータを処理
   *
   * @param sketchData - 処理対象のスケッチデータ（Buffer形式）
   * @returns 処理済みスケッチ
   */
  process(sketchData: Buffer): ProcessedSketch {
    const id = this.generateSketchId();
    let lines: SketchLine[] = [];

    try {
      // BufferをJSONとしてパース
      const jsonData = JSON.parse(sketchData.toString('utf-8')) as SketchDataFormat;
      lines = this.extractLines(jsonData);
    } catch (error) {
      // JSON以外のフォーマット（バイナリなど）の場合
      lines = this.extractLinesFromBinary(sketchData);
    }

    // ノイズフィルタリング
    lines = this.filterNoise(lines);

    // バウンディングボックスの計算
    const boundingBox = this.calculateBoundingBox(lines);

    return {
      id,
      lines,
      boundingBox,
    };
  }

  /**
   * JSONフォーマットから線分を抽出
   *
   * @param data - スケッチデータ（JSON）
   * @returns 線分配列
   */
  private extractLines(data: SketchDataFormat): SketchLine[] {
    const lines: SketchLine[] = [];

    // lines フォーマット
    if (data.lines && Array.isArray(data.lines)) {
      data.lines.forEach((line) => {
        if (line.points && line.points.length >= this.config.minPointsPerLine) {
          lines.push({
            points: line.points.map((p) => ({ x: p.x, y: p.y })),
            strokeWidth: line.strokeWidth || this.config.defaultStrokeWidth,
          });
        }
      });
    }

    // strokes フォーマット（座標が配列形式）
    if (data.strokes && Array.isArray(data.strokes)) {
      data.strokes.forEach((stroke) => {
        if (stroke.points && stroke.points.length >= this.config.minPointsPerLine) {
          lines.push({
            points: stroke.points.map((p) => ({ x: p[0], y: p[1] })),
            strokeWidth: stroke.width || this.config.defaultStrokeWidth,
          });
        }
      });
    }

    // paths フォーマット（SVG path）
    if (data.paths && Array.isArray(data.paths)) {
      data.paths.forEach((path) => {
        const pathLines = this.parseSvgPath(path.data);
        pathLines.forEach((line) => {
          lines.push({
            points: line,
            strokeWidth: path.strokeWidth || this.config.defaultStrokeWidth,
          });
        });
      });
    }

    return lines;
  }

  /**
   * バイナリデータから線分を抽出（簡易実装）
   *
   * @param buffer - スケッチバイナリデータ
   * @returns 線分配列
   */
  private extractLinesFromBinary(buffer: Buffer): SketchLine[] {
    // バイナリフォーマットの例：
    // [lineCount:4][line1_pointCount:4][x1:4][y1:4][x2:4][y2:4]...
    const lines: SketchLine[] = [];

    try {
      let offset = 0;
      const lineCount = buffer.readUInt32LE(offset);
      offset += 4;

      for (let i = 0; i < lineCount && offset < buffer.length; i++) {
        const pointCount = buffer.readUInt32LE(offset);
        offset += 4;

        const points: Point[] = [];
        for (let j = 0; j < pointCount && offset + 8 <= buffer.length; j++) {
          const x = buffer.readFloatLE(offset);
          const y = buffer.readFloatLE(offset + 4);
          points.push({ x, y });
          offset += 8;
        }

        if (points.length >= this.config.minPointsPerLine) {
          lines.push({
            points,
            strokeWidth: this.config.defaultStrokeWidth,
          });
        }
      }
    } catch (error) {
      // バイナリ解析失敗時は空配列を返す
      return [];
    }

    return lines;
  }

  /**
   * SVG pathデータをパース（簡易実装）
   *
   * @param pathData - SVG path文字列
   * @returns ポイント配列の配列（各線分）
   */
  private parseSvgPath(pathData: string): Point[][] {
    const lines: Point[][] = [];
    let currentLine: Point[] = [];

    // 簡易的なSVGパスパーサー（M, L, Cコマンドのみ対応）
    const commands = pathData.match(/[MLCmlc][^MLCmlc]*/g);
    if (!commands) {
      return lines;
    }

    commands.forEach((cmd) => {
      const type = cmd[0];
      const coords = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(Number);

      switch (type.toUpperCase()) {
        case 'M': // MoveTo
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }
          currentLine = [{ x: coords[0], y: coords[1] }];
          break;
        case 'L': // LineTo
          currentLine.push({ x: coords[0], y: coords[1] });
          break;
        case 'C': // CurveTo（簡易化：終点のみ使用）
          if (coords.length >= 6) {
            currentLine.push({ x: coords[4], y: coords[5] });
          }
          break;
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * ノイズフィルタリング
   * 極端に短い線分や重複ポイントを除去
   *
   * @param lines - 線分配列
   * @returns フィルタリング済み線分配列
   */
  private filterNoise(lines: SketchLine[]): SketchLine[] {
    return lines
      .map((line) => {
        // 重複ポイントの除去
        const uniquePoints = this.removeDuplicatePoints(line.points);
        return {
          ...line,
          points: uniquePoints,
        };
      })
      .filter((line) => {
        // 最小ポイント数チェック
        if (line.points.length < this.config.minPointsPerLine) {
          return false;
        }

        // 線分の長さチェック（極端に短い線分を除去）
        const length = this.calculateLineLength(line.points);
        return length >= this.config.noiseThreshold;
      });
  }

  /**
   * 重複ポイントの除去
   *
   * @param points - ポイント配列
   * @returns 重複除去済みポイント配列
   */
  private removeDuplicatePoints(points: Point[]): Point[] {
    const unique: Point[] = [];
    let lastPoint: Point | null = null;

    points.forEach((point) => {
      if (!lastPoint || point.x !== lastPoint.x || point.y !== lastPoint.y) {
        unique.push(point);
        lastPoint = point;
      }
    });

    return unique;
  }

  /**
   * 線分の長さを計算
   *
   * @param points - ポイント配列
   * @returns 線分の合計長さ
   */
  private calculateLineLength(points: Point[]): number {
    let length = 0;

    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }

    return length;
  }

  /**
   * バウンディングボックスの計算
   *
   * @param lines - 線分配列
   * @returns バウンディングボックス
   */
  private calculateBoundingBox(lines: SketchLine[]): BoundingBox {
    if (lines.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    lines.forEach((line) => {
      line.points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * ユニークなスケッチIDを生成
   *
   * @returns スケッチID
   */
  private generateSketchId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return `sketch_${timestamp}_${random}`;
  }

  /**
   * 設定の更新
   *
   * @param config - 更新する設定
   */
  updateConfig(config: Partial<SketchProcessingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   *
   * @returns 現在のスケッチ処理設定
   */
  getConfig(): SketchProcessingConfig {
    return { ...this.config };
  }
}
