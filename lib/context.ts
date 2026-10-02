import 'server-only';
import { CONFIG } from './config';
import type { TranscriptLine } from './types';

/** 최근 seconds초 강의 인식 문장. 시각은 DB now() 기준 (supabase 함수 recent_lines) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function recentLines(roomId: string, seconds: number = CONFIG.CONTEXT_WINDOW_SEC): Promise<TranscriptLine[]> {
  // TODO(T-40, A): sbAdmin().rpc('recent_lines', { p_room: roomId, p_sec: seconds })
  return [];
}

/** 프롬프트용 포맷: "[L43] (-60초) 문장" (docs/PROMPTS.md) */
export function formatLines(lines: TranscriptLine[]): string {
  return lines.map((l) => `[L${l.id}] (-${l.ago_sec}초) ${l.text}`).join('\n');
}
