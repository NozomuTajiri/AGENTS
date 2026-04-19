/**
 * CRM 保存アダプタ
 *
 * デフォルトはローカル JSON 出力。HubSpot / Salesforce / Supabase 等への
 * 接続は本番化時に差し替える前提で stub を用意する。
 *
 * 命名規則: `[YYYYMMDD]_[customerName]_[meetingPurpose].json`
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AppConfig } from '../config.js';
import type { ChainResult } from '../types.js';

export interface SavedRecord {
  id: string;
  location: string; // file path / record id / row id
}

function sanitize(value: string): string {
  // 英数字 / 日本語(かな・カナ・漢字) のみ残し、それ以外は `_` に変換
  return value
    .replace(/[^A-Za-z0-9一-龯ぁ-んァ-ヶー]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function recordKey(result: ChainResult): string {
  const date = new Date(result.meta.occurredAt);
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const customer = sanitize(result.meta.customerName ?? 'unknown');
  const purpose = sanitize(result.meta.meetingPurpose ?? 'meeting');
  return `${ymd}_${customer}_${purpose}`;
}

export interface CrmAdapter {
  save(result: ChainResult): Promise<SavedRecord>;
}

class LocalJsonAdapter implements CrmAdapter {
  constructor(private readonly dir: string) {}

  async save(result: ChainResult): Promise<SavedRecord> {
    const key = recordKey(result);
    const filePath = join(this.dir, `${key}.json`);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
    return { id: key, location: filePath };
  }
}

class StubAdapter implements CrmAdapter {
  constructor(private readonly name: string) {}

  async save(result: ChainResult): Promise<SavedRecord> {
    const key = recordKey(result);
    console.log(`[crm:${this.name}] would save record key=${key}`);
    return { id: key, location: `${this.name}://pending/${key}` };
  }
}

export function createCrmAdapter(cfg: AppConfig): CrmAdapter {
  switch (cfg.crm.provider) {
    case 'hubspot':
      return new StubAdapter('hubspot');
    case 'salesforce':
      return new StubAdapter('salesforce');
    case 'supabase':
      return new StubAdapter('supabase');
    case 'local':
    default:
      return new LocalJsonAdapter(cfg.crm.localDir);
  }
}
