/**
 * 교수 질문 감지 "전체 흐름" 평가: 강의 대본을 시간 순서대로 흘려 보내며
 * 교수 화면과 같은 감지 로직(components/prof/detectPlanner.ts) → P2 판단까지 실행하고,
 * 진짜 질문을 몇 개 잡았는지, 헛알림이 몇 번 떴는지 센다.
 *
 *   npx tsx --conditions=react-server scripts/eval-detect.ts            # 어미 규칙만(이전) vs AI 경로(현재) 비교
 *   npx tsx --conditions=react-server scripts/eval-detect.ts --runs 3 --verbose
 *
 * .env.local의 AI 키가 필요하다 (감지 요청 1건당 AI 1회).
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { TranscriptLine } from '../lib/types';

const root = path.resolve(__dirname, '..');
if (existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'));

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const runs = Number(arg('runs') ?? 1);
const verbose = process.argv.includes('--verbose');

type Line = { delay: number; text: string };
type Lecture = { name: string; file?: string; lines?: Line[]; expect: string[]; traps: string[] };

const data = JSON.parse(readFileSync(path.join(root, 'scripts/eval-detect-lectures.json'), 'utf8')) as { lectures: Lecture[] };
const lectures = data.lectures.map((l) => ({
  ...l,
  lines: l.lines ?? (JSON.parse(readFileSync(path.join(root, l.file!), 'utf8')) as Line[]),
}));

type Alert = { spoken: string; after: string; question: string };

async function main() {
  const { CONFIG } = await import('../lib/config');
  const { judgeProfQuestion } = await import('../lib/prompts');
  const { createDetectPlanner } = await import('../components/prof/detectPlanner');
  const modes = [
    { name: '이전 (어미 규칙만)', scanLines: Infinity },
    { name: `현재 (AI 경로, ${CONFIG.PROFQ_SCAN_LINES}문장 묶음 + 침묵)`, scanLines: CONFIG.PROFQ_SCAN_LINES },
  ];

  for (const mode of modes) {
    let hit = 0, total = 0, falseAlerts = 0, trapAlerts = 0, calls = 0;
    console.log(`\n━━━━━━━━ ${mode.name} ━━━━━━━━`);
    for (const lec of lectures) {
      for (let r = 0; r < runs; r++) {
        const planner = createDetectPlanner({ scanLines: mode.scanLines, waitMs: CONFIG.PROFQ_WAIT_MS, silenceMs: CONFIG.PROFQ_SILENCE_MS });
        const said: { id: number; text: string; at: number }[] = [];
        const alerts: Alert[] = [];
        // 0.5초 단위로 시간을 흘린다. 마지막 문장 뒤 20초까지
        let t = 0;
        const times = lec.lines.reduce<number[]>((acc, l, i) => [...acc, (acc[i - 1] ?? 0) + l.delay * 1000], []);
        const end = times.at(-1)! + 20000;
        let next = 0;
        for (; t <= end; t += 500) {
          while (next < lec.lines.length && times[next] <= t) {
            said.push({ id: next + 1, text: lec.lines[next].text, at: times[next] });
            planner.push(lec.lines[next].text, t);
            next++;
          }
          for (const req of planner.tick(t)) {
            calls++;
            const ctx: TranscriptLine[] = said
              .filter((s) => t - s.at <= CONFIG.PROFQ_CONTEXT_SEC * 1000)
              .map((s) => ({ id: s.id, text: s.text, ago_sec: Math.round((t - s.at) / 1000) }));
            const out = await judgeProfQuestion({ lines: ctx, spoken: req.spoken, after: req.after });
            planner.result(!!out?.is_real_question, t);
            if (out?.is_real_question) alerts.push({ ...req, question: out.question });
            if (verbose) console.log(`   ${out?.is_real_question ? '🔔' : '  '} "${req.spoken}"${req.after ? ` | 이후: "${req.after}"` : ''}${out?.is_real_question ? ` → ${out.question}` : ''}`);
          }
        }
        // 채점: expect 문구가 알림 발화 구간에 들어 있으면 적중 (같은 질문 여러 알림은 1개만 적중, 나머지는 헛알림)
        const used = new Set<number>();
        for (const e of lec.expect) {
          total++;
          const i = alerts.findIndex((a, k) => !used.has(k) && a.spoken.includes(e));
          if (i >= 0) { hit++; used.add(i); }
          else if (r === 0) console.log(`  ❌ 놓침 [${lec.name}] ${e}`);
        }
        alerts.forEach((a, k) => {
          if (used.has(k)) return;
          falseAlerts++;
          const trap = lec.traps.find((x) => a.spoken.includes(x));
          if (trap) trapAlerts++;
          console.log(`  ⚠️ 헛알림 [${lec.name}] "${a.spoken}" → ${a.question}`);
        });
      }
    }
    const lectureRuns = lectures.length * runs;
    console.log(`  ▶ 진짜 질문 감지 ${hit}/${total} (${Math.round((hit / total) * 100)}%), 헛알림 ${falseAlerts}회 (함정 문장 ${trapAlerts}), 강의당 헛알림 ${(falseAlerts / lectureRuns).toFixed(1)}회, 강의당 AI 호출 ${(calls / lectureRuns).toFixed(1)}회`);
  }
}

main();
