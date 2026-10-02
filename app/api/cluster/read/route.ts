import { sbAdmin } from '@/lib/supabase/server';
import type { OkRes } from '@/lib/types';
import { badRequest, fail, id, ok, readJson, serverError } from '../../_lib/http';

/** POST /api/cluster/read — [질문 읽어 주기]로 낭독한 묶음 표시 (SPEC §8.3, FR-P2) */
export async function POST(req: Request) {
  const body = await readJson(req);
  const clusterId = id(body?.clusterId);
  if (!clusterId) return badRequest('clusterId가 필요합니다');

  const { data, error } = await sbAdmin().from('clusters').update({ read_aloud: true }).eq('id', clusterId).select('id');
  if (error) return serverError();
  if (!data?.length) return fail(404, 'NOT_FOUND', '질문 묶음을 찾을 수 없습니다');
  return ok<OkRes>({ ok: true });
}
