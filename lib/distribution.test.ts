import { describe, it, expect } from 'vitest';
import { computeDistribution, normalizeAnswer, totalOf } from './distribution';

const choice = { type: 'choice' as const, options: ['1개', '2개', '3개', '모르겠어요'] };
const ans = (...xs: string[]) => xs.map((answer) => ({ answer }));

describe('computeDistribution', () => {
  it('choice: 선택지 순서 유지, 0명도 포함, ratio 소수 2자리', () => {
    const d = computeDistribution(choice, ans('2개', '2개', '3개'));
    expect(d).toEqual([
      { label: '1개', count: 0, ratio: 0 },
      { label: '2개', count: 2, ratio: 0.67 },
      { label: '3개', count: 1, ratio: 0.33 },
      { label: '모르겠어요', count: 0, ratio: 0 },
    ]);
  });

  it('공백·대소문자 정규화 후 같은 답으로 센다 (label은 선택지 원문)', () => {
    const d = computeDistribution(choice, ans(' 2 개', '2개 ', '모르 겠어요'));
    expect(d.find((x) => x.label === '2개')?.count).toBe(2);
    expect(d.find((x) => x.label === '모르겠어요')?.count).toBe(1);
    expect(normalizeAnswer(' Eigen Value ')).toBe('eigenvalue');
  });

  it('choice인데 선택지에 없는 답은 뒤에 붙인다', () => {
    const d = computeDistribution(choice, ans('4개', '2개', '4개'));
    expect(d.map((x) => x.label)).toEqual(['1개', '2개', '3개', '모르겠어요', '4개']);
    expect(d.at(-1)).toEqual({ label: '4개', count: 2, ratio: 0.67 });
  });

  it('short/open: 많은 순, 같으면 먼저 나온 답, label은 처음 나온 원문', () => {
    const d = computeDistribution({ type: 'short', options: null }, ans('Two', 'two', '3', 'TWO', '5', '3 '));
    expect(d).toEqual([
      { label: 'Two', count: 3, ratio: 0.5 },
      { label: '3', count: 2, ratio: 0.33 },
      { label: '5', count: 1, ratio: 0.17 },
    ]);
  });

  it('빈 응답은 세지 않고, 응답이 없으면 ratio 0', () => {
    expect(computeDistribution({ type: 'open', options: null }, ans('', '   '))).toEqual([]);
    const d = computeDistribution(choice, []);
    expect(d.every((x) => x.count === 0 && x.ratio === 0)).toBe(true);
    expect(totalOf(computeDistribution(choice, ans('1개', '', '2개')))).toBe(2);
  });
});
