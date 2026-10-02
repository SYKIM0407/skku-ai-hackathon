/**
 * P1·P2·P3 빠른 확인 (DB 없이 scripts/demo-lecture.json을 메모리 강의 문장으로 사용)
 *
 *   npx tsx --conditions=react-server scripts/try-prompts.ts
 *   npx tsx --conditions=react-server scripts/try-prompts.ts --providers openai,anthropic --runs 3
 *
 * --conditions=react-server: lib/*.ts의 `import 'server-only'`를 통과시키기 위해 필요
 * .env.local의 OPENAI_API_KEY / ANTHROPIC_API_KEY / LLM_MODEL을 읽는다.
 * 공급자별 모델을 바꾸려면 OPENAI_MODEL / ANTHROPIC_MODEL (없으면 lib/llm.ts 기본값)
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { TranscriptLine } from '../lib/types';

const root = path.resolve(__dirname, '..');
if (existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'));

// ───────────── 인자 ─────────────
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const providers = (arg('providers') ?? process.env.LLM_PROVIDER ?? 'openai').split(',').map((s) => s.trim());
const runs = Number(arg('runs') ?? 1);

// ───────────── 데모 대본 → 강의 문장 ─────────────
type Script = { delay: number; text: string }[];
const script: Script = JSON.parse(readFileSync(path.join(root, 'scripts/demo-lecture.json'), 'utf8'));
const ids = script.map((_, i) => i + 1); // L1, L2, …
const at = script.reduce<number[]>((acc, s, i) => [...acc, (acc[i - 1] ?? 0) + s.delay], []);

/** uptoId번 문장이 끝난 직후(+gap초)에 질문했다고 가정한 최근 강의 문장 */
function linesAt(uptoId: number, gap = 2): TranscriptLine[] {
  const now = at[uptoId - 1] + gap;
  return ids.slice(0, uptoId).map((id, i) => ({ id, text: script[i].text, ago_sec: now - at[i] }));
}
const findId = (needle: string) => ids[script.findIndex((s) => s.text.includes(needle))];

const L_DET = findId('행렬식을 0으로'); // "그래서 A에서 람다 I를 빼고 행렬식을 0으로 놓습니다"
const L_WHY = findId('왜 0으로 놓을까요');
const L_ANS = findId('그건 바로');
const L_HOWMANY = findId('몇 개일까요');
const L_THINK = findId('생각해 보세요');
const glossary = ['고윳값', '고유벡터', '람다', '행렬식', '특성방정식', '선형변환'];

// ───────────── 확인 케이스 ─────────────
type P1Case = { kind: 'P1'; name: string; raw: string; upto: number; expect: { category: string; refIncludes?: number } };
type P2Case = { kind: 'P2'; name: string; spoken: string; after: string; upto: number; expect: { real: boolean; type?: string } };
type P3Case = { kind: 'P3'; name: string; answers: string[]; upto: number };
type Case = P1Case | P2Case | P3Case;

const cases: Case[] = [
  // 필수 (팀 프롬프트)
  { kind: 'P1', name: '방금 그거 왜 0임', raw: '방금 그거 왜 0임', upto: L_DET, expect: { category: '관련', refIncludes: L_DET } },
  { kind: 'P1', name: '점심 뭐 먹지', raw: '점심 뭐 먹지', upto: L_DET, expect: { category: '무관' } },
  { kind: 'P2', name: '수사적: 왜 0으로 놓을까요', spoken: script[L_WHY - 1].text, after: script[L_ANS - 1].text, upto: L_WHY - 1, expect: { real: false } },
  { kind: 'P2', name: '실제: 고윳값이 몇 개일까요', spoken: script[L_HOWMANY - 1].text, after: script[L_THINK - 1].text, upto: L_HOWMANY - 1, expect: { real: true, type: 'choice' } },
  // 추가 (발표 수치용)
  { kind: 'P1', name: 'ㅁㄹ', raw: 'ㅁㄹ', upto: L_DET, expect: { category: '관련', refIncludes: L_DET } },
  { kind: 'P1', name: '시험에 나와요?', raw: '이거 시험에 나와요?', upto: L_DET, expect: { category: '관련' } },
  { kind: 'P1', name: '아까 방향 안 바뀌는 거', raw: '아까 방향 안 바뀐다는 게 뭔소리임', upto: L_DET, expect: { category: '관련', refIncludes: findId('방향이 바뀌지') } },
  { kind: 'P1', name: '부적절', raw: '교수님 설명 진짜 개노잼이네 ㅋㅋ', upto: L_DET, expect: { category: '부적절' } },
  // P3: 2×2 행렬 고윳값 개수 응답 13개 (3개 = 행렬 크기와 혼동, 4개 = 원소 수와 혼동)
  { kind: 'P3', name: '고윳값 개수 응답 분석', upto: L_THINK,
    answers: ['2개', '2개', '2 개', '2개', '2개', '2개', '2개', '2개', '4개', '3개', '4개', '모르겠어요', '1개'] },
];
const P3_Q = { type: 'choice' as const, options: ['1개', '2개', '3개', '4개', '모르겠어요'] };

// ───────────── 실행 ─────────────
const MODEL_ENV: Record<string, string | undefined> = { openai: process.env.OPENAI_MODEL, anthropic: process.env.ANTHROPIC_MODEL };
const baseModel = process.env.LLM_MODEL;

async function main() {
  const { interpretQuestion, judgeProfQuestion, analyzeAnswers } = await import('../lib/prompts');
  const { computeDistribution } = await import('../lib/distribution');
  const summary: string[] = [];

  for (const provider of providers) {
    process.env.LLM_PROVIDER = provider;
    // LLM_MODEL은 .env.local의 공급자와 같을 때만 쓴다 (gpt 모델을 anthropic에 넘기지 않게)
    const m = MODEL_ENV[provider] ?? (baseModel && (provider === 'openai') === baseModel.startsWith('gpt') ? baseModel : undefined);
    if (m) process.env.LLM_MODEL = m; else delete process.env.LLM_MODEL;
    console.log(`\n━━━━━━━━ ${provider} (${process.env.LLM_MODEL ?? '기본 모델'}) ━━━━━━━━`);

    let pass = 0, total = 0, fail = 0;
    const times: number[] = [];

    for (const c of cases) {
      for (let r = 0; r < runs; r++) {
        total++;
        const t0 = Date.now();
        let ok = false;
        let detail = '';
        if (c.kind === 'P1') {
          const res = await interpretQuestion({ raw: c.raw, lines: linesAt(c.upto), glossary });
          if (!res) { fail++; detail = 'null (AI 실패)'; }
          else {
            ok = res.category === c.expect.category && (c.expect.refIncludes == null || res.ref_line_ids.includes(c.expect.refIncludes));
            detail = `${res.category} refs=[${res.ref_line_ids.map((i) => 'L' + i).join(',')}] conf=${res.confidence} → "${res.refined}"${res.candidates.length ? ` 후보 ${res.candidates.length}개` : ''}`;
          }
        } else if (c.kind === 'P3') {
          const distribution = computeDistribution(P3_Q, c.answers.map((answer) => ({ answer })));
          const res = await analyzeAnswers({
            question: '방금 예제의 2×2 행렬은 고윳값이 몇 개일까요?', expected_answer: '2개',
            context_lines: linesAt(c.upto), distribution, answers: c.answers,
          });
          if (!res) { fail++; detail = 'null (AI 실패)'; }
          else {
            ok = res.misconceptions.length >= 1 && res.spoken_summary.length > 0;
            detail = `오해 ${res.misconceptions.map((m) => `"${m.text}"(${m.ratio})`).join(', ') || '없음'} / 제안: ${res.suggestion} / 요약: "${res.spoken_summary}"`;
          }
        } else {
          const res = await judgeProfQuestion({ lines: linesAt(c.upto), spoken: c.spoken, after: c.after });
          if (!res) { fail++; detail = 'null (AI 실패)'; }
          else {
            ok = res.is_real_question === c.expect.real && (!c.expect.real || c.expect.type == null || res.type === c.expect.type);
            detail = `real=${res.is_real_question} ${res.type} "${res.question}"${res.options ? ` [${res.options.join(' / ')}]` : ''} 정답=${res.expected_answer}`;
          }
        }
        const ms = Date.now() - t0;
        times.push(ms);
        if (ok) pass++;
        console.log(`${ok ? '✅' : '❌'} [${c.kind}] ${c.name.padEnd(22)} ${String(ms).padStart(5)}ms  ${detail}`);
      }
    }
    const sorted = [...times].sort((a, b) => a - b);
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const line = `${provider} (${process.env.LLM_MODEL ?? '기본'}): 정답 ${pass}/${total} (${Math.round((pass / total) * 100)}%), AI 실패 ${fail}, 평균 ${avg}ms, p95 ${p95}ms`;
    summary.push(line);
  }

  console.log('\n━━━━━━━━ 요약 ━━━━━━━━');
  summary.forEach((s) => console.log(s));
}

main();
