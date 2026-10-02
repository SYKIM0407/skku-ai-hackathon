import { sbAdmin } from '@/lib/supabase/server';
import type { OkRes } from '@/lib/types';
import { badRequest, fail, id, ok, readJson, serverError } from '../../_lib/http';

/** POST /api/cluster/delete — 교수가 질문 묶음 삭제 (SPEC §8.3, FR-P4). 전송된 질문 행은 cluster_id=null로 남는다 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const clusterId = id(body?.clusterId);
  if (!clusterId) return badRequest('clusterId가 필요합니다');

  const { data, error } = await sbAdmin().from('clusters').delete().eq('id', clusterId).select('id');
  if (error) return serverError();
  if (!data?.length) return fail(404, 'NOT_FOUND', '질문을 찾을 수 없습니다');
  return ok<OkRes>({ ok: true });
}
