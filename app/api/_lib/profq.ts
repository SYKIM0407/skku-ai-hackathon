import 'server-only';
import { CONFIG } from '@/lib/config';
import type { ProfQuestion } from '@/lib/types';

export const PROFQ_COLUMNS =
  'id, room_id, spoken, question, type, options, expected_answer, context_line_ids, status, closes_at, summary';

export type ProfQRow = ProfQuestion & { context_line_ids: number[] };

/** 응답 시간(초). 없거나 이상하면 기본값, 10~300초로 제한 */
export function durationOf(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return CONFIG.PROFQ_DURATION_SEC;
  return Math.min(300, Math.max(10, Math.round(n)));
}

/**
 * 마감 시각. 학생·교수 기기 시계가 아니라 서버 시계로 정한다.
 * 410 판정은 DB 함수 prof_q_answerable이 DB now()로 비교한다.
 */
export const closesAtFrom = (sec: number) => new Date(Date.now() + sec * 1000).toISOString();
