/**
 * Bot 即時投入スクリプト
 *
 * 使い方:
 *   npm run schedule -- --url https://zoom.us/j/123 --customer "顧客名" --purpose "初回ヒアリング"
 */

import { loadConfig } from '../src/config.js';
import { RecallClient } from '../src/clients/recall.js';

interface CliArgs {
  url?: string;
  customer?: string;
  purpose?: string;
  joinAt?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--url':
        out.url = next;
        i++;
        break;
      case '--customer':
        out.customer = next;
        i++;
        break;
      case '--purpose':
        out.purpose = next;
        i++;
        break;
      case '--join-at':
        out.joinAt = next;
        i++;
        break;
      default:
        break;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error('Usage: schedule --url <meeting-url> [--customer ...] [--purpose ...] [--join-at ISO]');
    process.exit(1);
  }
  const cfg = loadConfig();
  const recall = new RecallClient(cfg);
  const webhookUrl = `${cfg.publicBaseUrl}/webhooks/recall`;
  const bot = await recall.scheduleBot({
    meetingUrl: args.url,
    joinAt: args.joinAt,
    customerName: args.customer,
    meetingPurpose: args.purpose,
    webhookUrl,
  });
  console.log(JSON.stringify(bot, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
