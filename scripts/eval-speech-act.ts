/**
 * 교수 발화 의도(Speech Act) 분류 정확도: scripts/eval-data.json의 E2 문장 40개를 P2로 분류해
 * 실제 질문 → response_request·understanding_check, 수사적 → rhetorical, 일반 → explanation·class_management 이면 정답
 *
 *   npx tsx --conditions=react-server scripts/eval-speech-act.ts --runs 3
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { SpeechAct, TranscriptLine } from '../lib/types';

const root = path.resolve(__dirname, '..');
if (existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'));
const i = process.argv.indexOf('--runs');
const runs = i > 0 ? Number(process.argv[i + 1]) : 1;

const EXPECT: Record<string, SpeechAct[]> = {
  실제: ['response_request', 'understanding_check'],
  수사적: ['rhetorical'],
  일반: ['explanation', 'class_management'],
};

async function main() {
  const { judgeProfQuestion } = await import('../lib/prompts');
  const { SPEECH_ACT_LABEL } = await import('../lib/speechAct');
  const script = JSON.parse(readFileSync(path.join(root, 'scripts/demo-lecture.json'), 'utf8')) as { delay: number; text: string }[];
  const cases = JSON.parse(readFileSync(path.join(root, 'scripts/eval-data.json'), 'utf8')).e2.cases as { kind: string; spoken: string; after: string; upto: number }[];
  const lines = (upto: number): TranscriptLine[] => script.slice(0, upto).map((s, k) => ({ id: k + 1, text: s.text, ago_sec: (upto - k) * 7 }));
  const byKind: Record<string, { ok: number; n: number }> = {};
  const confusion: Record<string, number> = {};
  for (const c of cases) {
    for (let r = 0; r < runs; r++) {
      const out = await judgeProfQuestion({ lines: lines(c.upto), spoken: c.spoken, after: c.after });
      const act = out?.speech_act ?? '실패';
      const ok = !!out && EXPECT[c.kind].includes(out.speech_act);
      (byKind[c.kind] ??= { ok: 0, n: 0 }).n++;
      if (ok) byKind[c.kind].ok++;
      else console.log(`  ❌ [${c.kind}] "${c.spoken}" → ${act in SPEECH_ACT_LABEL ? SPEECH_ACT_LABEL[act as SpeechAct] : act}`);
      const key = `${c.kind} → ${act in SPEECH_ACT_LABEL ? SPEECH_ACT_LABEL[act as SpeechAct] : act}`;
      confusion[key] = (confusion[key] ?? 0) + 1;
    }
  }
  const total = Object.values(byKind).reduce((a, b) => ({ ok: a.ok + b.ok, n: a.n + b.n }), { ok: 0, n: 0 });
  console.log(`\nSpeech Act 분류 정확도 ${Math.round((total.ok / total.n) * 100)}% (${total.ok}/${total.n})`);
  for (const [k, v] of Object.entries(byKind)) console.log(`  ${k}: ${v.ok}/${v.n}`);
  console.log('분류 분포:', Object.entries(confusion).map(([k, v]) => `${k} ${v}`).join(' | '));
}
main();
