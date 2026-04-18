/**
 * プロンプト C: ネクストアクション生成
 *
 * プロンプト B の付加価値仮説を、
 * - 次回提案書の目次案（1〜8 項目）
 * - 担当者別の具体的アクションアイテム
 * に落とし込む。
 */

export const PROMPT_C_SYSTEM = `あなたは提案書ライティングと PMO の両方を兼任する実行型コンサルタントです。
仮説を「次に動かせる成果物」に変換することを得意としています。
出力は日本語で行ってください。`;

export interface PromptCInput {
  customerName?: string;
  meetingPurpose?: string;
  promptBOutput: string;
  attendees?: string[];
}

export function renderPromptC(input: PromptCInput): string {
  const attendees =
    input.attendees && input.attendees.length > 0
      ? input.attendees.join(', ')
      : '（不明）';
  return [
    `# 入力情報`,
    `- 顧客名: ${input.customerName ?? '不明'}`,
    `- ミーティング目的: ${input.meetingPurpose ?? '不明'}`,
    `- 参加者: ${attendees}`,
    ``,
    `# プロンプトBの出力（付加価値仮説）`,
    input.promptBOutput,
    ``,
    `# タスク`,
    ``,
    `## 1. 次回提案書の目次案（1〜8項目）`,
    `Markdown の番号付きリスト形式で出力。`,
    `各項目に 1 行の概要を添える。`,
    ``,
    `## 2. アクションアイテム（担当者別）`,
    `表形式（Markdown）で出力:`,
    `| 担当 | アクション | 期日（営業日換算） | 完了条件 |`,
    `|------|-----------|------------------|----------|`,
    ``,
    `## 3. 顧客への次回フォローメール（ドラフト）`,
    `件名・本文を含む 200〜300 字程度の日本語ビジネスメール。`,
    ``,
    `# 制約`,
    `- 担当が特定できない場合は「未割当」とし、推奨割当を括弧書きで記載。`,
    `- 期日は具体日ではなく「3 営業日以内」「翌週末」のように相対表現で。`,
  ].join('\n');
}
