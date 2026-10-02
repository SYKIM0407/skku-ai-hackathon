// ★ 계약 파일 (docs/SPEC.md §11.1). 시간 범위·임계값은 여기서만 정의한다.

export const CONFIG = {
  /** 질문 해석에 쓰는 최근 강의 인식 범위 (D-3) */
  CONTEXT_WINDOW_SEC: 180,
  /** 질문 시각 이후 여유 (인식 지연 보정) */
  CONTEXT_GRACE_SEC: 5,
  /** 교수 질문 판별용 맥락 범위 */
  PROFQ_CONTEXT_SEC: 120,
  /** 질문 후보 뒤 이후 발화 수집 시간 */
  PROFQ_WAIT_MS: 5000,
  /** 교수가 이만큼 말을 멈추면 모인 문장을 AI에게 보낸다 (요청 뒤 침묵). 보통 문장 간격보다 길게 */
  PROFQ_SILENCE_MS: 10000,
  /** 질문 어미가 없어도 이만큼 문장이 모이면 AI가 교수 질문인지 판단한다 */
  PROFQ_SCAN_LINES: 3,
  /** 교수 질문 응답 시간 (D-4) */
  PROFQ_DURATION_SEC: 45,
  /** 이 값 미만이면 다듬은 질문 후보 표시 */
  LOW_CONFIDENCE: 0.6,
  /** AI 제한 시간 */
  LLM_TIMEOUT_MS: 8000,
  /** 주기 조회 간격 */
  POLL_INTERVAL_MS: 2000,
  /** false면 Realtime 대신 주기 조회 */
  USE_REALTIME: process.env.NEXT_PUBLIC_USE_REALTIME !== 'false',
} as const;

/** 선택형 교수 질문의 마지막 선택지 (FR-B6) */
export const DONT_KNOW = '모르겠어요';

/** 안내 문구 (SPEC §8.3) */
export const MESSAGES = {
  REJECTED: '수업과 관련된 질문만 보낼 수 있습니다',
  FALLBACK: 'AI 정리 없이 전달되었습니다',
} as const;
