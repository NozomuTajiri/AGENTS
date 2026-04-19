# Meeting Bot - tl;dv 代替の自前構築 PoC

ウェブ会議（Zoom / Google Meet / Microsoft Teams）に AI Bot を自動参加させ、
Perfect Diarization 付きの文字起こし → 価値抽出 → CRM 保存までを
**n8n + TypeScript（Node.js）** で実装するための PoC コードベースです。

## 構成（責務分割）

```
[Google Calendar] --(予定検知)--> [n8n: Step1 予約]
                                        |
                                        v
                              [Recall.ai Bot 参加]
                                        |
                          (会議終了/録音完了 Webhook)
                                        v
[Recall.ai] --(transcript JSON)--> [n8n: Step2 受信] --> [meeting-bot Webhook サーバ]
                                                              |
                                                              v
                                              [Step3 チェーンプロンプト A→B→C]
                                                              |
                                                              v
                                                    [CRM / DB へ保存]
```

詳細なアーキテクチャ図とコスト試算は [`docs/architecture.md`](docs/architecture.md) と
[`docs/cost-calculation.md`](docs/cost-calculation.md) を参照。

## 技術スタック

| レイヤ           | サービス / ライブラリ                                 |
| ---------------- | ----------------------------------------------------- |
| Bot 制御 / 録音  | [Recall.ai](https://recall.ai)                        |
| 話者分離         | Recall.ai `use_separate_streams_when_available: true` |
| 文字起こし(STT)  | Deepgram `nova-3`（Recall.ai 経由）                   |
| オーケストレータ | n8n（または本リポジトリの Express サーバ単体）        |
| LLM              | Anthropic Claude 3.5 Sonnet / OpenAI GPT-4o           |
| CRM / 保存先     | HubSpot / Salesforce / Supabase（差し替え可）         |

## ディレクトリ

```
meeting-bot/
├── README.md                ← このファイル
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts             ← Express サーバ起動
│   ├── config.ts            ← 環境変数ロード
│   ├── types.ts             ← 共有型定義
│   ├── clients/
│   │   ├── recall.ts        ← Recall.ai API クライアント
│   │   ├── deepgram.ts      ← Deepgram プロバイダ設定生成
│   │   └── llm.ts           ← Anthropic / OpenAI 共通インタフェース
│   ├── prompts/
│   │   ├── promptA.ts       ← 事実の構造化
│   │   ├── promptB.ts       ← 付加価値の分析（価値主義経営）
│   │   └── promptC.ts       ← ネクストアクション生成
│   ├── orchestrator/
│   │   └── chainPrompts.ts  ← A→B→C のチェーン実行
│   ├── server/
│   │   └── webhook.ts       ← Recall.ai Webhook 受信 → 解析 → 保存
│   └── storage/
│       └── crm.ts           ← CRM 保存アダプタ
├── n8n/
│   ├── workflow.json        ← n8n インポート用ワークフロー
│   └── README.md            ← n8n セットアップ手順
├── docs/
│   ├── architecture.md
│   └── cost-calculation.md
├── examples/
│   ├── recall-schedule-bot.json
│   └── recall-transcript-webhook.json
└── tests/
    └── chainPrompts.test.ts
```

## クイックスタート

```bash
cd meeting-bot
cp .env.example .env       # API キーを記入
npm install
npm run dev                # http://localhost:3000/webhooks/recall
```

n8n から外部公開する場合は ngrok / Cloudflare Tunnel 等で
`/webhooks/recall` を公開してください。

## PoC 実行ステップ

1. Recall.ai のアカウントを作成し API キーを取得
2. `.env` に `RECALL_API_KEY`, `ANTHROPIC_API_KEY` を設定
3. `npm run schedule -- --url <Zoom or Meet URL>` で Bot を即時投入
4. 会議終了後、Recall.ai から Webhook が飛び transcript が解析される
5. ログまたは保存先 CRM で結果を確認

## 次の手順（Phase 0 → Phase 4 までのロードマップ）

実際に動かす手順 / 本番化チェックリスト / 拡張アイデアは
[`docs/next-steps.md`](docs/next-steps.md) にまとめました。

最短でローカル疎通だけ試すには:

```bash
cd meeting-bot
npm install
npx vitest run                 # 6/6 pass
npx tsx scripts/dryRun.ts      # FakeLLM で A→B→C を疎通実行
```

## ライセンス

MIT
