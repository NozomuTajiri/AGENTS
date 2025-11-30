# Salesforce ↔ Lark Integration

SalesforceとLark間のデータ同期・Webhook処理を提供する統合モジュール

## 機能

- **OAuth認証**: Salesforce/Lark両プラットフォームのOAuth 2.0フロー
- **REST API**: Salesforce SOQLクエリ、Larkメッセージング
- **同期エンジン**: Salesforce ↔ Lark データ同期
- **Webhookハンドラー**: 両プラットフォームのイベント処理
- **Botコマンド**: LarkからSalesforceを操作
- **カレンダー連携**: ミーティング作成・管理
- **通知**: Salesforceイベントをインタラクティブカードで通知

## インストール

```bash
npm install
```

## 環境変数

`.env`ファイルを作成:

```bash
# Salesforce
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret
SALESFORCE_INSTANCE_URL=https://your-instance.salesforce.com
SALESFORCE_API_VERSION=58.0
SALESFORCE_SANDBOX=false

# Lark
LARK_APP_ID=your_app_id
LARK_APP_SECRET=your_app_secret
LARK_ENCRYPT_KEY=optional_encrypt_key
LARK_VERIFICATION_TOKEN=optional_verification_token

# Webhook
WEBHOOK_NOTIFICATION_CHAT_ID=oc_xxxxx

# Server
SERVER_PORT=3000
SERVER_HOST=0.0.0.0
SERVER_BASE_PATH=/api

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

## 使用例

### 基本的な統合

```typescript
import {
  createIntegration,
  loadConfigFromEnv,
} from './integrations';

// 環境変数から設定を読み込み
const config = loadConfigFromEnv();

// 統合クライアントを作成
const integration = createIntegration(config);

// 接続
await integration.connect();

// Salesforce Account取得
const account = await integration.getSalesforceRecord('Account', '001xxx');

// Larkにメッセージ送信
await integration.sendLarkMessage('oc_xxxxx', 'Hello from Salesforce!');
```

### Botコマンド登録

```typescript
import { createLarkBotHandler, createSalesforceCommands } from './integrations/lark';

const botHandler = createLarkBotHandler(larkClient);

// Salesforceコマンドを登録
const sfCommands = createSalesforceCommands(sfClient);
for (const cmd of sfCommands) {
  botHandler.registerCommand(cmd);
}

// メッセージ処理
await botHandler.handleMessage(chatId, userId, messageId, content);
```

### Webhookサーバー

```typescript
import { createWebhookServer } from './integrations/server';
import { loadConfigFromEnv } from './integrations/config';

const server = createWebhookServer(
  loadConfigFromEnv(),
  { port: 3000, basePath: '/api' }
);

await server.initialize();

// Express等と連携
const routes = server.getRoutes();
// routes[0] = { method: 'POST', path: '/api/webhooks/lark', handler: ... }
```

## ディレクトリ構造

```
src/integrations/
├── common/           # 共通ユーティリティ
│   ├── auth/         # OAuth認証
│   └── logger/       # ロギング・リトライ
├── salesforce/       # Salesforce連携
│   ├── mcp/          # MCP/RESTクライアント
│   ├── handlers/     # Account/Opportunityハンドラー
│   └── notifications/# 通知サービス
├── lark/             # Lark連携
│   ├── api/          # REST APIクライアント
│   ├── bot/          # Botコマンドハンドラー
│   └── calendar/     # カレンダーサービス
├── engine/           # 同期エンジン
├── server/           # Webhookサーバー
├── config/           # 設定管理
├── tests/            # テスト
│   └── mocks/        # モッククライアント
├── types/            # 型定義
└── index.ts          # エントリーポイント
```

## API一覧

### Salesforce Operations

| メソッド | 説明 |
|---------|------|
| `queryAccounts(conditions?)` | Account検索 |
| `getAccount(id)` | Account取得 |
| `createAccount(data)` | Account作成 |
| `queryOpportunities(conditions?)` | Opportunity検索 |
| `getPipeline()` | パイプライン分析 |
| `getForecast(year, quarter?)` | 売上予測 |
| `getWinRateAnalysis()` | 勝率分析 |

### Lark Operations

| メソッド | 説明 |
|---------|------|
| `sendTextMessage(chatId, text)` | テキスト送信 |
| `sendInteractiveCard(chatId, card)` | カード送信 |
| `createMeeting(request)` | ミーティング作成 |
| `getTodayEvents()` | 今日のイベント取得 |
| `getDailySummary()` | 日次サマリー |

### Bot Commands

| コマンド | 説明 |
|---------|------|
| `/sf-accounts` | Account一覧 |
| `/sf-account <id>` | Account詳細 |
| `/sf-opps` | Opportunity一覧 |
| `/sf-pipeline` | パイプライン分析 |
| `/sf-forecast [year] [q]` | 売上予測 |
| `/sf-search <query>` | 検索 |
| `/sf-tasks` | タスク一覧 |

## テスト

```typescript
import { runIntegrationTests } from './integrations/tests';

const summary = await runIntegrationTests();
console.log(`Passed: ${summary.passed}/${summary.total}`);
```

## ライセンス

MIT
