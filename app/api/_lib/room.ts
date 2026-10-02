import 'server-only';
import { sbAdmin } from '@/lib/supabase/server';
import type { Room } from '@/lib/types';
import { fail } from './http';

/** 수업방 조회. 없으면 404, 종료됐으면 409 응답을 돌려준다 (live만 통과) */
export async function liveRoom(roomId: string): Promise<{ room: Pick<Room, 'id' | 'glossary'> } | { error: Response }> {
  const { data, error } = await sbAdmin().from('rooms').select('id, glossary, status').eq('id', roomId).maybeSingle();
  if (error) return { error: fail(500, 'SERVER_ERROR', '잠시 후 다시 시도해 주세요') };
  if (!data) return { error: fail(404, 'NOT_FOUND', '수업방을 찾을 수 없습니다') };
  if (data.status !== 'live') return { error: fail(409, 'ROOM_ENDED', '종료된 수업입니다') };
  return { room: { id: data.id, glossary: data.glossary ?? [] } };
}

/** 방 코드는 대문자로 통일 (학생이 소문자로 입력해도 입장되게) */
export const normRoomId = (v: string) => v.toUpperCase();
