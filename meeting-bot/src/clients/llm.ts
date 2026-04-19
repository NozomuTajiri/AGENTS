/**
 * LLM 共通インタフェース
 *
 * Anthropic Messages API / OpenAI Chat Completions API を最小限ラップ。
 * SDK を導入すると依存が増えるため fetch で直接叩く。
 */

import type { AppConfig } from '../config.js';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCallOptions {
  system?: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmClient {
  complete(opts: LlmCallOptions): Promise<string>;
}

class AnthropicClient implements LlmClient {
  constructor(private readonly cfg: AppConfig) {}

  async complete(opts: LlmCallOptions): Promise<string> {
    if (!this.cfg.llm.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.cfg.llm.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.cfg.llm.anthropicModel,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.2,
        system: opts.system,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    return data.content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text!)
      .join('\n');
  }
}

class OpenAIClient implements LlmClient {
  constructor(private readonly cfg: AppConfig) {}

  async complete(opts: LlmCallOptions): Promise<string> {
    if (!this.cfg.llm.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    const messages: LlmMessage[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push(...opts.messages);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.llm.openaiApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.cfg.llm.openaiModel,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.2,
        messages,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? '';
  }
}

export function createLlmClient(cfg: AppConfig): LlmClient {
  return cfg.llm.provider === 'openai' ? new OpenAIClient(cfg) : new AnthropicClient(cfg);
}
