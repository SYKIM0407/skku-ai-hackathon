import { DONT_KNOW } from '@/lib/config';
import { sbAdmin } from '@/lib/supabase/server';
import type { OpenRes, ProfQType } from '@/lib/types';
import { badRequest, fail, id, ok, readJson, serverError, str } from '../../_lib/http';
import { activeOpenQuestion, closesAtFrom, durationOf } from '../../_lib/profq';
import { liveRoom, normRoomId } from '../../_lib/room';

const TYPES: ProfQType[] = ['choice', 'short', 'open'];

/**
 * POST /api/prof-q/open — 학생에게 보내기 (SPEC §8.4, 흐름 B ④)
 * { profQuestionId, durationSec? }: 감지된 pending 질문 보내기
 * { roomId, question, type, options?, durationSec? }: 직접 질문하기 (FR-B4)
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return badRequest('요청 형식이 올바르지 않습니다');
  // durationSec 0 = 시간 제한 없음 (교수가 [마감]할 때까지). 410 판정은 prof_q_answerable이 closes_at null을 '열림'으로 본다
  const sec = body.durationSec === 0 || body.durationSec === '0' ? null : durationOf(body.durationSec);
  const db = sbAdmin();

  const pqId = id(body.profQuestionId);
  if (pqId) {
    const { data: pq, error } = await db.from('prof_questions').select('id, room_id, status').eq('id', pqId).maybeSingle();
    if (error) return serverError();
    if (!pq) return fail(404, 'NOT_FOUND', '질문을 찾을 수 없습니다');
    if (pq.status !== 'pending') return fail(409, 'NOT_PENDING', '이미 처리된 질문입니다');
    const r = await liveRoom(pq.room_id);
    if ('error' in r) return r.error;
    // 학생 화면에는 open 질문을 하나만 띄운다. 시간이 지난 질문은 여기서 마감되어 막지 않는다
    const active = await activeOpenQuestion(pq.room_id);
    if ('error' in active) return active.error;
    if (active.open) return fail(409, 'PROFQ_OPEN', '진행 중인 질문을 먼저 마감해 주세요');

    const closesAt = sec === null ? null : closesAtFrom(sec);
    const { data, error: e } = await db
      .from('prof_questions')
      .update({ status: 'open', closes_at: closesAt })
      .eq('id', pqId)
      .eq('status', 'pending') // 동시에 두 번 눌러도 한 번만
      .select('id');
    if (e) return serverError();
    if (!data.length) return fail(409, 'NOT_PENDING', '이미 처리된 질문입니다');
    return ok<OpenRes>({ profQuestionId: pqId, closesAt });
  }

  // 직접 질문하기
  const roomId = str(body.roomId, 10);
  const question = str(body.question, 300);
  const type = body.type as ProfQType;
  if (!roomId || !question) return badRequest('roomId와 question이 필요합니다');
  if (!TYPES.includes(type)) return badRequest("type은 'choice', 'short', 'open' 중 하나여야 합니다");

  let options: string[] | null = null;
  if (type === 'choice') {
    const raw = Array.isArray(body.options) ? body.options : [];
    const opts = [...new Set(raw.map((o) => str(o, 100)).filter((o): o is string => !!o && o !== DONT_KNOW))].slice(0, 6);
    if (opts.length < 2) return badRequest('선택형은 선택지가 2개 이상 필요합니다');
    options = [...opts, DONT_KNOW]; // 마지막은 항상 "모르겠어요" (FR-B6)
  }

  const r = await liveRoom(normRoomId(roomId));
  if ('error' in r) return r.error;
  const active = await activeOpenQuestion(r.room.id);
  if ('error' in active) return active.error;
  if (active.open) return fail(409, 'PROFQ_OPEN', '진행 중인 질문을 먼저 마감해 주세요');

  const closesAt = sec === null ? null : closesAtFrom(sec);
  const { data, error } = await db
    .from('prof_questions')
    .insert({ room_id: r.room.id, spoken: null, question, type, options, status: 'open', closes_at: closesAt })
    .select('id')
    .single();
  if (error || !data) return serverError();
  return ok<OpenRes>({ profQuestionId: Number(data.id), closesAt });
}
