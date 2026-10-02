import { sbAdmin } from '@/lib/supabase/server';
import type { CreateRoomRes } from '@/lib/types';
import { badRequest, ok, PG, readJson, serverError, str } from '../_lib/http';

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 4자리 방 코드
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

/** POST /api/room — 수업방 생성 (SPEC §8.1) */
export async function POST(req: Request) {
  const body = await readJson(req);
  const title = str(body?.title, 100);
  if (!title) return badRequest('수업 제목을 입력해 주세요');

  const raw = body?.glossary;
  if (raw !== undefined && !Array.isArray(raw)) return badRequest('용어집은 문자열 배열이어야 합니다');
  const glossary = [...new Set((raw ?? []).map((g) => str(g, 50)).filter((g): g is string => !!g))].slice(0, 100);

  // 코드가 겹치면(unique 위반) 다시 뽑는다
  for (let i = 0; i < 10; i++) {
    const roomId = newCode();
    const { error } = await sbAdmin().from('rooms').insert({ id: roomId, title, glossary });
    if (!error) return ok<CreateRoomRes>({ roomId });
    if (error.code !== PG.UNIQUE) return serverError();
  }
  return serverError();
}
