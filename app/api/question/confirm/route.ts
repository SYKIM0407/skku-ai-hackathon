import { clusterCount, joinCluster } from '@/lib/cluster';
import { sbAdmin } from '@/lib/supabase/server';
import type { ConfirmRes } from '@/lib/types';
import { badRequest, fail, id, ok, readJson, serverError, str } from '../../_lib/http';

/**
 * POST /api/question/confirm — 승인 [보내기]/[취소] (SPEC §8.3, 흐름 A ⑤)
 * send: (후보 선택 시 refined 교체) → 강의 시점 기준 묶음 합류 / cancel: 행 삭제
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const questionId = id(body?.questionId);
  const anonId = str(body?.anonId, 100);
  const action = body?.action;
  if (!questionId || !anonId) return badRequest('questionId와 anonId가 필요합니다');
  if (action !== 'send' && action !== 'cancel') return badRequest("action은 'send' 또는 'cancel'이어야 합니다");

  const db = sbAdmin();
  const { data: q, error } = await db
    .from('questions')
    .select('id, room_id, anon_id, raw, refined, ref_line_ids, candidates, status, cluster_id')
    .eq('id', questionId)
    .maybeSingle();
  if (error) return serverError();
  if (!q) return fail(404, 'NOT_FOUND', '질문을 찾을 수 없습니다');
  if (q.anon_id !== anonId) return fail(403, 'FORBIDDEN', '본인 질문만 처리할 수 있습니다');

  if (action === 'cancel') {
    // 이미 보낸 질문을 지우면 묶음 인원이 어긋나므로 승인 대기일 때만 취소
    if (q.status !== 'pending') return fail(409, 'ALREADY_SENT', '이미 보낸 질문입니다');
    const { error: e } = await db.from('questions').delete().eq('id', q.id);
    if (e) return serverError();
    return ok<ConfirmRes>({ ok: true });
  }

  // 같은 [보내기]가 두 번 와도 인원을 두 번 올리지 않는다
  if (q.status === 'sent' && q.cluster_id) {
    const count = await clusterCount(Number(q.cluster_id));
    if (count === null) return serverError();
    return ok<ConfirmRes>({ clusterId: Number(q.cluster_id), count });
  }

  let title: string = q.refined || q.raw;
  if (body?.candidateIndex !== undefined && body?.candidateIndex !== null) {
    const candidates: unknown[] = Array.isArray(q.candidates) ? q.candidates : [];
    const i = body.candidateIndex;
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= candidates.length || typeof candidates[i] !== 'string')
      return badRequest('candidateIndex가 올바르지 않습니다');
    title = candidates[i] as string;
    const { error: e } = await db.from('questions').update({ refined: title }).eq('id', q.id);
    if (e) return serverError();
  }

  const joined = await joinCluster(q.room_id, Number(q.id), title, (q.ref_line_ids ?? []).map(Number));
  if (!joined) return serverError();
  return ok<ConfirmRes>(joined);
}
