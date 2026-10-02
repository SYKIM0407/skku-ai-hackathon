import { CONFIG } from '@/lib/config';
import { recentLines } from '@/lib/context';
import { computeDistribution, totalOf } from '@/lib/distribution';
import { analyzeAnswers, fallbackSummary } from '@/lib/prompts';
import { sbAdmin } from '@/lib/supabase/server';
import type { CloseRes, ProfQSummary } from '@/lib/types';
import { badRequest, fail, id, ok, readJson, serverError } from '../../_lib/http';
import { PROFQ_COLUMNS, type ProfQRow } from '../../_lib/profq';

const MAX_ANSWERS_TO_AI = 200;

/**
 * POST /api/prof-q/close — 마감 + 분석 (SPEC §8.4, 흐름 B ⑤~⑥)
 * 분포는 코드로, 흔한 오해·다시 설명할 내용·요약문은 P3로. P3 실패 시 분포로 요약문 생성.
 * 시간 종료 자동 호출과 [마감]이 겹쳐도 결과는 하나만 저장된다.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const pqId = id(body?.profQuestionId);
  if (!pqId) return badRequest('profQuestionId가 필요합니다');
  const db = sbAdmin();

  // open → closed 전환. 이미 closed면 저장된 결과를 돌려준다
  const { data: claimed, error } = await db
    .from('prof_questions')
    .update({ status: 'closed' })
    .eq('id', pqId)
    .eq('status', 'open')
    .select(PROFQ_COLUMNS);
  if (error) return serverError();

  let pq = claimed[0] as ProfQRow | undefined;
  if (!pq) {
    const { data } = await db.from('prof_questions').select(PROFQ_COLUMNS).eq('id', pqId).maybeSingle();
    if (!data) return fail(404, 'NOT_FOUND', '질문을 찾을 수 없습니다');
    pq = data as ProfQRow;
    if (pq.status !== 'closed') return fail(409, 'NOT_OPEN', '학생에게 보낸 질문이 아닙니다');
    if (pq.summary) return ok<CloseRes>({ summary: pq.summary });
    // closed인데 summary가 아직 없으면 다른 요청이 분석 중 → 아래에서 같이 계산하고 먼저 저장된 것을 쓴다
  }

  const { data: rows, error: e1 } = await db.from('answers').select('answer').eq('prof_question_id', pqId).order('id');
  if (e1) return serverError();
  const distribution = computeDistribution(pq, rows);
  const total = totalOf(distribution);

  let analysis = fallbackSummary(distribution);
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

  const summary: ProfQSummary = { total, distribution, ...analysis };
  const { error: e2 } = await db.from('prof_questions').update({ summary }).eq('id', pqId).is('summary', null);
  if (e2) return serverError();

  const { data: saved } = await db.from('prof_questions').select('summary').eq('id', pqId).single();
  return ok<CloseRes>({ summary: (saved?.summary as ProfQSummary | null) ?? summary });
}
