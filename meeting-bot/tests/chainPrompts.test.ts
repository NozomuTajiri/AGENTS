import { describe, expect, it } from 'vitest';
import {
  runChainPrompts,
  transcriptToText,
} from '../src/orchestrator/chainPrompts.js';
import type { LlmClient } from '../src/clients/llm.js';
import type { RecallTranscript } from '../src/types.js';
import { normalizeTranscript } from '../src/server/webhook.js';
import sample from '../examples/recall-transcript-sample.json' with { type: 'json' };
import { recordKey } from '../src/storage/crm.js';

class FakeLlm implements LlmClient {
  public calls: string[] = [];

  async complete(opts: { messages: { content: string }[] }): Promise<string> {
    const last = opts.messages[opts.messages.length - 1].content;
    this.calls.push(last);
    if (this.calls.length === 1) return 'FACTS_OUTPUT';
    if (this.calls.length === 2) {
      expect(last).toContain('FACTS_OUTPUT');
      return 'VALUE_OUTPUT';
    }
    expect(last).toContain('VALUE_OUTPUT');
    return 'NEXT_ACTION_OUTPUT';
  }
}

describe('transcriptToText', () => {
  it('formats utterances as `speaker: text`', () => {
    const text = transcriptToText([
      { speaker: 'A', text: 'hello', words: [], start: 0, end: 1 },
      { speaker: 'B', text: 'world', words: [], start: 1, end: 2 },
    ]);
    expect(text).toBe('A: hello\nB: world');
  });
});

describe('normalizeTranscript', () => {
  it('passes through utterances[]', () => {
    const t = normalizeTranscript(sample, 'bot_abc123');
    expect(t.utterances.length).toBe(4);
    expect(t.utterances[0].speaker).toBe('田尻');
  });

  it('builds text from words[] when text is empty', () => {
    const t = normalizeTranscript(
      {
        utterances: [
          {
            speaker: 'A',
            words: [{ text: 'hi', start_timestamp: { relative: 0 }, end_timestamp: { relative: 1 } }],
            start: 0,
            end: 1,
            text: '',
          },
        ],
      },
      'bot_x',
    );
    expect(t.utterances[0].text).toBe('hi');
  });

  it('returns empty utterances on unknown shape', () => {
    const t = normalizeTranscript({ foo: 'bar' }, 'bot_y');
    expect(t.utterances).toEqual([]);
  });
});

describe('runChainPrompts', () => {
  it('chains A -> B -> C and aggregates metadata', async () => {
    const transcript: RecallTranscript = normalizeTranscript(sample, 'bot_abc123');
    const llm = new FakeLlm();
    const result = await runChainPrompts(llm, transcript, {
      customerName: 'サンプル株式会社',
      meetingPurpose: '初回ヒアリング',
    });
    expect(llm.calls.length).toBe(3);
    expect(result.promptA).toBe('FACTS_OUTPUT');
    expect(result.promptB).toBe('VALUE_OUTPUT');
    expect(result.promptC).toBe('NEXT_ACTION_OUTPUT');
    expect(result.meta.botId).toBe('bot_abc123');
    expect(result.meta.speakers).toContain('田尻');
    expect(result.meta.speakers).toContain('顧客 山田');
    expect(result.meta.durationSec).toBeGreaterThan(0);
  });
});

describe('recordKey', () => {
  it('builds standardized key [YYYYMMDD]_[customer]_[purpose]', () => {
    const key = recordKey({
      promptA: '',
      promptB: '',
      promptC: '',
      meta: {
        botId: 'b1',
        customerName: 'Acme Inc.',
        meetingPurpose: 'Kickoff Meeting',
        occurredAt: '2026-04-18T10:00:00Z',
        durationSec: 0,
        speakers: [],
      },
    });
    expect(key).toMatch(/^\d{8}_Acme_Inc_Kickoff_Meeting$/);
  });
});
