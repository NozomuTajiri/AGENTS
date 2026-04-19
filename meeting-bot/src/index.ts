/**
 * meeting-bot サーバ起動エントリ
 */

import express from 'express';
import { loadConfig } from './config.js';
import { createWebhookRouter } from './server/webhook.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/webhooks', createWebhookRouter({ cfg }));

  app.listen(cfg.port, () => {
    console.log(`[meeting-bot] listening on http://localhost:${cfg.port}`);
    console.log(`  webhook: POST ${cfg.publicBaseUrl}/webhooks/recall`);
    console.log(`  llm provider: ${cfg.llm.provider}`);
    console.log(`  crm provider: ${cfg.crm.provider}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
