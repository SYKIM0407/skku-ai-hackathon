import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./supabase/server', () => ({ sbAdmin: () => { throw new Error('DB 없음'); } }));

const { validateP1, validateP2 } = await import('./prompts');
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
