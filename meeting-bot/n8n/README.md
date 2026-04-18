# n8n セットアップ手順

## 概要

`workflow.json` は以下 4 つのワークフローを 1 ファイルに束ねたものです。
n8n の **「Import from File」** 機能で読み込むだけで、Step1〜Step4 が一括で配置されます。

| Step | 名称              | トリガ                                   | 役割                                   |
| ---- | ----------------- | ---------------------------------------- | -------------------------------------- |
| 1    | Schedule Bot      | Google Calendar (event created/updated)  | 予定の URL を抽出し Recall.ai に予約   |
| 2    | Receive Webhook   | Webhook (POST `/recall-transcript`)      | Recall.ai からの transcript を受信     |
| 3    | Chain Prompts     | Step2 から呼び出し                       | A→B→C のプロンプトを直列実行           |
| 4    | Persist to CRM    | Step3 から呼び出し                       | CRM (HubSpot/Salesforce/Supabase) 保存 |

## 必要な Credential

- **Google Calendar OAuth2** (`googleCalendarOAuth2Api`)
- **Recall.ai API Token** (`httpHeaderAuth`: `Authorization: Token <RECALL_API_KEY>`)
- **Anthropic API** (`httpHeaderAuth`: `x-api-key: <ANTHROPIC_API_KEY>`)
- 任意: **HubSpot / Salesforce / Supabase** の API Token

## インポート手順

1. n8n の左メニュー → Workflows → 「Import from File」
2. `meeting-bot/n8n/workflow.json` を選択
3. 各ノードに作成済みの Credential を割り当てる
4. Webhook ノードの「Production URL」をコピーして
   Recall.ai の Bot 作成リクエスト（`recording_config.webhooks[].url`）に設定

## ローカル開発時の Webhook 受け方

n8n を使わず、本リポジトリの Express サーバ（`npm run dev`）で受ける場合は、
[`recall-schedule-bot.json`](../examples/recall-schedule-bot.json) の `webhooks[].url` を
`http://<your-tunnel>/webhooks/recall` に書き換えてください。
