// ★ 계약 파일 (docs/SPEC.md §7·§8). 바꿀 때는 contract 라벨 + 팀 공지 + SPEC 동시 수정.

// ───────────── DB 행 ─────────────

export type RoomStatus = 'live' | 'ended';

export interface Room {
  id: string;            // 방 코드 (예: 'K7Q2')
  title: string;
  glossary: string[];
  status: RoomStatus;
  created_at: string;
}

/** 강의 인식 문장. ago_sec는 DB now() 기준 몇 초 전인지 (recent_lines 함수 결과) */
export interface TranscriptLine {
  id: number;
  text: string;
  ago_sec: number;
}

export type QuestionCategory = '관련' | '무관' | '부적절';
export type QuestionStatus = 'pending' | 'sent';

export interface QuestionReview {          // 학생 승인 화면용 (강의 원문·ref_line_ids 없음)
  id: number;
  refined: string;
  confidence: number;
  candidates: string[];                    // 다듬은 질문 후보 (확신도 낮을 때)
}

export interface Cluster {
  id: number;
  room_id: string;
  title: string;
  ref_line_ids: number[];
  count: number;
  read_aloud: boolean;
  updated_at: string;
}

export type ProfQType = 'choice' | 'short' | 'open';
export type ProfQStatus = 'pending' | 'open' | 'closed' | 'dismissed';

/**
 * 교수 발화 의도 (Speech Act, P2). 학생에게 보내는 것은 response_request·understanding_check뿐
 * explanation 설명 / response_request 학생 응답 요청 / understanding_check 이해도 확인 /
 * rhetorical 수사적 질문 / class_management 수업 운영·안내
 */
export type SpeechAct = 'explanation' | 'response_request' | 'understanding_check' | 'rhetorical' | 'class_management';

export interface ProfQuestion {
  id: number;
  room_id: string;
  spoken: string | null;
  /** AI가 분류한 발화 의도. 직접 질문하기는 null */
  speech_act?: SpeechAct | null;
  question: string;
  type: ProfQType;
  options: string[] | null;
  expected_answer: string | null;
  status: ProfQStatus;
  closes_at: string | null;
  summary: ProfQSummary | null;
}

export interface DistributionItem {
  label: string;
  count: number;
  ratio: number;
}

export interface Misconception {
  text: string;
  ratio: number;
  line_ids: number[];
}

export interface ProfQSummary {
  total: number;
  distribution: DistributionItem[];
  misconceptions: Misconception[];
  suggestion: string | null;
  spoken_summary: string;
}

/** 학생 화면이 localStorage에 보관하는 내 질문 (SPEC §8.5) */
export interface MyQuestion {
  id: number;
  refined: string;
  clusterId: number;
}

// ───────────── API 요청·응답 (SPEC §8) ─────────────

export type ApiError = { error: { code: string; message: string } };

// §8.1 수업방
export interface CreateRoomReq { title: string; glossary?: string[] }
export interface CreateRoomRes { roomId: string }
export interface MaterialRes { glossary: string[] }                 // multipart: roomId, file
export interface EndRoomReq { roomId: string }
export interface OkRes { ok: true }

// §8.2 강의 인식
export interface TranscriptReq { roomId: string; text: string }
export interface TranscriptRes { id: number }

// §8.3 학생 질문
export interface QuestionReq { roomId: string; anonId: string; raw: string }
export type QuestionRes =
  | { status: 'review'; question: QuestionReview }
  | { status: 'rejected'; message: string }
  | { status: 'sent'; fallback: true; message: string; questionId: number; clusterId: number; count: number };

export type ConfirmReq =
  | { questionId: number; anonId: string; action: 'send'; candidateIndex?: number }
  | { questionId: number; anonId: string; action: 'cancel' };
export type ConfirmRes = { clusterId: number; count: number } | OkRes;

// §8.3 묶음 낭독 표시
export interface ClusterReadReq { clusterId: number }
// §8.3 다른 학생 질문에 "나도 모르겠어요" (같은 묶음에 합류, 1인 1회)
export interface ClusterJoinReq { clusterId: number; anonId: string }
export interface ClusterJoinRes { questionId: number; clusterId: number; count: number }
// §8.3 교수가 질문 묶음 삭제 (questions.cluster_id는 null로 남음)
export interface ClusterDeleteReq { clusterId: number }

// §8.4 교수 질문
export interface DetectReq { roomId: string; spoken: string; after: string }
export type DetectRes = { detected: true; profQuestionId: number } | { detected: false };

/** durationSec: 응답 시간(초). 0이면 시간 제한 없음(교수가 [마감]할 때까지). 생략하면 CONFIG.PROFQ_DURATION_SEC */
export type OpenReq =
  | { profQuestionId: number; durationSec?: number }
  | { roomId: string; question: string; type: ProfQType; options?: string[]; durationSec?: number };
export interface OpenRes { profQuestionId: number; closesAt: string | null }   // 시간 제한 없으면 null

/** pending(감지 알림 [무시]) 또는 closed(지난 질문 [삭제]) → dismissed. 응답·결과는 지우지 않고 목록에서만 뺀다 */
export interface DismissReq { profQuestionId: number }
export interface CloseReq { profQuestionId: number }
export interface CloseRes { summary: ProfQSummary }

export interface AnswerReq { profQuestionId: number; anonId: string; answer: string }

// ───────────── AI 함수 입출력 (docs/PROMPTS.md, lib/prompts.ts) ─────────────

export interface P1Input { raw: string; lines: TranscriptLine[]; glossary: string[] }
export interface P1Result {
  category: QuestionCategory;
  ref_line_ids: number[];
  refined: string;
  confidence: number;
  candidates: string[];
}

export interface P2Input { lines: TranscriptLine[]; spoken: string; after: string }
export interface P2Result {
  is_real_question: boolean;
  speech_act: SpeechAct;
  question: string;
  type: ProfQType;
  options: string[] | null;
  expected_answer: string | null;
  context_line_ids: number[];
}

export interface P3Input {
  question: string;
  expected_answer: string | null;
  context_lines: TranscriptLine[];
  distribution: DistributionItem[];
  answers: string[];
}
export interface P3Result {
  misconceptions: Misconception[];
  suggestion: string | null;
  spoken_summary: string;
}
