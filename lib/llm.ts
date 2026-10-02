import 'server-only';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from './config';

const DEFAULT_MODEL = { openai: 'gpt-4o-mini', anthropic: 'claude-haiku-4-5' } as const;
type Provider = keyof typeof DEFAULT_MODEL;

let openai: OpenAI | undefined;
let anthropic: Anthropic | undefined;

/** 응답 텍스트에서 첫 '{' ~ 마지막 '}'만 파싱 (코드 블록·앞뒤 설명이 섞여도 견디게) */
export function parseJSONObject<T>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(text.slice(start, end + 1));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

/**
 * AI 1회 호출 → JSON 파싱 결과. 실패·시간 초과·파싱 오류면 null (호출부는 SPEC §10.3 대체 동작).
 * 공급자는 env LLM_PROVIDER(openai | anthropic), 모델은 LLM_MODEL. temperature 0.2.
 */
export async function askJSON<T>(system: string, user: string, timeoutMs: number = CONFIG.LLM_TIMEOUT_MS): Promise<T | null> {
  // 호출 때마다 env를 읽는다: scripts/try-prompts.ts에서 공급자를 바꿔 가며 비교하기 위해
  const provider: Provider = process.env.LLM_PROVIDER === 'anthropic' ? 'anthropic' : 'openai';
  const model = process.env.LLM_MODEL || DEFAULT_MODEL[provider];
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    let text: string;
    if (provider === 'anthropic') {
      anthropic ??= new Anthropic({ maxRetries: 0 });
      const res = await anthropic.messages.create(
        { model, max_tokens: 1024, temperature: 0.2, system, messages: [{ role: 'user', content: user }] },
        { signal },
      );
      text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    } else {
      openai ??= new OpenAI({ maxRetries: 0 });
      const res = await openai.chat.completions.create(
        {
          model,
          temperature: 0.2,
          max_tokens: 1024,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        { signal },
      );
      text = res.choices[0]?.message?.content ?? '';
    }
    return parseJSONObject<T>(text);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[askJSON] 실패:', (e as Error)?.message);
    return null;
  }
}
