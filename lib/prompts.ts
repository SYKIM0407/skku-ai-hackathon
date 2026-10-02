import 'server-only';
import { askJSON } from './llm';
import { formatLines } from './context';
import { DONT_KNOW } from './config';
import type {
  P1Input, P1Result, P2Input, P2Result, P3Input, P3Result,
  ProfQType, QuestionCategory, TranscriptLine,
} from './types';

// 프롬프트 원문은 docs/PROMPTS.md. 여기를 고치면 문서도 같이 고친다.
// 모든 함수는 AI 실패 시 null을 돌려주고, 호출부(app/api/**)가 대체 동작을 맡는다.

// ───────────── 공통 검증 도우미 ─────────────

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const clamp01 = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
};
/** 입력에 있는 문장 번호만 남긴다 ("L43", "43", 43 모두 허용, 중복 제거) */
function validIds(v: unknown, lines: TranscriptLine[]): number[] {
  if (!Array.isArray(v)) return [];
  const allowed = new Set(lines.map((l) => l.id));
  const out: number[] = [];
  for (const x of v) {
    const n = Number(String(x).replace(/^L/i, ''));
    if (allowed.has(n) && !out.includes(n)) out.push(n);
  }
  return out;
}
const strList = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? [...new Set(v.map(str).filter(Boolean))].slice(0, max) : [];

// ───────────── P1 학생 질문 ─────────────

export const P1_SYSTEM = `너는 대학 강의의 질문 해석기다.
학생의 짧고 모호한 질문을 분류하고, 강의의 어느 부분을 가리키는지 찾고,
교수가 바로 이해할 수 있는 정중한 질문으로 다듬는다.
반드시 JSON만 출력한다.`;

export function p1User({ raw, lines, glossary }: P1Input): string {
  return `[용어집] ${glossary.length ? glossary.join(', ') : '(없음)'}

[최근 강의 내용] (음수는 질문 시점 기준 몇 초 전)
${lines.length ? formatLines(lines) : '(없음)'}

[학생 질문] "${raw}"

분류 규칙 (category):
- 수업·과제·시험·수업 운영에 관한 것은 "관련" ("시험에 나와요?", "과제 마감 언제예요?" 포함).
- 수업과 무관한 잡담은 "무관".
- 욕설, 조롱, 특정인 비하는 "부적절".
- 판단이 애매하면 "관련". 정상 질문을 놓치는 것이 더 큰 문제다.

매칭 규칙 (ref_line_ids):
- "방금"은 가장 최근 1~2문장, "아까"는 그보다 이전을 우선한다.
- "두 번째 거", "그 공식"처럼 순서나 종류를 가리키면 그에 맞게 찾는다.
- "?", "ㅁㄹ", "모르겠어요"만 있으면 가장 최근 설명을 이해하지 못한 것으로 본다.
- 강의와 연결되지 않는 일반 질문이면 빈 배열.

다듬기 규칙 (refined):
- 교수에게 보낼 정중한 질문 한 문장으로 쓴다.
- 강의 인식 결과의 오타는 용어집을 참고해 바로잡는다.
- 학생의 말투나 개인 정보가 드러나지 않게 한다.
- 강의에 없는 내용을 지어내지 않는다.

확신도:
- 매칭과 다듬기가 확실하지 않으면 confidence를 낮추고,
  candidates에 서로 다른 해석의 다듬은 질문 문장을 2~3개 넣는다.
- category가 "관련"이 아니면 ref_line_ids, refined, candidates는 비운다.

출력 형식:
{
  "category": "관련",
  "ref_line_ids": [43, 44],
  "refined": "방금 행렬식을 0으로 놓으신 이유를 다시 설명해 주실 수 있나요?",
  "confidence": 0.85,
  "candidates": []
}`;
}

const CATEGORIES: QuestionCategory[] = ['관련', '무관', '부적절'];

/** P1 출력 검증 (PROMPTS.md "검증"). 테스트를 위해 export */
export function validateP1(r: Record<string, unknown>, input: P1Input): P1Result {
  const category = CATEGORIES.includes(r.category as QuestionCategory) ? (r.category as QuestionCategory) : '관련';
  if (category !== '관련') return { category, ref_line_ids: [], refined: '', confidence: clamp01(r.confidence), candidates: [] };
  const refined = str(r.refined) || input.raw;
  return {
    category,
    ref_line_ids: validIds(r.ref_line_ids, input.lines),
    refined,
    confidence: clamp01(r.confidence),
    candidates: strList(r.candidates, 3),
  };
}

/** P1 학생 질문: 분류 + 강의 시점 매칭 + 다듬기 (+ PROMPTS.md "검증") */
export async function interpretQuestion(input: P1Input): Promise<P1Result | null> {
  const r = await askJSON<Record<string, unknown>>(P1_SYSTEM, p1User(input));
  return r ? validateP1(r, input) : null;
}

// ───────────── P2 교수 질문 판별 ─────────────

export const P2_SYSTEM = `너는 대학 강의에서 교수가 학생에게 던진 질문을 찾아 정리하는 도우미다.
반드시 JSON만 출력한다.`;

export function p2User({ lines, spoken, after }: P2Input): string {
  return `[최근 강의 내용]
${lines.length ? formatLines(lines) : '(없음)'}

[질문 후보] "${spoken}"
[이후 5초간 발화] "${after}"

1) 학생들의 응답을 기다리는 실제 질문인지 판별하라.
   - 직후에 교수가 스스로 답하면 수사적 질문이다 → false
   - "생각해 보세요", "누가 대답해 볼까요", 또는 이후 발화가 없으면 → true
2) true라면 학생 화면에 표시할 문항으로 정리하라. 강의 맥락을 반영해 문항만 읽어도 이해되게 쓴다.
3) 답변 형식을 골라라.
   - choice: 답이 몇 개로 나뉠 때. 선택지 3~4개, 마지막은 반드시 "${DONT_KNOW}"
   - short: 짧은 단어나 숫자
   - open: 의견이나 설명
4) 정답이 분명하면 expected_answer에 적고, 아니면 null.

출력 형식:
{
  "is_real_question": true,
  "question": "방금 예제의 2×2 행렬은 고윳값이 몇 개일까요?",
  "type": "choice",
  "options": ["1개", "2개", "3개", "${DONT_KNOW}"],
  "expected_answer": "2개",
  "context_line_ids": [52, 53]
}`;
}

const PROFQ_TYPES: ProfQType[] = ['choice', 'short', 'open'];

/** P2 출력 검증. 테스트를 위해 export */
export function validateP2(r: Record<string, unknown>, input: P2Input): P2Result {
  const is_real_question = r.is_real_question === true || r.is_real_question === 'true';
  let type: ProfQType = PROFQ_TYPES.includes(r.type as ProfQType) ? (r.type as ProfQType) : 'open';
  let options: string[] | null = null;

  if (type === 'choice') {
    // "모르겠어요"는 항상 마지막 하나만 (FR-B6)
    const opts = strList(r.options, 6).filter((o) => o !== DONT_KNOW);
    if (opts.length >= 2) options = [...opts, DONT_KNOW];
    else type = 'short'; // 선택지가 모자라면 선택형으로 쓸 수 없다
  }

  const expected = str(r.expected_answer);
  return {
    is_real_question,
    question: str(r.question) || input.spoken,
    type,
    options,
    expected_answer: expected && expected.toLowerCase() !== 'null' ? expected : null,
    context_line_ids: validIds(r.context_line_ids, input.lines),
  };
}

/** P2 교수 질문 판별·문항 정리 (choice면 마지막 선택지 "모르겠어요" 보정) */
export async function judgeProfQuestion(input: P2Input): Promise<P2Result | null> {
  const r = await askJSON<Record<string, unknown>>(P2_SYSTEM, p2User(input));
  return r ? validateP2(r, input) : null;
}

/** P3 교수 질문 응답 분석 (분포는 호출 전에 코드로 계산) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function analyzeAnswers(input: P3Input): Promise<P3Result | null> {
  // TODO(T-43, A): 2단계 feat/A-p3-dist
  return null;
}

/** P6 교안 PDF 핵심 용어 추출 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function extractGlossary(text: string): Promise<string[] | null> {
  // TODO(T-44, A)
  return null;
}
