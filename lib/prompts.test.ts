import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./supabase/server', () => ({ sbAdmin: () => { throw new Error('DB 없음'); } }));

const { validateP1, validateP2, validateP3, fallbackSummary, p3User } = await import('./prompts');
const { parseJSONObject } = await import('./llm');

const lines = [
  { id: 41, text: '고유벡터는 방향이 바뀌지 않아요', ago_sec: 150 },
  { id: 43, text: '행렬식을 0으로 놓습니다', ago_sec: 60 },
];

describe('validateP1', () => {
  const input = { raw: '방금 그거 왜 0임', lines, glossary: [] };

  it('없는 문장 번호 제거, confidence 자르기, candidates 최대 3개', () => {
    const r = validateP1({ category: '관련', ref_line_ids: [43, 99, 'L41', 43], refined: ' 왜 0인가요? ', confidence: 1.7, candidates: ['a', 1, 'b', 'c', 'd'] }, input);
    expect(r).toEqual({ category: '관련', ref_line_ids: [43, 41], refined: '왜 0인가요?', confidence: 1, candidates: ['a', 'b', 'c'] });
  });

  it('category가 이상하면 관련, refined가 비면 원문', () => {
    const r = validateP1({ category: '???', refined: '', confidence: -2 }, input);
    expect(r.category).toBe('관련');
    expect(r.refined).toBe(input.raw);
    expect(r.confidence).toBe(0);
  });

  it('무관·부적절이면 나머지를 비운다', () => {
    const r = validateP1({ category: '무관', ref_line_ids: [43], refined: 'x', candidates: ['y'], confidence: 0.9 }, input);
    expect(r).toMatchObject({ category: '무관', ref_line_ids: [], refined: '', candidates: [] });
  });
});

describe('validateP2', () => {
  const input = { lines, spoken: '고윳값이 몇 개일까요', after: '' };

  it('choice 마지막 선택지 "모르겠어요" 보정 (중간에 있으면 맨 뒤로)', () => {
    const r = validateP2({ is_real_question: true, question: 'q', type: 'choice', options: ['1개', '모르겠어요', '2개'], expected_answer: '2개', context_line_ids: [43, 7] }, input);
    expect(r.options).toEqual(['1개', '2개', '모르겠어요']);
    expect(r.context_line_ids).toEqual([43]);
  });

  it('선택지가 모자라면 short, 이상한 type은 open, 비선택형은 options null', () => {
    expect(validateP2({ is_real_question: true, type: 'choice', options: ['1개'] }, input).type).toBe('short');
    const r = validateP2({ is_real_question: true, type: 'quiz', options: ['a', 'b'], question: '', expected_answer: 'null' }, input);
    expect(r).toMatchObject({ type: 'open', options: null, question: input.spoken, expected_answer: null });
  });

  it('is_real_question은 true일 때만 true', () => {
    expect(validateP2({ is_real_question: 'yes' }, input).is_real_question).toBe(false);
  });
});

describe('parseJSONObject', () => {
  it('코드 블록·앞뒤 설명이 있어도 파싱, 깨지면 null', () => {
    expect(parseJSONObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJSONObject('결과: {"a": [1,2]} 끝')).toEqual({ a: [1, 2] });
    expect(parseJSONObject('{"a":')).toBeNull();
    expect(parseJSONObject('[1,2]')).toBeNull();
  });
});

describe('P3', () => {
  const distribution = [
    { label: '1개', count: 1, ratio: 0.1 },
    { label: '2개', count: 7, ratio: 0.7 },
    { label: '3개', count: 2, ratio: 0.2 },
  ];
  const input = { question: '고윳값은 몇 개일까요?', expected_answer: '2개', context_lines: lines, distribution, answers: ['2개', '3개'] };

  it('validateP3: 오해 최대 2개, 비율은 응답 항목으로 코드 계산, 없는 번호 제거, 빈 suggestion은 null', () => {
    const r = validateP3({
      misconceptions: [
        { text: '크기와 개수 혼동', answers: ['3 개'], ratio: 0.9, line_ids: [43, 99] },
        { text: '', answers: ['1개'] },
        { text: '항목 없으면 AI 비율(퍼센트 보정)', ratio: 15 },
        { text: 'c', answers: ['1개'] },
      ],
      suggestion: 'null',
      spoken_summary: '많은 학생이 잘 이해했습니다. 69%가 2개라고 답했습니다.',
    }, input);
    expect(r.misconceptions).toEqual([
      { text: '크기와 개수 혼동', ratio: 0.2, line_ids: [43] },
      { text: '항목 없으면 AI 비율(퍼센트 보정)', ratio: 0.15, line_ids: [] },
    ]);
    expect(r.suggestion).toBeNull();
    // 비율 문장은 코드가 만들고, AI 문장 중 숫자가 든 것은 버린다
    expect(r.spoken_summary).toBe('정답(2개)을 고른 학생은 70%입니다. 많은 학생이 잘 이해했습니다.');
  });

  it('spoken_summary가 비면 코드 문장만, 정답이 없으면 가장 많은 답', () => {
    expect(validateP3({ misconceptions: 'x' }, input)).toEqual({
      misconceptions: [], suggestion: null, spoken_summary: '정답(2개)을 고른 학생은 70%입니다',
    });
    expect(validateP3({}, { ...input, expected_answer: null }).spoken_summary).toBe('가장 많이 고른 답은 2개, 70%입니다');
  });

  it('fallbackSummary: 정답 비율 / 가장 많은 답 / 응답 없음', () => {
    expect(fallbackSummary(distribution, '2개').spoken_summary).toBe('정답(2개)을 고른 학생은 70%입니다');
    expect(fallbackSummary(distribution).spoken_summary).toBe('가장 많이 고른 답은 2개, 70%입니다');
    expect(fallbackSummary([{ label: '1개', count: 0, ratio: 0 }]).spoken_summary).toBe('아직 응답이 없습니다');
    expect(fallbackSummary([])).toEqual({ misconceptions: [], suggestion: null, spoken_summary: '아직 응답이 없습니다' });
  });

  it('프롬프트에 예시 문장이 없다 (모델이 베끼지 않게)', () => {
    const u = p3User(input);
    expect(u).not.toContain('69%');
    expect(u).not.toContain('행렬 크기(3×3)');
  });

  it('p3User: 분포·강의 문장이 프롬프트에 들어간다', () => {
    const u = p3User(input);
    expect(u).toContain('[답변 분포] 1개 1명(10%), 2개 7명(70%), 3개 2명(20%)');
    expect(u).toContain('[L43] (-60초) 행렬식을 0으로 놓습니다');
    expect(u).toContain('[학생 응답 2개]');
  });
});
