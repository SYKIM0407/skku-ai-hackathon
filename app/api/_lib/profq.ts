import 'server-only';
import { CONFIG } from '@/lib/config';
import { recentLines } from '@/lib/context';
import { computeDistribution, normalizeAnswer, totalOf } from '@/lib/distribution';
import { analyzeAnswers, fallbackSummary, filterAnswers } from '@/lib/prompts';
import { sbAdmin } from '@/lib/supabase/server';
import type { ProfQSummary, ProfQuestion } from '@/lib/types';
import { fail, serverError } from './http';

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

const MAX_ANSWERS_TO_AI = 200;

/**
 * 교수 질문 마감 + 분석 (/api/prof-q/close, 시간 지난 질문 자동 마감, 수업 종료에서 같이 씀).
 * open → closed 전환은 조건부 update로 한 번만. 분포는 코드로, 흔한 오해·요약은 P3로, P3 실패 시 분포로 요약.
 * 이미 closed면 저장된 결과를 돌려준다.
 */
export async function closeProfQuestion(pqId: number): Promise<{ summary: ProfQSummary } | { error: Response }> {
  const db = sbAdmin();

  const { data: claimed, error } = await db
    .from('prof_questions')
    .update({ status: 'closed' })
    .eq('id', pqId)
    .eq('status', 'open')
    .select(PROFQ_COLUMNS);
  if (error) return { error: serverError() };

  let pq = claimed[0] as ProfQRow | undefined;
  if (!pq) {
    const { data } = await db.from('prof_questions').select(PROFQ_COLUMNS).eq('id', pqId).maybeSingle();
    if (!data) return { error: fail(404, 'NOT_FOUND', '질문을 찾을 수 없습니다') };
    pq = data as ProfQRow;
    if (pq.status !== 'closed') return { error: fail(409, 'NOT_OPEN', '학생에게 보낸 질문이 아닙니다') };
    if (pq.summary) return { summary: pq.summary };
    // closed인데 summary가 아직 없으면 다른 요청이 분석 중 → 아래에서 같이 계산하고 먼저 저장된 것을 쓴다
  }

  const { data: all, error: e1 } = await db.from('answers').select('id, answer').eq('prof_question_id', pqId).order('id');
  if (e1) return { error: serverError() };

  // 단답·서술형은 AI(P7)가 무관·부적절 응답을 골라 분포·분석에서 뺀다 (선택형은 선택지 안에서만 답할 수 있어 제외).
  // 같은 답(normalizeAnswer 기준)은 한 번만 검토한다. AI 실패 시 거르지 않고 그대로 진행
  let rows = all;
  let excludedIds: number[] = [];
  if (pq.type !== 'choice' && all.length) {
    const distinct = [...new Map(all.map((r) => [normalizeAnswer(r.answer), r.answer.trim()])).entries()].filter(([k]) => k);
    const verdict = await filterAnswers({
      question: pq.question,
      expected_answer: pq.expected_answer,
      answers: distinct.map(([, text]) => text),
    });
    if (verdict?.flagged.length) {
      const bad = new Set(verdict.flagged.map((f) => distinct[f.index][0]));
      rows = all.filter((r) => !bad.has(normalizeAnswer(r.answer)));
      excludedIds = all.filter((r) => bad.has(normalizeAnswer(r.answer))).map((r) => Number(r.id));
    }
  }
  const distribution = computeDistribution(pq, rows);
  const total = totalOf(distribution);

  // AI가 실패해도 성공했을 때와 같은 문구("정답(○○)을 고른 학생은 ○○%")가 되도록 정답을 넘긴다
  let analysis = fallbackSummary(distribution, pq.expected_answer);
  if (total > 0) {
    const recent = await recentLines(pq.room_id, CONFIG.CONTEXT_WINDOW_SEC * 4);
    const refs = new Set((pq.context_line_ids ?? []).map(Number));
    const context = refs.size ? recent.filter((l) => refs.has(l.id)) : recent.slice(-5);
    const ai = await analyzeAnswers({
      question: pq.question,
      expected_answer: pq.expected_answer,
      context_lines: context,
      distribution,
      answers: rows.map((r) => r.answer).slice(0, MAX_ANSWERS_TO_AI),
    });
    if (ai) analysis = ai;
  }

  const summary: ProfQSummary = { total, distribution, ...analysis, ...(excludedIds.length ? { filtered: true } : {}) };
  const { error: e2 } = await db.from('prof_questions').update({ summary }).eq('id', pqId).is('summary', null);
  if (e2) return { error: serverError() };

  // 걸러진 응답은 남기지 않는다 (무관·부적절 질문을 저장하지 않는 것과 같은 원칙, 규칙 8). 실패해도 결과는 이미 저장됨
  if (excludedIds.length) await db.from('answers').delete().in('id', excludedIds);

  const { data: saved } = await db.from('prof_questions').select('summary').eq('id', pqId).single();
  return { summary: (saved?.summary as ProfQSummary | null) ?? summary };
}

/**
 * 방에서 아직 진행 중인 교수 질문. 응답 시간이 지난 질문(교수 탭이 닫혀 자동 마감이 안 된 경우)은
 * 여기서 마감·분석해 두고 진행 중으로 치지 않는다. 시간 판정은 DB now() (prof_q_answerable)
 */
export async function activeOpenQuestion(roomId: string): Promise<{ open: boolean } | { error: Response }> {
  const db = sbAdmin();
  const { data, error } = await db.from('prof_questions').select('id').eq('room_id', roomId).eq('status', 'open');
  if (error) return { error: serverError() };
  for (const row of data) {
    const pqId = Number(row.id);
    const { data: answerable, error: e } = await db.rpc('prof_q_answerable', { p_id: pqId });
    if (e) return { error: serverError() };
    if (answerable) return { open: true };
    const closed = await closeProfQuestion(pqId);
    if ('error' in closed) return closed;
  }
  return { open: false };
}
