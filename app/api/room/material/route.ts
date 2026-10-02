import { PDFParse } from 'pdf-parse';
import { extractGlossary } from '@/lib/prompts';
import { sbAdmin } from '@/lib/supabase/server';
import type { MaterialRes } from '@/lib/types';
import { badRequest, fail, ok, serverError, str } from '../../_lib/http';
import { liveRoom, normRoomId } from '../../_lib/room';

// PDF 파싱 + 긴 입력의 AI 호출이 기본 함수 제한 시간(10초)을 넘을 수 있다
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** DB에 보관하는 교안 텍스트 상한 (AI에는 이 중 앞 2만 자만 넘긴다) */
const MAX_TEXT_CHARS = 100_000;
/** 직접 입력한 용어와 합친 용어집 상한 (/api/room과 같은 값) */
const MAX_GLOSSARY = 100;

async function pdfText(buf: Buffer): Promise<string | null> {
  const parser = new PDFParse({ data: buf });
  try {
    const { text } = await parser.getText();
    return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  } catch {
    return null;
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/**
 * POST /api/room/material — 교안 PDF 업로드 → 텍스트 추출 → P6 → 용어집 저장 (SPEC §8.1, FR-R5)
 * multipart: roomId, file. 직접 입력한 용어는 지우지 않고 추출한 용어를 뒤에 합친다.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('multipart 형식(roomId, file)으로 보내 주세요');
  }
  const roomId = str(form.get('roomId'), 10);
  const file = form.get('file');
  if (!roomId) return badRequest('roomId가 필요합니다');
  if (!(file instanceof File) || file.size === 0) return badRequest('PDF 파일을 선택해 주세요');
  if (file.size > MAX_FILE_BYTES) return fail(413, 'TOO_LARGE', 'PDF는 10MB까지 올릴 수 있습니다');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return badRequest('PDF 파일만 올릴 수 있습니다');

  const r = await liveRoom(normRoomId(roomId));
  if ('error' in r) return r.error;
  const room = r.room;

  const text = await pdfText(Buffer.from(await file.arrayBuffer()));
  if (text === null) return fail(422, 'PDF_UNREADABLE', 'PDF를 읽을 수 없습니다. 다른 파일로 다시 시도해 주세요');
  if (!text) return fail(422, 'PDF_NO_TEXT', '글자를 찾을 수 없는 PDF입니다(스캔본). 용어를 직접 입력해 주세요');

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
