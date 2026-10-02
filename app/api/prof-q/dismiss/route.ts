import { sbAdmin } from '@/lib/supabase/server';
import type { OkRes } from '@/lib/types';
import { badRequest, fail, id, ok, readJson, serverError } from '../../_lib/http';

/** POST /api/prof-q/dismiss — 감지 알림 [무시] (SPEC §8.4) */
export async function POST(req: Request) {
  const body = await readJson(req);
  const pqId = id(body?.profQuestionId);
  if (!pqId) return badRequest('profQuestionId가 필요합니다');
  const db = sbAdmin();

  const { data, error } = await db
    .from('prof_questions')
    .update({ status: 'dismissed' })
    .eq('id', pqId)
    .eq('status', 'pending')
    .select('id');
  if (error) return serverError();
  if (data.length) return ok<OkRes>({ ok: true });

  const { data: pq } = await db.from('prof_questions').select('status').eq('id', pqId).maybeSingle();
  if (!pq) return fail(404, 'NOT_FOUND', '질문을 찾을 수 없습니다');
  if (pq.status === 'dismissed') return ok<OkRes>({ ok: true });
  return fail(409, 'NOT_PENDING', '이미 학생에게 보낸 질문입니다');
}
