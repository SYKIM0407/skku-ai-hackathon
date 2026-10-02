import { CONFIG } from '@/lib/config';
import { recentLines } from '@/lib/context';
import { judgeProfQuestion } from '@/lib/prompts';
import { sbAdmin } from '@/lib/supabase/server';
import type { DetectRes } from '@/lib/types';
import { badRequest, ok, readJson, serverError, str } from '../../_lib/http';
import { liveRoom, normRoomId } from '../../_lib/room';

/**
 * POST /api/prof-q/detect — 교수 발화가 실제 질문인지 P2로 판별 (SPEC §8.4, 흐름 B ①~③)
 * 실제 질문이면 status='pending'으로 저장하고, 교수 화면이 [보내기]/[무시]를 띄운다.
 * AI 실패면 감지 무시 (SPEC §10.3). 진행 중 질문이 있어도 pending으로만 쌓이므로 교수 화면이 마감 후 알린다.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const roomId = str(body?.roomId, 10);
  const spoken = str(body?.spoken, 500);
  const after = typeof body?.after === 'string' ? body.after.trim().slice(0, 1000) : '';
  if (!roomId || !spoken) return badRequest('roomId와 spoken이 필요합니다');

  const r = await liveRoom(normRoomId(roomId));
  if ('error' in r) return r.error;

  const lines = await recentLines(r.room.id, CONFIG.PROFQ_CONTEXT_SEC);
  const ai = await judgeProfQuestion({ lines, spoken, after });
  if (!ai || !ai.is_real_question) return ok<DetectRes>({ detected: false });

  const { data, error } = await sbAdmin()
    .from('prof_questions')
    .insert({
      room_id: r.room.id,
      spoken,
      speech_act: ai.speech_act,
      question: ai.question,
      type: ai.type,
      options: ai.options,
      expected_answer: ai.expected_answer,
      context_line_ids: ai.context_line_ids,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) return serverError();
  return ok<DetectRes>({ detected: true, profQuestionId: Number(data.id) });
}
