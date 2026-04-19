/**
 * エンドツーエンドのドライラン。
 *
 * examples/recall-transcript-sample.json を入力に、
 * ネットワーク呼び出しをしない FakeLlmClient でチェーンプロンプト A→B→C を実行し、
 * CRM (local JSON) に保存するまでを疎通確認する。
 */

import { loadConfig } from '../src/config.js';
import type { LlmClient, LlmCallOptions } from '../src/clients/llm.js';
import { runChainPrompts } from '../src/orchestrator/chainPrompts.js';
import { createCrmAdapter, recordKey } from '../src/storage/crm.js';
import { normalizeTranscript } from '../src/server/webhook.js';
import sample from '../examples/recall-transcript-sample.json' with { type: 'json' };

class FakeLlmClient implements LlmClient {
  private step = 0;
  async complete(opts: LlmCallOptions): Promise<string> {
    this.step += 1;
    const last = opts.messages[opts.messages.length - 1].content;
    const head = last.slice(0, 200).replace(/\n/g, ' ');
    console.log(`[FakeLLM] step=${this.step} prompt_head="${head}..."`);
    if (this.step === 1) {
      return [
        '### 1. 発言者一覧',
        '- 田尻: コンサルタント',
        '- 顧客 山田: 顧客側担当',
        '',
        '### 2. ペインポイント',
        '- [顧客 山田] マネージャーの評価面談に毎月20時間',
        '- [顧客 山田] 新規案件の決裁スピードが遅く取りこぼし増加',
        '',
        '### 3. 数値・事実情報',
        '- 評価面談に月 20 時間',
        '- 売上前年比 105% 着地見込み',
        '',
        '### 4. 決定事項',
        '- （なし）',
        '',
        '### 5. 未解決の論点',
        '- 評価面談の負荷削減方針',
        '- 決裁プロセスの短縮方針',
      ].join('\n');
    }
    if (this.step === 2) {
      return [
        '## 1. 潜在ニーズ仮説（3つ）',
        '- マネージャーを「評価者」から「成長支援者」に役割再定義する仕組み (高)',
        '- 決裁の型化による意思決定リードタイム短縮 (中)',
        '- 現場データの可視化による評価コスト半減 (中)',
        '',
        '## 2. 提供可能な付加価値',
        '- 価値主義経営 1on1 テンプレート',
        '- 決裁フロー診断 & リデザイン',
        '- KPI ダッシュボード導入支援',
        '',
        '## 3. リスク',
        '- 経営層の合意形成が必要',
        '- 既存評価制度との整合性',
      ].join('\n');
    }
    return [
      '## 1. 次回提案書の目次案',
      '1. 現状の課題サマリ',
      '2. 価値主義経営による再定義',
      '3. 1on1 テンプレート導入案',
      '4. 決裁フロー診断',
      '5. KPI ダッシュボード',
      '6. 投資対効果試算',
      '7. 導入ロードマップ',
      '8. 次回アクション',
      '',
      '## 2. アクションアイテム',
      '| 担当 | アクション | 期日 | 完了条件 |',
      '|------|-----------|------|---------|',
      '| 田尻 | 提案書ドラフト作成 | 3 営業日以内 | Draft 1 完成 |',
      '| 未割当（推奨: 山田） | 評価面談ログ共有 | 翌週末 | 直近 3 ヶ月分の提供 |',
      '',
      '## 3. 顧客フォローメール（ドラフト）',
      '件名: 本日の打合せのお礼と次回提案について',
      '本文: 本日はお時間ありがとうございました...',
    ].join('\n');
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const transcript = normalizeTranscript(sample, 'bot_abc123');
  const llm = new FakeLlmClient();
  const crm = createCrmAdapter(cfg);

  console.log(`[dryRun] utterances=${transcript.utterances.length} speakers=${Array.from(new Set(transcript.utterances.map((u) => u.speaker))).join(' / ')}`);

  const result = await runChainPrompts(llm, transcript, {
    customerName: (sample.metadata && sample.metadata.customer_name) as string | undefined,
    meetingPurpose: (sample.metadata && sample.metadata.meeting_purpose) as string | undefined,
  });

  console.log(`[dryRun] key=${recordKey(result)}`);
  const saved = await crm.save(result);
  console.log(`[dryRun] saved -> ${saved.location}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
