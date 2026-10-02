/**
 * T-38 백업 수업방: 시연 중 실시간 흐름이 막혀도 보여 줄 수 있게 결과가 채워진 수업방을 만든다.
 *
 *   npx tsx --conditions=react-server scripts/seed-demo-room.ts            # 방 코드 DEMO
 *   npx tsx --conditions=react-server scripts/seed-demo-room.ts --room BKUP
 *
 * 같은 코드의 방이 있으면 지우고 새로 만든다 (하위 데이터는 cascade로 함께 삭제).
 * 채우는 것: 질문 묶음 4개(+ 묶음 인원만큼의 전송된 질문), 마감된 교수 질문 1개(응답 13개 + 분석 결과).
 * 강의 인식 문장은 넣지 않는다 (화면에 표시하지 않고, 필요하면 가짜 강의 모드로 쌓는다). AI는 호출하지 않는다.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { computeDistribution, totalOf } from '../lib/distribution';
import type { ProfQSummary } from '../lib/types';

const root = path.resolve(__dirname, '..');
if (existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'));

const roomArg = (() => {
  const i = process.argv.indexOf('--room');
  return (i > 0 ? process.argv[i + 1] : 'DEMO').toUpperCase();
})();

const TITLE = '선형대수 6주차: 고윳값과 고유벡터';
const GLOSSARY = ['고윳값', '고유벡터', '람다', 'λ', '행렬식', '특성방정식', '선형변환', '대각화', '대각행렬', '역행렬'];

/** 묶음 대표 질문과 인원 (P1이 다듬었을 법한 문장) */
const CLUSTERS: { title: string; count: number; read_aloud?: boolean }[] = [
  { title: 'A에서 람다 I를 빼고 행렬식을 0으로 놓는 이유를 다시 설명해 주실 수 있나요?', count: 12, read_aloud: true },
  { title: '고유벡터의 길이는 아무거나 골라도 되는 이유가 무엇인가요?', count: 5 },
  { title: '고유벡터들을 열로 세워 만든 행렬 P가 대각화에 어떻게 쓰이는지 다시 설명해 주실 수 있나요?', count: 4 },
  { title: '고윳값과 고유벡터 내용이 시험 범위에 포함되나요?', count: 2 },
];

const PROF_Q = {
  spoken: '자 그럼 이 행렬은 고윳값이 몇 개일까요',
  question: '방금 예제의 2×2 행렬은 고윳값이 몇 개일까요?',
  type: 'choice' as const,
  options: ['1개', '2개', '3개', '모르겠어요'],
  expected_answer: '2개',
  answers: ['2개', '2개', '2개', '2개', '2개', '2개', '2개', '2개', '2개', '3개', '3개', '1개', '모르겠어요'],
};

async function main() {
  const { sbAdmin } = await import('../lib/supabase/server');
  const db = sbAdmin();
  const must = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  };

  must(await db.from('rooms').delete().eq('id', roomArg), '기존 방 삭제');
  must(await db.from('rooms').insert({ id: roomArg, title: TITLE, glossary: GLOSSARY, status: 'live' }), '방 생성');

  for (const [ci, c] of CLUSTERS.entries()) {
    const [cl] = must(
      await db.from('clusters').insert({ room_id: roomArg, title: c.title, count: c.count, read_aloud: !!c.read_aloud }).select('id'),
      '묶음 생성',
    ) as { id: number }[];
    const rows = Array.from({ length: c.count }, (_, i) => ({
      room_id: roomArg,
      anon_id: `demo-${ci}-${i}`,
      raw: i === 0 ? '방금 그거 왜 0임' : '?',
      refined: c.title,
      status: 'sent',
      cluster_id: cl.id,
      confidence: 0.9,
    }));
    must(await db.from('questions').insert(rows), '질문 생성');
  }

  // 마감된 교수 질문: 분포는 실제 코드(computeDistribution)로, 분석 문장은 미리 써 둔 것
  const distribution = computeDistribution(PROF_Q, PROF_Q.answers.map((answer) => ({ answer })));
  const ratioOf = (label: string) => distribution.find((d) => d.label === label)?.ratio ?? 0;
  const expected = distribution.find((d) => d.label === PROF_Q.expected_answer)!;
  const summary: ProfQSummary = {
    total: totalOf(distribution),
    distribution,
    misconceptions: [
      { text: '행렬의 크기(2×2)와 상관없이 고윳값이 3개 나올 수 있다고 생각함', ratio: ratioOf('3개'), line_ids: [] },
      { text: '중근이 아닌데도 고윳값이 하나뿐이라고 생각함', ratio: ratioOf('1개'), line_ids: [] },
    ],
    suggestion: 'n×n 행렬의 특성방정식은 n차식이라 고윳값이 최대 n개라는 점을 다시 짚어 주세요',
    spoken_summary: `정답(2개)을 고른 학생은 ${Math.round(expected.ratio * 100)}%입니다. 일부 학생은 고윳값 개수와 특성방정식의 차수의 관계를 헷갈렸습니다.`,
  };
  const [pq] = must(
    await db
      .from('prof_questions')
      .insert({
        room_id: roomArg,
        spoken: PROF_Q.spoken,
        question: PROF_Q.question,
        type: PROF_Q.type,
        options: PROF_Q.options,
        expected_answer: PROF_Q.expected_answer,
        status: 'closed',
        closes_at: new Date().toISOString(),
        summary,
      })
      .select('id'),
    '교수 질문 생성',
  ) as { id: number }[];
  must(
    await db.from('answers').insert(PROF_Q.answers.map((answer, i) => ({ prof_question_id: pq.id, anon_id: `demo-a-${i}`, answer }))),
    '응답 생성',
  );

  console.log(`✅ 백업 수업방 ${roomArg} 준비 완료`);
  console.log(`   질문 묶음 ${CLUSTERS.length}개 (${CLUSTERS.reduce((s, c) => s + c.count, 0)}명), 마감된 교수 질문 1개 (응답 ${summary.total}개)`);
  console.log(`   교수 화면: /prof/${roomArg}   학생 화면: /s/${roomArg}`);
}

main().catch((e) => {
  console.error('❌', (e as Error).message);
  process.exit(1);
});
