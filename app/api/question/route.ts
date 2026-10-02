import { joinCluster } from '@/lib/cluster';
import { CONFIG, MESSAGES } from '@/lib/config';
import { recentLines } from '@/lib/context';
import { interpretQuestion } from '@/lib/prompts';
import { sbAdmin } from '@/lib/supabase/server';
import type { QuestionRes } from '@/lib/types';
import { badRequest, ok, readJson, serverError, str } from '../_lib/http';
import { liveRoom, normRoomId } from '../_lib/room';

/**
 * POST /api/question — 학생 질문 (SPEC §8.3, 흐름 A ①~④)
 * 맥락 조회 → (강의 문장이 없으면 강의 진행 중 아님 안내) → P1 1회 → 무관·부적절은 저장 없이 rejected
 * / AI 실패는 원문 그대로 sent / 관련은 pending 저장 후 review
 */
const NOT_IN_LECTURE = '지금은 강의가 진행 중이 아니에요. 강의가 시작되면 질문해 주세요';

export async function POST(req: Request) {
  const body = await readJson(req);
  const roomId = str(body?.roomId, 10);
  const anonId = str(body?.anonId, 100);
  const raw = str(body?.raw, 500); // "ㅁㄹ", "?" 같은 짧은 입력도 허용 (규칙 10)
  if (!roomId || !anonId) return badRequest('roomId와 anonId가 필요합니다');
  if (!raw) return badRequest('질문을 입력해 주세요');

  const r = await liveRoom(normRoomId(roomId));
  if ('error' in r) return r.error;
  const room = r.room;
  const db = sbAdmin();

  const lines = await recentLines(room.id, CONFIG.CONTEXT_WINDOW_SEC);
  // 최근 강의 문장이 없으면(강의 인식이 꺼져 있음) "이거", "?" 같은 질문을 해석할 맥락이 없어
  // AI가 무관으로 오판한다. AI를 부르지 않고 강의 진행 중이 아님을 알린다 (저장하지 않음)
  if (!lines.length) return ok<QuestionRes>({ status: 'rejected', message: NOT_IN_LECTURE });

  const ai = await interpretQuestion({ raw, lines, glossary: room.glossary });

  // 무관·부적절: 어디에도 저장하지 않고 폐기 (규칙 8)
  if (ai && ai.category !== '관련') {
    return ok<QuestionRes>({ status: 'rejected', message: MESSAGES.REJECTED });
  }

  // AI 실패·시간 초과: 원문 그대로 전달, 강의 시점 없이 묶기 (SPEC §10.3)
  if (!ai) {
    const { data: q, error } = await db
      .from('questions')
      .insert({ room_id: room.id, anon_id: anonId, raw, refined: raw })
      .select('id')
      .single();
    if (error || !q) return serverError();
    const joined = await joinCluster(room.id, Number(q.id), raw, []);
    if (!joined) return serverError();
    return ok<QuestionRes>({
      status: 'sent',
      fallback: true,
      message: MESSAGES.FALLBACK,
      questionId: Number(q.id),
      clusterId: joined.clusterId,
      count: joined.count,
    });
  }

  // 관련: 승인 대기. 후보는 확신도가 낮을 때만 보여 주고, 고른 번호가 맞도록 보여 준 그대로 저장한다
  const candidates = ai.confidence < CONFIG.LOW_CONFIDENCE ? ai.candidates : [];
  const { data: q, error } = await db
    .from('questions')
    .insert({
      room_id: room.id,
      anon_id: anonId,
      raw,
      refined: ai.refined,
      ref_line_ids: ai.ref_line_ids,
      candidates,
      confidence: ai.confidence,
    })
    .select('id')
    .single();
  if (error || !q) return serverError();

  // 학생에게는 ref_line_ids·강의 원문을 보내지 않는다 (규칙 9)
  return ok<QuestionRes>({
    status: 'review',
    question: { id: Number(q.id), refined: ai.refined, confidence: ai.confidence, candidates },
  });
}

