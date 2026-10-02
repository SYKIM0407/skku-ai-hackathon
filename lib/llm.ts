import 'server-only';
import { CONFIG } from './config';

/**
 * AI 1회 호출 → JSON 파싱 결과. 실패·시간 초과·파싱 오류면 null (호출부는 SPEC §10.3 대체 동작).
 * 공급자는 env LLM_PROVIDER(openai | anthropic), 모델은 LLM_MODEL. temperature 0.2.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function askJSON<T>(system: string, user: string, timeoutMs: number = CONFIG.LLM_TIMEOUT_MS): Promise<T | null> {
  // TODO(T-40, A): 공급자 전환, JSON 모드, AbortSignal.timeout(timeoutMs)
  return null;
}
