import { extractGlossary } from '@/lib/prompts';
import { sbAdmin } from '@/lib/supabase/server';
import type { MaterialRes } from '@/lib/types';
import { badRequest, fail, ok, readJson, serverError, str } from '../../_lib/http';
import { liveRoom, normRoomId } from '../../_lib/room';

// 긴 교안의 AI 호출(제한 시간 24초)이 기본 함수 제한 시간을 넘을 수 있다
export const maxDuration = 60;

/** DB에 보관하는 교안 텍스트 상한 (AI에는 이 중 앞 2만 자만 넘긴다) */
const MAX_TEXT_CHARS = 100_000;
/** 직접 입력한 용어와 합친 용어집 상한 (/api/room과 같은 값) */
const MAX_GLOSSARY = 100;

/**
 * POST /api/room/material — 교안 텍스트 → P6 → 용어집 저장 (SPEC §8.1, FR-R5)
 * PDF → 텍스트 추출은 브라우저(lib/pdf-text.ts)에서 하고, 여기는 { roomId, text }만 받는다.
 * 직접 입력한 용어는 지우지 않고 추출한 용어를 뒤에 합친다.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const roomId = str(body?.roomId, 10);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!roomId) return badRequest('roomId가 필요합니다');
  if (!text) return badRequest('교안에서 글자를 찾을 수 없습니다(스캔본). 용어를 직접 입력해 주세요');

  const r = await liveRoom(normRoomId(roomId));
  if ('error' in r) return r.error;
  const room = r.room;

  const db = sbAdmin();
  const material = text.slice(0, MAX_TEXT_CHARS);
  const extracted = await extractGlossary(material);

  // 기존 용어(직접 입력) 먼저, 추출한 용어는 뒤에. 대소문자 무시 중복 제거
  const seen = new Set<string>();
  const glossary = [...room.glossary, ...(extracted ?? [])]
    .filter((g) => {
      const k = g.toLowerCase();
      return seen.has(k) ? false : (seen.add(k), true);
    })
    .slice(0, MAX_GLOSSARY);

  const { error } = await db.from('rooms').update({ material_text: material, glossary }).eq('id', room.id);
  if (error) return serverError();

  // AI 실패: 교안 텍스트는 저장했으니 용어만 직접 입력하게 안내
  if (!extracted) return fail(502, 'AI_FAILED', '용어를 추출하지 못했습니다. 용어를 직접 입력해 주세요');
  return ok<MaterialRes>({ glossary });
}
