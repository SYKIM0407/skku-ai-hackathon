import { normalizeAnswer } from '@/lib/distribution';
import { sbAdmin } from '@/lib/supabase/server';
import type { OkRes } from '@/lib/types';
import { badRequest, fail, id, ok, PG, readJson, serverError, str } from '../_lib/http';

/** POST /api/answer — 학생 응답, 1인 1회 (SPEC §8.4, FR-B6) */
export async function POST(req: Request) {
  const body = await readJson(req);
  const pqId = id(body?.profQuestionId);
  const anonId = str(body?.anonId, 100);
  const answer = str(body?.answer, 500);
  if (!pqId || !anonId) return badRequest('profQuestionId와 anonId가 필요합니다');
  if (!answer) return badRequest('답을 입력해 주세요');
  const db = sbAdmin();

  const { data: pq, error } = await db.from('prof_questions').select('id, type, options').eq('id', pqId).maybeSingle();
  if (error) return serverError();
  if (!pq) return fail(404, 'NOT_FOUND', '질문을 찾을 수 없습니다');

  // 마감 판정은 DB 시각 기준 (교수 탭이 닫혀 자동 마감이 안 돼도 시간이 지나면 410)
  const { data: answerable, error: e1 } = await db.rpc('prof_q_answerable', { p_id: pqId });
  if (e1) return serverError();
  if (!answerable) return fail(410, 'CLOSED', '마감된 질문입니다');

  let value = answer;
  if (pq.type === 'choice') {
    const match = (pq.options ?? []).find((o: string) => normalizeAnswer(o) === normalizeAnswer(answer));
    if (!match) return badRequest('선택지 중에서 골라 주세요');
    value = match; // 분포가 선택지 원문으로 모이게
  }

  const { error: e2 } = await db.from('answers').insert({ prof_question_id: pqId, anon_id: anonId, answer: value });
  if (e2?.code === PG.UNIQUE) return fail(409, 'ALREADY_ANSWERED', '이미 응답했습니다');
  if (e2) return serverError();
  return ok<OkRes>({ ok: true });
}
