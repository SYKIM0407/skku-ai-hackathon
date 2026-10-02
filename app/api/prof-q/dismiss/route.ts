import { sbAdmin } from '@/lib/supabase/server';
import type { OkRes } from '@/lib/types';
import { badRequest, fail, id, ok, readJson, serverError } from '../../_lib/http';

/** POST /api/prof-q/dismiss — 감지 알림 [무시] 또는 지난 질문 [삭제] (SPEC §8.4). 응답·결과는 남기고 목록에서만 뺀다 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const pqId = id(body?.profQuestionId);
  if (!pqId) return badRequest('profQuestionId가 필요합니다');
  const db = sbAdmin();

  const { data, error } = await db
    .from('prof_questions')
    .update({ status: 'dismissed' })
    .eq('id', pqId)
    .in('status', ['pending', 'closed'])
    .select('id');
  if (error) return serverError();
  if (data.length) return ok<OkRes>({ ok: true });

  const { data: pq } = await db.from('prof_questions').select('status').eq('id', pqId).maybeSingle();
  if (!pq) return fail(404, 'NOT_FOUND', '질문을 찾을 수 없습니다');
  if (pq.status === 'dismissed') return ok<OkRes>({ ok: true });
  return fail(409, 'NOT_PENDING', '진행 중인 질문은 먼저 마감해 주세요');
}
