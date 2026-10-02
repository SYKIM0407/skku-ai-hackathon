import 'server-only';
import { askJSON } from './llm';
import { formatLines } from './context';
import { DONT_KNOW } from './config';
import { normalizeAnswer } from './distribution';
import type {
  DistributionItem, Misconception, P1Input, P1Result, P2Input, P2Result, P3Input, P3Result,
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
  const last = lines.at(-1);
  return `[용어집] ${glossary.length ? glossary.join(', ') : '(없음)'}

[최근 강의 내용] (위에서 아래로 시간순. "-N초"는 질문 시점보다 N초 전, N이 작을수록 최근)
${lines.length ? formatLines(lines) : '(없음)'}
[가장 최근 문장] ${last ? `L${last.id}` : '(없음)'}

[학생 질문] "${raw}"

분류 규칙 (category):
- 수업·과제·시험·수업 운영에 관한 것은 "관련" ("시험에 나와요?", "과제 마감 언제예요?" 포함).
- 수업과 무관한 잡담은 "무관".
- 욕설, 조롱, 특정인 비하는 "부적절".
- 판단이 애매하면 "관련". 정상 질문을 놓치는 것이 더 큰 문제다.

매칭 규칙 (ref_line_ids):
- 학생 질문에 강의 문장의 단어·기호·숫자(예: 식, 기호, 값)가 들어 있으면 그것이 나온 문장을 고른다. 여러 곳에 나오면 가장 최근 문장.
- "방금", "?", "ㅁㄹ", "모르겠어요", "다시"처럼 가리키는 내용이 없으면 [가장 최근 문장]과 그 바로 앞 문장 중에서 고른다. 더 이전 문장을 고르지 않는다.
- "아까"는 가장 최근 2문장보다 이전 문장을 우선한다.
- "두 번째 거", "그 공식"처럼 순서나 종류를 가리키면 그에 맞게 찾는다.
- 강의와 연결되지 않는 일반 질문이면 빈 배열.

다듬기 규칙 (refined):
- 교수에게 보낼 정중한 질문 한 문장으로 쓴다.
- 반드시 고른 문장(ref_line_ids)의 내용으로 쓴다. 고르지 않은 문장의 내용을 섞지 않는다.
- 강의 인식 결과의 오타는 용어집을 참고해 바로잡는다.
- 학생의 말투나 개인 정보가 드러나지 않게 한다.
- 강의에 없는 내용을 지어내지 않는다.

확신도:
- 매칭과 다듬기가 확실하지 않으면 confidence를 낮추고,
  candidates에 서로 다른 해석의 다듬은 질문 문장을 2~3개 넣는다.
- category가 "관련"이 아니면 ref_line_ids, refined, candidates는 비운다.

출력 형식 (JSON 하나만. <>는 설명이므로 실제 값으로 바꾼다):
{
  "category": "<관련 | 무관 | 부적절>",
  "ref_line_ids": [<고른 문장 번호(숫자)>],
  "refined": "<교수에게 보낼 질문 한 문장>",
  "confidence": <0~1 숫자>,
  "candidates": [<확신이 낮을 때만 다른 해석의 질문 문장 2~3개>]
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

1) 먼저 [이후 5초간 발화]가 [질문 후보]에 대한 답이나 설명인지 판단해 after_is_answer에 적어라.
   - 예: 질문 후보 "왜 먼저 미분을 할까요" + 이후 발화 "그래야 기울기를 구할 수 있기 때문이에요" → true (교수가 스스로 답함)
   - 예: 이후 발화가 응답을 기다리는 말(생각해 보라, 대답해 보라 등)이거나 이후 발화 없음 → false
2) 학생들의 응답을 기다리는 실제 질문인지 판별해 is_real_question에 적어라.
   - after_is_answer가 true면 수사적 질문이므로 반드시 false
   - 수업 진행 안내(예: "정리하고 넘어갈까요", "마이크 소리 괜찮나요")나 질문이 아닌 문장 → false
   - 그 밖에 학생에게 묻는 질문이면 → true
3) true라면 학생 화면에 표시할 문항으로 정리하라. 강의 맥락을 반영해 문항만 읽어도 이해되게 쓴다.
   "생각해 보세요", "자 그럼" 같은 진행 멘트는 문항에 넣지 않는다.
4) 답변 형식을 골라라.
   - choice: "몇 개", "어느 것", "예/아니요"처럼 답이 몇 개로 나뉠 때. 선택지 3~4개, 마지막은 반드시 "${DONT_KNOW}"
   - short: 선택지로 나누기 어려운 짧은 단어나 숫자
   - open: 의견이나 설명
5) 정답이 분명하면 expected_answer에 적고, 아니면 null.

출력 형식 (JSON 하나만. <>는 설명이므로 실제 값으로 바꾼다):
{
  "after_is_answer": <true | false>,
  "is_real_question": <true | false>,
  "question": "<학생 화면에 표시할 문항>",
  "type": "<choice | short | open>",
  "options": [<choice일 때 선택지, 마지막은 "${DONT_KNOW}">],
  "expected_answer": <"정답" 또는 null>,
  "context_line_ids": [<관련 강의 문장 번호(숫자)>]
}}`;
}

const PROFQ_TYPES: ProfQType[] = ['choice', 'short', 'open'];

/** P2 출력 검증. 테스트를 위해 export */
export function validateP2(r: Record<string, unknown>, input: P2Input): P2Result {
  // 교수가 바로 스스로 답했다고 AI가 판단했으면 수사적 질문 (AI 판정끼리의 모순 정리)
  const selfAnswered = r.after_is_answer === true || r.after_is_answer === 'true';
  const is_real_question = !selfAnswered && (r.is_real_question === true || r.is_real_question === 'true');
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

// ───────────── P3 교수 질문 응답 분석 ─────────────

export const P3_SYSTEM = `너는 수업 중 학생 응답을 분석해 교수에게 간결하게 보고하는 조교다.
반드시 JSON만 출력한다.`;

/** 프롬프트에 넣을 응답 수 상한 (대형 강의에서 토큰·시간 폭주 방지) */
const P3_MAX_ANSWERS = 150;
const P3_MAX_ANSWER_LEN = 200;

const pct = (r: number) => `${Math.round(r * 100)}%`;
const formatDistribution = (d: DistributionItem[]) =>
  d.length ? d.map((x) => `${x.label} ${x.count}명(${pct(x.ratio)})`).join(', ') : '(응답 없음)';

export function p3User({ question, expected_answer, context_lines, distribution, answers }: P3Input): string {
  const shown = answers.slice(0, P3_MAX_ANSWERS).map((a) => `- ${a.trim().slice(0, P3_MAX_ANSWER_LEN)}`);
  const more = answers.length > P3_MAX_ANSWERS ? `\n(외 ${answers.length - P3_MAX_ANSWERS}개 생략, 분포는 전체 기준)` : '';
  return `[문항] ${question}
[예상 정답] ${expected_answer ?? '(없음)'}
[관련 강의 내용]
${context_lines.length ? formatLines(context_lines) : '(없음)'}
[답변 분포] ${formatDistribution(distribution)}
[학생 응답 ${answers.length}개]
${shown.join('\n') || '(없음)'}${more}

1) 오답에 공통으로 나타나는 오해를 최대 2개 찾아라. 실제로 그 오답을 낸 응답이 있을 때만 쓴다. 없으면 빈 배열.
2) 각 오해에 해당하는 응답(답변 분포의 항목 이름 그대로)과 관련된 강의 문장 번호를 적어라.
3) 교수가 다시 설명하면 좋을 내용을 한 문장으로 써라.
4) 교실에서 읽을 짧은 요약문을 한두 문장으로 써라. 학생을 탓하지 않는 정중한 문체로 쓴다.
   숫자·비율(%)은 쓰지 않는다. 응답 비율 문장은 코드가 [답변 분포]로 따로 만든다.
5) 수업과 무관한 응답은 분석에서 제외한다.

출력 형식 (JSON 하나만. <>는 설명이므로 실제 값으로 바꾼다):
{
  "misconceptions": [
    { "text": "<학생들이 무엇을 오해했는지 한 문장>", "answers": [<이 오해에 해당하는 응답 항목 이름>], "line_ids": [<관련 강의 문장 번호(숫자)>] }
  ],
  "suggestion": "<다시 설명하면 좋을 내용 한 문장, 없으면 null>",
  "spoken_summary": "<숫자 없이 오해를 짚는 요약 한두 문장>"
}`;
}

/** 교실에서 읽을 응답 비율 문장. 정답이 있으면 정답 비율, 없으면 가장 많은 응답 */
export function fallbackSpokenSummary(distribution: DistributionItem[], expected?: string | null): string {
  if (!distribution.some((d) => d.count > 0)) return '아직 응답이 없습니다';
  const exp = expected ? distribution.find((d) => normalizeAnswer(d.label) === normalizeAnswer(expected)) : undefined;
  if (exp) return `정답(${exp.label})을 고른 학생은 ${pct(exp.ratio)}입니다`;
  const top = [...distribution].sort((a, b) => b.count - a.count)[0];
  return `가장 많이 고른 답은 ${top.label}, ${pct(top.ratio)}입니다`;
}

/** P3 실패 시 대체 결과. /api/prof-q/close에서 analyzeAnswers가 null이면 이걸 쓴다 */
export function fallbackSummary(distribution: DistributionItem[], expected?: string | null): P3Result {
  return { misconceptions: [], suggestion: null, spoken_summary: fallbackSpokenSummary(distribution, expected) };
}

/** AI 요약에서 숫자·비율이 든 문장을 뺀다 (예시를 베끼거나 비율을 지어내는 것 방지) */
const dropNumberSentences = (text: string): string =>
  (text.match(/[^.!?。]+[.!?。]?/g) ?? [])
    .map((x) => x.trim())
    .filter((x) => x && !/\d\s*(%|퍼센트|명)|\d+\s*분의/.test(x))
    .join(' ');

/** P3 출력 검증. 테스트를 위해 export */
export function validateP3(r: Record<string, unknown>, input: P3Input): P3Result {
  const byKey = new Map(input.distribution.map((d) => [normalizeAnswer(d.label), d]));
  const misconceptions: Misconception[] = (Array.isArray(r.misconceptions) ? r.misconceptions : [])
    .map((m: unknown) => {
      const o = (m ?? {}) as Record<string, unknown>;
      // 비율은 AI가 짚은 응답 항목으로 코드가 계산한다 (AI가 비율을 지어내지 않게)
      const matched = [...new Set(strList(o.answers, 10).map(normalizeAnswer))]
        .map((k) => byKey.get(k))
        .filter((d): d is DistributionItem => !!d);
      let ratio: number;
      if (matched.length) ratio = Math.round(matched.reduce((sum, d) => sum + d.ratio, 0) * 100) / 100;
      else {
        ratio = Number(o.ratio);
        if (ratio > 1 && ratio <= 100) ratio /= 100; // "20"처럼 퍼센트로 오는 경우
      }
      return { text: str(o.text), ratio: clamp01(ratio), line_ids: validIds(o.line_ids, input.context_lines) };
    })
    .filter((m) => m.text)
    .slice(0, 2);

  // 비율 문장은 코드로, AI 문장은 숫자 든 문장을 빼고 뒤에 붙인다
  const head = fallbackSpokenSummary(input.distribution, input.expected_answer);
  const tail = dropNumberSentences(str(r.spoken_summary));
  const suggestion = str(r.suggestion);
  return {
    misconceptions,
    suggestion: suggestion && suggestion.toLowerCase() !== 'null' ? suggestion : null,
    spoken_summary: tail ? `${head}. ${tail}` : head,
  };
}

/** P3 교수 질문 응답 분석 (분포는 호출 전에 lib/distribution.ts로 계산). 실패하면 null → fallbackSummary */
export async function analyzeAnswers(input: P3Input): Promise<P3Result | null> {
  const r = await askJSON<Record<string, unknown>>(P3_SYSTEM, p3User(input));
  return r ? validateP3(r, input) : null;
}

/** P6 교안 PDF 핵심 용어 추출 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function extractGlossary(text: string): Promise<string[] | null> {
  // TODO(T-44, A)
  return null;
}
