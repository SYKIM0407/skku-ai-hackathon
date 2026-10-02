import { sbAdmin } from '@/lib/supabase/server';
import type { TranscriptRes } from '@/lib/types';
import { badRequest, ok, readJson, serverError, str } from '../_lib/http';
import { liveRoom, normRoomId } from '../_lib/room';

/** POST /api/transcript — 강의 인식 확정 문장 저장. 시각은 DB now() (SPEC §8.2, FR-T2) */
export async function POST(req: Request) {
  const body = await readJson(req);
  const roomId = str(body?.roomId, 10);
  const text = str(body?.text, 1000);
  if (!roomId || !text) return badRequest('roomId와 text가 필요합니다');

  const r = await liveRoom(normRoomId(roomId));
  if ('error' in r) return r.error;

  const { data, error } = await sbAdmin().from('transcripts').insert({ room_id: r.room.id, text }).select('id').single();
  if (error || !data) return serverError();
  return ok<TranscriptRes>({ id: Number(data.id) });
}
