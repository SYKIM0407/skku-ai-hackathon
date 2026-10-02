// 백엔드 완성 전 프론트(P·S)가 화면을 먼저 만들기 위한 목 데이터.
// API가 준비되면 호출부를 실제 fetch로 바꾸고, 여기 데이터는 지우지 않아도 된다.
import type {
  Cluster, ConfirmReq, ConfirmRes, MyQuestion, ProfQuestion, QuestionRes, Room, TranscriptLine,
} from './types';
import { DONT_KNOW, MESSAGES } from './config';

export const MOCK_ROOM_ID = 'K7Q2';

export const mockRoom: Room = {
  id: MOCK_ROOM_ID,
  title: '선형대수 3주차',
  glossary: ['고유벡터', '고윳값', '람다', '특성방정식', '행렬식'],
  status: 'live',
  created_at: '2026-10-10T05:00:00Z',
};

/** scripts/demo-lecture.json 앞부분 (서버 전용 데이터, 화면에 표시하지 않는다) */
export const mockLines: TranscriptLine[] = [
  { id: 41, text: '고유벡터는 선형변환을 해도 방향이 바뀌지 않는 벡터예요', ago_sec: 150 },
  { id: 42, text: '이때 늘어나는 비율을 고윳값이라고 해요', ago_sec: 120 },
  { id: 43, text: '식으로 쓰면 A x 는 람다 x 입니다', ago_sec: 90 },
  { id: 44, text: '그래서 A에서 람다 I를 빼고 행렬식을 0으로 놓습니다', ago_sec: 60 },
];

export const mockClusters: Cluster[] = [
  { id: 7, room_id: MOCK_ROOM_ID, title: '방금 행렬식을 0으로 놓으신 이유를 다시 설명해 주실 수 있나요?', ref_line_ids: [44], count: 12, read_aloud: false, updated_at: '2026-10-10T05:10:00Z' },
  { id: 8, room_id: MOCK_ROOM_ID, title: '고유벡터의 방향이 바뀌지 않는다는 것이 어떤 의미인가요?', ref_line_ids: [41], count: 4, read_aloud: true, updated_at: '2026-10-10T05:08:00Z' },
  { id: 9, room_id: MOCK_ROOM_ID, title: '이 내용이 시험 범위에 포함되나요?', ref_line_ids: [], count: 1, read_aloud: false, updated_at: '2026-10-10T05:09:00Z' },
];

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();

/** 교수 질문 상태별 예시: pending(감지 알림) / open(진행 중) / closed(결과) */
export const mockProfQuestions: Record<'pending' | 'open' | 'closed', ProfQuestion> = {
  pending: {
    id: 11, room_id: MOCK_ROOM_ID, spoken: '자 그럼 이 행렬은 고윳값이 몇 개일까요',
    question: '방금 예제의 2×2 행렬은 고윳값이 몇 개일까요?', type: 'choice',
    options: ['1개', '2개', '3개', DONT_KNOW], expected_answer: '2개',
    status: 'pending', closes_at: null, summary: null,
  },
  open: {
    id: 12, room_id: MOCK_ROOM_ID, spoken: '자 그럼 이 행렬은 고윳값이 몇 개일까요',
    question: '방금 예제의 2×2 행렬은 고윳값이 몇 개일까요?', type: 'choice',
    options: ['1개', '2개', '3개', DONT_KNOW], expected_answer: '2개',
    status: 'open', closes_at: inSeconds(45), summary: null,
  },
  closed: {
    id: 13, room_id: MOCK_ROOM_ID, spoken: null,
    question: '방금 예제의 2×2 행렬은 고윳값이 몇 개일까요?', type: 'choice',
    options: ['1개', '2개', '3개', DONT_KNOW], expected_answer: '2개',
    status: 'closed', closes_at: '2026-10-10T05:12:45Z',
    summary: {
      total: 42,
      distribution: [
        { label: '1개', count: 3, ratio: 0.07 },
        { label: '2개', count: 29, ratio: 0.69 },
        { label: '3개', count: 8, ratio: 0.19 },
        { label: DONT_KNOW, count: 2, ratio: 0.05 },
      ],
      misconceptions: [{ text: '행렬 크기와 고윳값 개수를 같다고 생각함', ratio: 0.19, line_ids: [44] }],
      suggestion: '고윳값 개수는 특성방정식의 해의 개수라는 점을 다시 설명해 주세요',
      spoken_summary: '69%가 2개라고 답했습니다. 19%는 행렬 크기와 고윳값 개수를 혼동했습니다.',
    },
  },
};

/** 교수 화면 응답 수 (뷰 answer_counts) */
export const mockAnswerCounts: Record<number, number> = { 12: 17, 13: 42 };

export const mockMyQuestions: MyQuestion[] = [
  { id: 101, refined: '방금 행렬식을 0으로 놓으신 이유를 다시 설명해 주실 수 있나요?', clusterId: 7 },
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 200;

/** API 흉내. 실제 API와 같은 응답 형식(SPEC §8)을 돌려준다. */
export const mockApi = {
  /** POST /api/question: "점심"·"ㅅㅂ"가 들어가면 rejected, "실패"면 fallback, "?"·"ㅁㄹ"면 후보 표시 */
  async question(raw: string): Promise<QuestionRes> {
    await delay(800);
    if (/점심|ㅅㅂ/.test(raw)) return { status: 'rejected', message: MESSAGES.REJECTED };
    if (raw.includes('실패'))
      return { status: 'sent', fallback: true, message: MESSAGES.FALLBACK, questionId: nextId++, clusterId: 9, count: 2 };
    if (/^\s*(\?|ㅁㄹ|모르겠어요|다시)\s*$/.test(raw))
      return {
        status: 'review',
        question: {
          id: nextId++, refined: '행렬식을 0으로 놓는 이유를 다시 설명해 주실 수 있나요?', confidence: 0.45,
          candidates: ['행렬식을 0으로 놓는 이유를 다시 설명해 주실 수 있나요?', '람다 I를 빼는 이유를 다시 설명해 주실 수 있나요?'],
        },
      };
    return {
      status: 'review',
      question: { id: nextId++, refined: '방금 행렬식을 0으로 놓으신 이유를 다시 설명해 주실 수 있나요?', confidence: 0.85, candidates: [] },
    };
  },

  /** POST /api/question/confirm */
  async confirm(req: ConfirmReq): Promise<ConfirmRes> {
    await delay(300);
    if (req.action === 'cancel') return { ok: true };
    return { clusterId: 7, count: 13 };
  },
};
