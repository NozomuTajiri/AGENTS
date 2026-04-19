# 次の手順（PoC 実行 → 本番化）

このドキュメントは、本リポジトリに追加した `meeting-bot/` を実際に動かし、
本番運用まで持っていくための手順をフェーズ別にまとめたものです。

---

## Phase 0: ローカル疎通確認（API キー不要）

```bash
cd meeting-bot
npm install                # 依存をインストール
npx tsc --noEmit           # 型チェック
npx vitest run             # 6/6 pass を確認
npx tsx scripts/dryRun.ts  # FakeLLM で A→B→C を疎通実行
```

`data/meetings/[YYYYMMDD]_サンプル株式会社_初回ヒアリング.json` が生成されれば OK。

---

## Phase 1: ローカル PoC（実 API キーあり）

### 1-1. API キー準備

| サービス        | 取得先                                                                 | 用途                        |
| --------------- | ---------------------------------------------------------------------- | --------------------------- |
| Recall.ai       | <https://recall.ai> → Dashboard → API Keys                             | Bot 制御 / transcript       |
| Anthropic       | <https://console.anthropic.com/settings/keys>                          | Claude 3.5 Sonnet           |
| OpenAI（任意）  | <https://platform.openai.com/api-keys>                                 | GPT-4o（Anthropic の代替）  |

### 1-2. 環境変数設定

```bash
cd meeting-bot
cp .env.example .env
# .env を開いて以下を設定
#   RECALL_API_KEY=...
#   ANTHROPIC_API_KEY=...
#   PUBLIC_BASE_URL=https://<ngrok URL>
```

### 1-3. サーバ起動 & トンネル公開

```bash
npm run dev                       # localhost:3000 で起動
# 別ターミナル
ngrok http 3000                   # → https://xxxx.ngrok.app を控える
```

`PUBLIC_BASE_URL` を ngrok URL に書き換えると、`/webhooks/recall` が外部公開されます。

### 1-4. テスト会議に Bot を投入

```bash
npm run schedule -- \
  --url "https://zoom.us/j/<your-meeting-id>" \
  --customer "テスト株式会社" \
  --purpose "PoC 検証会議"
```

レスポンスに `bot.id` が含まれます。会議を開始すると「カクシン AI」という名前の
Bot が自動参加し、録音を開始します。

### 1-5. 結果確認

会議終了後 1〜3 分で Recall.ai から `transcript.done` Webhook が飛び、
A → B → C のチェーンプロンプトが走ります:

```
data/meetings/[YYYYMMDD]_テスト株式会社_PoC_検証会議.json
```

中身に `promptA / promptB / promptC` が入っていれば PoC 成功です。

---

## Phase 2: n8n への移行

### 2-1. n8n インスタンス準備

- Self-hosted: Docker で `npm run start:n8n`（任意）
- Cloud: <https://n8n.io> のクラウド版を利用

### 2-2. ワークフローインポート

1. n8n UI → Workflows → **Import from File**
2. `meeting-bot/n8n/workflow.json` を選択
3. Credential を割り当て（詳細は `meeting-bot/n8n/README.md`）
   - Google Calendar OAuth2
   - Recall.ai (`Authorization: Token <RECALL_API_KEY>`)
   - Anthropic (`x-api-key: <ANTHROPIC_API_KEY>`)
4. Webhook ノードの Production URL をコピー → 環境変数 `N8N_WEBHOOK_URL` に設定
5. Activate（右上トグル）

### 2-3. 動作確認

Google Calendar に Zoom URL を含むテスト予定を作成 → 開始時刻に Bot が自動参加 →
会議終了後に n8n の Execution が走ることを確認。

---

## Phase 3: 本番化チェックリスト

| 項目                                        | 状態 | 備考                                                                          |
| ------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| Recall.ai Webhook の HMAC-SHA256 署名検証   | ☐    | 現在は共有シークレット方式。`x-recall-signature` を使う方式に差し替え          |
| LLM API キーのローテーション運用            | ☐    | 90 日ローテーション + Secret Manager 利用を推奨                              |
| CRM 連携アダプタ実装                        | ☐    | `src/storage/crm.ts` の HubSpot / Salesforce / Supabase スタブを本実装        |
| 会議参加の事前通知（社内 / 顧客向け）       | ☐    | 録音許諾を満たすため、Bot 名と通知ポリシーを明文化                            |
| プロンプト A/B/C のチューニング             | ☐    | 識学理論ラベル付与、価値主義経営テンプレ反映                                  |
| 失敗時の Dead Letter Queue / リトライ設計   | ☐    | n8n 側で Error Trigger ワークフローを別途作成                                 |
| ログ・監視                                  | ☐    | Webhook 受信〜CRM 保存までのトレース ID 付与、Datadog 等への送信              |
| コスト監視                                  | ☐    | 月次で `Recall.ai 使用時間 × $0.50 + Deepgram + LLM` を Slack 通知            |
| 法務確認（録音録画の同意取得）              | ☐    | Bot 参加時に表示される名称、議事録共有範囲を社内ポリシーと擦り合わせ          |

---

## Phase 4: 拡張アイデア（オプション）

- **ベクトル DB 連携**: 過去の議事録を Supabase pgvector に格納し、
  プロンプト A の前段で「過去の関連会議」を RAG で注入する
- **Slack 配信**: チェーン完了後に Step C の出力を担当者の DM へ自動投稿
- **HubSpot Deal 自動更新**: 顧客名が一致する Deal の Notes に Step C のメール下書きを追記
- **同時通訳**: Deepgram の `language: multi` に加え、別の翻訳ステップを追加して英語サマリも自動生成
