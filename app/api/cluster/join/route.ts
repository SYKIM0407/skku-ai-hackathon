import { sbAdmin } from '@/lib/supabase/server';
import type { ClusterJoinRes } from '@/lib/types';
import { badRequest, fail, id, ok, readJson, serverError, str } from '../../_lib/http';
import { liveRoom } from '../../_lib/room';

/** POST /api/cluster/join — 다른 학생의 질문에 "나도 모르겠어요" (SPEC §8.3, FR-A10). 같은 학생은 한 번만 센다 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const clusterId = id(body?.clusterId);
  const anonId = str(body?.anonId, 100);
  if (!clusterId || !anonId) return badRequest('clusterId와 anonId가 필요합니다');
  const db = sbAdmin();

  const { data: c, error } = await db.from('clusters').select('id, room_id').eq('id', clusterId).maybeSingle();
  if (error) return serverError();
  if (!c) return fail(404, 'NOT_FOUND', '질문을 찾을 수 없습니다');
  const r = await liveRoom(c.room_id);
  if ('error' in r) return r.error;

  const { data, error: e } = await db.rpc('join_cluster_by_id', { p_cluster: clusterId, p_anon: anonId });
  const row = Array.isArray(data) ? data[0] : null;
  if (e || !row) return serverError();
  return ok<ClusterJoinRes>({ questionId: Number(row.question_id), clusterId, count: Number(row.cnt) });
}
