/**
 * 環境変数ロード（Zod 不使用、軽量バリデーション）
 */

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export interface AppConfig {
  port: number;
  publicBaseUrl: string;
  webhookSecret: string;
  recall: {
    apiKey: string;
    region: string;
    botName: string;
    baseUrl: string;
  };
  deepgram: {
    model: string;
    language: string;
  };
  llm: {
    provider: 'anthropic' | 'openai';
    anthropicApiKey: string;
    anthropicModel: string;
    openaiApiKey: string;
    openaiModel: string;
  };
  crm: {
    provider: 'local' | 'hubspot' | 'salesforce' | 'supabase';
    hubspotToken: string;
    salesforceToken: string;
    supabaseUrl: string;
    supabaseKey: string;
    localDir: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const region = optional('RECALL_REGION', 'us-west-2');
  return {
    port: Number(env.PORT ?? 3000),
    publicBaseUrl: optional('PUBLIC_BASE_URL', `http://localhost:${env.PORT ?? 3000}`),
    webhookSecret: optional('WEBHOOK_SECRET', 'dev-secret'),
    recall: {
      apiKey: optional('RECALL_API_KEY'),
      region,
      botName: optional('RECALL_BOT_NAME', 'カクシン AI'),
      baseUrl: `https://${region}.recall.ai`,
    },
    deepgram: {
      model: optional('DEEPGRAM_MODEL', 'nova-3'),
      language: optional('DEEPGRAM_LANGUAGE', 'multi'),
    },
    llm: {
      provider: (optional('LLM_PROVIDER', 'anthropic') as 'anthropic' | 'openai'),
      anthropicApiKey: optional('ANTHROPIC_API_KEY'),
      anthropicModel: optional('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest'),
      openaiApiKey: optional('OPENAI_API_KEY'),
      openaiModel: optional('OPENAI_MODEL', 'gpt-4o'),
    },
    crm: {
      provider: (optional('CRM_PROVIDER', 'local') as AppConfig['crm']['provider']),
      hubspotToken: optional('HUBSPOT_TOKEN'),
      salesforceToken: optional('SALESFORCE_TOKEN'),
      supabaseUrl: optional('SUPABASE_URL'),
      supabaseKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
      localDir: optional('LOCAL_STORAGE_DIR', './data/meetings'),
    },
  };
}

// `required` を将来エクスポート用に保持
export { required };
