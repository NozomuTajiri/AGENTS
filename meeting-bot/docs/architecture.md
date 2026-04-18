# アーキテクチャ詳細

## 設計原則

1. **責務分離**: Bot 制御は SaaS（Recall.ai）、AI 解析は自社で完全制御。
2. **チェーンプロンプト**: 1 プロンプトで詰め込まず、A → B → C を直列化して再現性とデバッグ容易性を確保。
3. **データ主権**: 文字起こし・解析結果は自社 CRM / DB に保存。tl;dv 等 SaaS にロックインされない。
4. **Perfect Diarization**: ウェブ会議のプラットフォーム側でストリーム単位の音声を取得できるため、話者分離精度を 100% に近付けられる。

## シーケンス

```
Google Calendar
   │  (event.created/updated)
   ▼
n8n Step1: Extract URL ──► Recall.ai POST /api/v1/bot/
                              │  (use_separate_streams_when_available: true)
                              ▼
                          Bot joins Zoom/Meet/Teams
                              │ (record + Deepgram nova-3 transcribe)
                              ▼
                          transcript.done webhook
                              │
                              ▼
n8n Step2 (or meeting-bot Express): receive ─► fetch transcript
                              │
                              ▼
n8n Step3: Prompt A (facts) ─► Prompt B (value) ─► Prompt C (next action)
                              │
                              ▼
n8n Step4: persist to CRM (HubSpot/Salesforce/Supabase/local JSON)
```

## なぜ Recall.ai か

| 観点                  | 自前 (Selenium で参加させる) | Recall.ai |
| --------------------- | ----------------------------- | --------- |
| Zoom/Meet/Teams 全対応 | 各 SDK 個別実装が必要         | API 1 本 |
| 音声ストリーム単位の話者分離 | 困難                       | 提供済み |
| プラットフォーム仕様変更対応 | 自社で追従                  | SaaS 側で吸収 |
| 法務（録画許諾の表示）  | 自前で UI 必要                | Bot 名表示で対応可 |

## 役割分担サマリ

| コンポーネント | 役割                                                 |
| -------------- | ---------------------------------------------------- |
| Recall.ai      | 会議参加・録音・話者ストリーム分離・transcript 配信  |
| Deepgram       | 音声→テキスト（多言語混在対応 `nova-3`）             |
| n8n            | 全体オーケストレーション (Calendar 連携 / Webhook 受信 / LLM 連結) |
| meeting-bot    | n8n を使わない場合の代替実装。チェーンプロンプト ＋ CRM 保存 |
| Anthropic / OpenAI | チェーンプロンプト A/B/C 実行                    |
| CRM / DB       | 結果保存・命名規則統一・将来的なベクトル検索基盤     |
