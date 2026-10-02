import type { CloseRes } from '@/lib/types';
import { badRequest, id, ok, readJson } from '../../_lib/http';
import { closeProfQuestion } from '../../_lib/profq';

/**
 * POST /api/prof-q/close — 마감 + 분석 (SPEC §8.4, 흐름 B ⑤~⑥)
 * 분포는 코드로, 흔한 오해·다시 설명할 내용·요약문은 P3로. P3 실패 시 분포로 요약문 생성.
 * 시간 종료 자동 호출과 [마감]이 겹쳐도 결과는 하나만 저장된다.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const pqId = id(body?.profQuestionId);
  if (!pqId) return badRequest('profQuestionId가 필요합니다');
  const r = await closeProfQuestion(pqId);
  if ('error' in r) return r.error;
  return ok<CloseRes>({ summary: r.summary });
}
