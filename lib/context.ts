import 'server-only';
import { CONFIG } from './config';
import { sbAdmin } from './supabase/server';
import type { TranscriptLine } from './types';

/** 최근 seconds초 강의 인식 문장. 시각은 DB now() 기준 (supabase 함수 recent_lines). 실패하면 빈 배열 */
export async function recentLines(roomId: string, seconds: number = CONFIG.CONTEXT_WINDOW_SEC): Promise<TranscriptLine[]> {
  try {
    const { data, error } = await sbAdmin().rpc('recent_lines', { p_room: roomId, p_sec: seconds });
    if (error || !Array.isArray(data)) return [];
    return data.map((r: { id: number | string; text: string; ago_sec: number | string }) => ({
      id: Number(r.id), // bigint가 문자열로 올 수 있음
      text: r.text,
      ago_sec: Number(r.ago_sec),
    }));
  } catch {
    return [];
  }
}

/** 프롬프트용 포맷: "[L43] (-60초) 문장" (docs/PROMPTS.md) */
export function formatLines(lines: TranscriptLine[]): string {
  return lines.map((l) => `[L${l.id}] (-${l.ago_sec}초) ${l.text}`).join('\n');
}
