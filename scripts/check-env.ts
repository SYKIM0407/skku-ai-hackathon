/**
 * T-38 시연 환경 점검: 환경 변수 · Supabase 스키마/RLS · AI 호출 · (선택) 배포 URL
 *
 *   npx tsx --conditions=react-server scripts/check-env.ts
 *   npx tsx --conditions=react-server scripts/check-env.ts --url https://갸웃.vercel.app
 *
 * .env.local을 읽는다. Vercel 환경 변수를 점검하려면 `vercel env pull .env.local` 후 실행.
 * AI를 1번 호출한다 (gpt-4o-mini 기준 1원 미만). 데이터는 쓰지 않는다.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(__dirname, '..');
if (existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'));
const env = process.env;
const urlArg = (() => {
  const i = process.argv.indexOf('--url');
  return i > 0 ? process.argv[i + 1] : undefined;
})();

let failed = 0;
const pass = (msg: string) => console.log(`✅ ${msg}`);
const bad = (msg: string, hint?: string) => {
  failed++;
  console.log(`❌ ${msg}${hint ? `\n   → ${hint}` : ''}`);
};

async function main() {
  console.log('━━━━ 1. 환경 변수 ━━━━');
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'LLM_PROVIDER'];
  for (const k of required) (env[k] ? pass : bad)(`${k} ${env[k] ? '있음' : '없음'}`);
  const provider = env.LLM_PROVIDER === 'anthropic' ? 'anthropic' : 'openai';
  const keyName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  if (env[keyName]) pass(`${keyName} 있음 (LLM_PROVIDER=${env.LLM_PROVIDER ?? '(없음→openai)'}, LLM_MODEL=${env.LLM_MODEL ?? '(기본값)'})`);
  else bad(`${keyName} 없음`, `LLM_PROVIDER=${provider}이면 ${keyName}가 필요합니다`);
  const leaked = Object.keys(env).filter((k) => k.startsWith('NEXT_PUBLIC_') && /SERVICE|SECRET|OPENAI|ANTHROPIC/i.test(k));
  if (leaked.length) bad(`비밀 키가 NEXT_PUBLIC_으로 노출됨: ${leaked.join(', ')}`, '브라우저에 그대로 보입니다. NEXT_PUBLIC_을 빼 주세요');
  else pass('비밀 키에 NEXT_PUBLIC_ 없음');

  console.log('\n━━━━ 2. Supabase ━━━━');
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

    for (const t of ['rooms', 'transcripts', 'clusters', 'questions', 'prof_questions', 'answers']) {
      const { error } = await admin.from(t).select('*', { head: true, count: 'exact' }).limit(1);
      if (error) bad(`테이블 ${t}: ${error.message}`, 'supabase/schema.sql을 SQL Editor에서 실행했는지 확인');
      else pass(`테이블 ${t}`);
    }
    const rpcs: [string, Record<string, unknown>][] = [
      ['recent_lines', { p_room: '__check__', p_sec: 10 }],
      ['prof_q_answerable', { p_id: 0 }],
    ];
    for (const [fn, args] of rpcs) {
      const { error } = await admin.rpc(fn, args);
      if (error) bad(`DB 함수 ${fn}: ${error.message}`, 'schema.sql의 함수 부분까지 실행했는지 확인');
      else pass(`DB 함수 ${fn}`);
    }
    // join_cluster는 쓰기 함수라 호출하지 않고 존재만 확인 (없는 질문 id로 부르면 묶음이 생기므로)

    // RLS: anon은 rooms는 읽고 transcripts는 못 읽어야 한다 (강의 원문 보호, 규칙 9)
    const { error: rErr } = await anon.from('rooms').select('id').limit(1);
    if (rErr) bad(`anon이 rooms를 못 읽음: ${rErr.message}`, 'RLS 정책 "read rooms" 확인');
    else pass('anon → rooms 읽기 가능');
    const { data: tData, error: tErr } = await anon.from('transcripts').select('id').limit(1);
    const { count: tCount } = await admin.from('transcripts').select('*', { head: true, count: 'exact' });
    if (tErr || !tData?.length) pass(`anon → transcripts 읽기 막힘${tCount ? '' : ' (현재 행 0개라 확인 약함)'}`);
    else bad('anon이 transcripts(강의 원문)를 읽을 수 있음', 'transcripts RLS를 켜 주세요');
    const { error: acErr } = await anon.from('answer_counts').select('*').limit(1);
    if (acErr) bad(`anon이 answer_counts를 못 읽음: ${acErr.message}`, 'grant select on answer_counts to anon');
    else pass('anon → answer_counts 읽기 가능');
  } else bad('Supabase 키가 없어 건너뜀');

  console.log('\n━━━━ 3. AI ━━━━');
  if (env[keyName]) {
    const { askJSON } = await import('../lib/llm');
    const t0 = Date.now();
    const r = await askJSON<{ ok: boolean }>('반드시 JSON만 출력한다.', '{"ok": true}를 그대로 출력하라.');
    const ms = Date.now() - t0;
    if (r?.ok === true) (ms < 3000 ? pass : bad)(`AI 호출 성공 ${ms}ms${ms < 3000 ? '' : ' (3초 초과, 모델·네트워크 확인)'}`);
    else bad('AI 호출 실패', 'API 키·크레딧 잔액·모델 이름(LLM_MODEL) 확인');
  } else bad('AI 키가 없어 건너뜀');

  if (urlArg) {
    console.log('\n━━━━ 4. 배포 ━━━━');
    const base = urlArg.replace(/\/$/, '');
    if (!base.startsWith('https://')) bad('배포 URL이 https가 아님', '마이크(Web Speech)와 익명 ID(crypto.randomUUID)는 HTTPS에서만 동작');
    try {
      const res = await fetch(base);
      (res.ok ? pass : bad)(`${base} → ${res.status}`);
      const api = await fetch(`${base}/api/transcript`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
      (api.status === 400 ? pass : bad)(`API 응답 확인 (빈 요청 → ${api.status}, 400이면 정상)`);
    } catch (e) {
      bad(`${base} 접속 실패: ${(e as Error).message}`);
    }
  }

  console.log(`\n${failed ? `❌ ${failed}개 문제` : '✅ 모두 통과'}`);
  process.exit(failed ? 1 : 0);
}

main();
