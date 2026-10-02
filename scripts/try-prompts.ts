/**
 * P1·P2·P3 빠른 확인 (DB 없이 scripts/demo-lecture.json을 메모리 강의 문장으로 사용)
 *
 *   npx tsx --conditions=react-server scripts/try-prompts.ts                       # 빠른 확인 9개
 *   npx tsx --conditions=react-server scripts/try-prompts.ts --set e1,e2,e3          # 평가 데이터 100개 (scripts/eval-data.json)
 *   npx tsx --conditions=react-server scripts/try-prompts.ts --providers openai,anthropic --runs 3
 *
 * --set: quick(기본) | e1(시점 매칭) | e2(교수 질문 감지) | e3(거르기) | all. 쉼표로 여러 개
 * --verbose: 맞은 케이스도 출력 (기본은 틀린 것만, quick은 전부)
 * --conditions=react-server: lib/*.ts의 `import 'server-only'`를 통과시키기 위해 필요
 * .env.local의 OPENAI_API_KEY / ANTHROPIC_API_KEY / LLM_MODEL을 읽는다.
 * 공급자별 모델을 바꾸려면 OPENAI_MODEL / ANTHROPIC_MODEL (없으면 lib/llm.ts 기본값)
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../lib/config';
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
const setArg = (arg('set') ?? 'quick').split(',').map((s) => s.trim());
const sets = setArg.includes('all') ? ['quick', 'e1', 'e2', 'e3'] : setArg;
const verbose = process.argv.includes('--verbose');

// ───────────── 데모 대본 → 강의 문장 ─────────────
type Script = { delay: number; text: string }[];
const script: Script = JSON.parse(readFileSync(path.join(root, 'scripts/demo-lecture.json'), 'utf8'));
const ids = script.map((_, i) => i + 1); // L1, L2, …
const at = script.reduce<number[]>((acc, s, i) => [...acc, (acc[i - 1] ?? 0) + s.delay], []);

/** uptoId번 문장이 끝난 직후(+gap초)에 질문했다고 가정한 최근 windowSec초 강의 문장 (실제 recentLines와 같은 범위) */
function linesAt(uptoId: number, windowSec: number = CONFIG.CONTEXT_WINDOW_SEC, gap = 2): TranscriptLine[] {
  const now = at[uptoId - 1] + gap;
  return ids
    .slice(0, uptoId)
    .map((id, i) => ({ id, text: script[i].text, ago_sec: now - at[i] }))
    .filter((l) => l.ago_sec <= windowSec);
}
const findId = (needle: string) => ids[script.findIndex((s) => s.text.includes(needle))];

// ───────────── 케이스 ─────────────
type P1Case = { kind: 'P1'; set: string; name: string; raw: string; upto: number; category: string; refAny?: number[] };
type P2Case = { kind: 'P2'; set: string; name: string; spoken: string; after: string; upto: number; real: boolean; type?: string; group?: string };
type P3Case = { kind: 'P3'; set: string; name: string; answers: string[]; upto: number };
type Case = P1Case | P2Case | P3Case;

const evalData = JSON.parse(readFileSync(path.join(root, 'scripts/eval-data.json'), 'utf8'));
const glossary: string[] = evalData.glossary;

const L_DET = findId('행렬식을 0으로');
const L_WHY = findId('왜 0으로 놓을까요');
const L_ANS = findId('그건 바로');
const L_HOWMANY = findId('고윳값이 몇 개일까요');
const L_THINK = findId('생각해 보세요');

const quick: Case[] = [
  // 필수 (팀 프롬프트)
  { kind: 'P1', set: 'quick', name: '방금 그거 왜 0임', raw: '방금 그거 왜 0임', upto: L_DET, category: '관련', refAny: [L_DET] },
  { kind: 'P1', set: 'quick', name: '점심 뭐 먹지', raw: '점심 뭐 먹지', upto: L_DET, category: '무관' },
  { kind: 'P2', set: 'quick', name: '수사적: 왜 0으로 놓을까요', spoken: script[L_WHY - 1].text, after: script[L_ANS - 1].text, upto: L_WHY - 1, real: false },
  { kind: 'P2', set: 'quick', name: '실제: 고윳값이 몇 개일까요', spoken: script[L_HOWMANY - 1].text, after: script[L_THINK - 1].text, upto: L_HOWMANY - 1, real: true, type: 'choice' },
  // 추가
  { kind: 'P1', set: 'quick', name: 'ㅁㄹ', raw: 'ㅁㄹ', upto: L_DET, category: '관련', refAny: [L_DET] },
  { kind: 'P1', set: 'quick', name: '시험에 나와요?', raw: '이거 시험에 나와요?', upto: L_DET, category: '관련' },
  { kind: 'P1', set: 'quick', name: '아까 방향 안 바뀌는 거', raw: '아까 방향 안 바뀐다는 게 뭔소리임', upto: L_DET, category: '관련', refAny: [findId('방향이 바뀌지')] },
  { kind: 'P1', set: 'quick', name: '부적절', raw: '교수님 설명 진짜 개노잼이네 ㅋㅋ', upto: L_DET, category: '부적절' },
  // P3: 2×2 행렬 고윳값 개수 응답 13개 (3개 = 행렬 크기와 혼동, 4개 = 원소 수와 혼동)
  { kind: 'P3', set: 'quick', name: '고윳값 개수 응답 분석', upto: L_THINK,
    answers: ['2개', '2개', '2 개', '2개', '2개', '2개', '2개', '2개', '4개', '3개', '4개', '모르겠어요', '1개'] },
];
const P3_Q = { type: 'choice' as const, options: ['1개', '2개', '3개', '4개', '모르겠어요'] };

const e1: Case[] = evalData.e1.cases.map((c: { raw: string; upto: number; expect: number[] }) => ({
  kind: 'P1', set: 'e1', name: `L${c.upto} ${c.raw}`, raw: c.raw, upto: c.upto, category: '관련', refAny: c.expect,
}));
const e2: Case[] = evalData.e2.cases.map((c: { kind: string; spoken: string; after: string; upto: number; real: boolean }) => ({
  kind: 'P2', set: 'e2', name: `${c.kind}: ${c.spoken}`, spoken: c.spoken, after: c.after, upto: c.upto, real: c.real, group: c.kind,
}));
const e3: Case[] = evalData.e3.cases.map((c: { raw: string; expect: string }) => ({
  kind: 'P1', set: 'e3', name: c.raw, raw: c.raw, upto: evalData.e3.upto, category: c.expect,
}));
const cases = [...(sets.includes('quick') ? quick : []), ...(sets.includes('e1') ? e1 : []), ...(sets.includes('e2') ? e2 : []), ...(sets.includes('e3') ? e3 : [])];

// ───────────── 실행 ─────────────
const MODEL_ENV: Record<string, string | undefined> = { openai: process.env.OPENAI_MODEL, anthropic: process.env.ANTHROPIC_MODEL };
const baseModel = process.env.LLM_MODEL;
type Result = { c: Case; ok: boolean; failed: boolean; ms: number; got?: string; real?: boolean };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');

function report(set: string, rs: Result[]): string {
  const n = rs.length;
  const fail = rs.filter((r) => r.failed).length;
  const ok = rs.filter((r) => r.ok).length;
  if (set === 'e2') {
    // 정밀도: real이라 판정한 것 중 실제 질문 / 재현율: 실제 질문 중 real이라 판정
    const tp = rs.filter((r) => r.real && (r.c as P2Case).real).length;
    const fp = rs.filter((r) => r.real && !(r.c as P2Case).real).length;
    const fn = rs.filter((r) => !r.real && (r.c as P2Case).real).length;
    return `E2 교수 질문 감지: 정확도 ${pct(ok, n)} (${ok}/${n}), 정밀도 ${pct(tp, tp + fp)}, 재현율 ${pct(tp, tp + fn)}, AI 실패 ${fail}`;
  }
  if (set === 'e3') {
    const bad = rs.filter((r) => (r.c as P1Case).category !== '관련');
    const border = rs.filter((r) => (r.c as P1Case).category === '관련');
    const excluded = bad.filter((r) => r.got && r.got !== '관련').length;
    const wrongExcluded = border.filter((r) => r.got && r.got !== '관련').length;
    return `E3 거르기: 제외율 ${pct(excluded, bad.length)} (${excluded}/${bad.length}), 오제외율 ${pct(wrongExcluded, border.length)} (${wrongExcluded}/${border.length}), 분류 정확도 ${pct(ok, n)}, AI 실패 ${fail}`;
  }
  if (set === 'e1') return `E1 시점 매칭: 적중률 ${pct(ok, n)} (${ok}/${n}), AI 실패 ${fail}`;
  return `빠른 확인: ${ok}/${n} (${pct(ok, n)}), AI 실패 ${fail}`;
}

async function main() {
  const { interpretQuestion, judgeProfQuestion, analyzeAnswers } = await import('../lib/prompts');
  const { computeDistribution } = await import('../lib/distribution');
  const summary: string[] = [];

  for (const provider of providers) {
    process.env.LLM_PROVIDER = provider;
    // LLM_MODEL은 .env.local의 공급자와 같을 때만 쓴다 (gpt 모델을 anthropic에 넘기지 않게)
    const m = MODEL_ENV[provider] ?? (baseModel && (provider === 'openai') === baseModel.startsWith('gpt') ? baseModel : undefined);
    if (m) process.env.LLM_MODEL = m; else delete process.env.LLM_MODEL;
    const label = `${provider} (${process.env.LLM_MODEL ?? '기본 모델'})`;
    console.log(`\n━━━━━━━━ ${label} ━━━━━━━━`);

    const results: Result[] = [];
    for (const c of cases) {
      for (let r = 0; r < runs; r++) {
        const t0 = Date.now();
        const res: Result = { c, ok: false, failed: false, ms: 0 };
        let detail = '';
        if (c.kind === 'P1') {
          const out = await interpretQuestion({ raw: c.raw, lines: linesAt(c.upto), glossary });
          if (!out) { res.failed = true; detail = 'null (AI 실패)'; }
          else {
            res.got = out.category;
            res.ok = out.category === c.category && (!c.refAny || c.refAny.some((id) => out.ref_line_ids.includes(id)));
            detail = `${out.category} refs=[${out.ref_line_ids.map((i) => 'L' + i).join(',')}]${c.refAny ? ` (정답 ${c.refAny.map((i) => 'L' + i).join('/')})` : ''} conf=${out.confidence} → "${out.refined}"${out.candidates.length ? ` 후보 ${out.candidates.length}개` : ''}`;
          }
        } else if (c.kind === 'P2') {
          const out = await judgeProfQuestion({ lines: linesAt(c.upto, CONFIG.PROFQ_CONTEXT_SEC), spoken: c.spoken, after: c.after });
          if (!out) { res.failed = true; detail = 'null (AI 실패)'; }
          else {
            res.real = out.is_real_question;
            res.ok = out.is_real_question === c.real && (!c.real || !c.type || out.type === c.type);
            detail = `real=${out.is_real_question} ${out.type} "${out.question}"${out.options ? ` [${out.options.join(' / ')}]` : ''} 정답=${out.expected_answer}`;
          }
        } else {
          const distribution = computeDistribution(P3_Q, c.answers.map((answer) => ({ answer })));
          const out = await analyzeAnswers({
            question: '방금 예제의 2×2 행렬은 고윳값이 몇 개일까요?', expected_answer: '2개',
            context_lines: linesAt(c.upto, CONFIG.PROFQ_CONTEXT_SEC), distribution, answers: c.answers,
          });
          if (!out) { res.failed = true; detail = 'null (AI 실패)'; }
          else {
            res.ok = out.misconceptions.length >= 1 && out.spoken_summary.length > 0;
            detail = `오해 ${out.misconceptions.map((x) => `"${x.text}"(${x.ratio})`).join(', ') || '없음'} / 제안: ${out.suggestion} / 요약: "${out.spoken_summary}"`;
          }
        }
        res.ms = Date.now() - t0;
        results.push(res);
        if (verbose || c.set === 'quick' || !res.ok) {
          console.log(`${res.ok ? '✅' : '❌'} [${c.set}/${c.kind}] ${c.name.slice(0, 28).padEnd(28)} ${String(res.ms).padStart(5)}ms  ${detail}`);
        }
      }
    }

    // E4 응답 속도는 P1 호출(질문 입력 → 승인 화면의 AI 부분) 기준
    const p1ms = results.filter((r) => r.c.kind === 'P1').map((r) => r.ms).sort((a, b) => a - b);
    const speed = p1ms.length
      ? `E4 P1 응답 속도: 평균 ${Math.round(p1ms.reduce((a, b) => a + b, 0) / p1ms.length)}ms, 최대 ${p1ms.at(-1)}ms (${p1ms.length}회)`
      : '';
    summary.push(`■ ${label}`, ...sets.map((s) => '  ' + report(s, results.filter((r) => r.c.set === s))), ...(speed ? ['  ' + speed] : []));
  }

  console.log('\n━━━━━━━━ 요약 ━━━━━━━━');
  summary.forEach((s) => console.log(s));
}

main();
