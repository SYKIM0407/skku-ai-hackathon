import { sbAdmin } from '@/lib/supabase/server';
import type { OkRes } from '@/lib/types';
import { badRequest, fail, ok, readJson, serverError, str } from '../../_lib/http';
import { closeProfQuestion } from '../../_lib/profq';
import { normRoomId } from '../../_lib/room';

/** POST /api/room/end — 수업 종료: 진행 중 교수 질문 마감, 강의 인식 결과·승인 대기 질문 삭제, status='ended' (SPEC §8.1, §10.2) */
export async function POST(req: Request) {
  const body = await readJson(req);
  const roomId = str(body?.roomId, 10);
  if (!roomId) return badRequest('roomId가 필요합니다');
  const db = sbAdmin();
  const code = normRoomId(roomId);

  const { data: room, error } = await db.from('rooms').select('id').eq('id', code).maybeSingle();
  if (error) return serverError();
  if (!room) return fail(404, 'NOT_FOUND', '수업방을 찾을 수 없습니다');

  // 순서: 상태부터 바꿔서 종료 중에 새 문장·질문이 들어오지 않게 한다
  const { error: e0 } = await db.from('rooms').update({ status: 'ended' }).eq('id', code);
  if (e0) return serverError();

  // 진행 중인 교수 질문은 마감·분석한다 (강의 문장을 지우기 전에 해야 P3가 맥락을 쓸 수 있다)
  const { data: open, error: e1 } = await db.from('prof_questions').select('id').eq('room_id', code).eq('status', 'open');
  if (e1) return serverError();
  for (const row of open) {
    const r = await closeProfQuestion(Number(row.id));
    if ('error' in r) return r.error;
  }

  const steps = [
    db.from('transcripts').delete().eq('room_id', code),
    db.from('questions').delete().eq('room_id', code).eq('status', 'pending'),
    db.from('prof_questions').update({ status: 'dismissed' }).eq('room_id', code).eq('status', 'pending'),
  ];
  for (const step of steps) {
    const { error: e } = await step;
    if (e) return serverError();
  }
  return ok<OkRes>({ ok: true });
}
