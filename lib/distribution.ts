import type { DistributionItem, ProfQuestion } from './types';

// server-only를 붙이지 않는다: 순수 함수라 API route·테스트·화면 어디서나 쓸 수 있게

/** 같은 답 판정용: 공백 제거 + 소문자 ("2 개" = "2개", "Yes" = "yes") */
export const normalizeAnswer = (s: string): string => s.replace(/\s+/g, '').toLowerCase();

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 교수 질문 응답 분포 (SPEC FR-B7, PROMPTS.md P3 "분포는 코드로 먼저 계산").
 * - choice: 선택지 순서 그대로(0명도 포함), 선택지에 없는 답은 뒤에 많은 순으로
 * - short/open: 많은 순 (같으면 먼저 나온 답 먼저)
 * - label은 선택지 원문, 선택지에 없으면 처음 나온 응답 원문
 * - 빈 응답은 세지 않는다. ratio는 소수 2자리
 */
export function computeDistribution(
  q: Pick<ProfQuestion, 'type' | 'options'>,
  answers: { answer: string }[],
): DistributionItem[] {
  const options = q.type === 'choice' ? q.options ?? [] : [];
  const buckets = new Map<string, { label: string; count: number; fixed: boolean; order: number }>();

  options.forEach((label, i) => {
    const key = normalizeAnswer(label);
    if (key && !buckets.has(key)) buckets.set(key, { label, count: 0, fixed: true, order: i });
  });

  let total = 0;
  for (const { answer } of answers) {
    const text = typeof answer === 'string' ? answer.trim() : '';
    const key = normalizeAnswer(text);
    if (!key) continue;
    total++;
    const b = buckets.get(key);
    if (b) b.count++;
    else buckets.set(key, { label: text, count: 1, fixed: false, order: buckets.size });
  }

  const all = [...buckets.values()];
  const fixed = all.filter((b) => b.fixed).sort((a, b) => a.order - b.order);
  const extra = all.filter((b) => !b.fixed).sort((a, b) => b.count - a.count || a.order - b.order);

  return [...fixed, ...extra].map(({ label, count }) => ({
    label,
    count,
    ratio: total ? round2(count / total) : 0,
  }));
}

/** 분포의 응답 수 합계 (ProfQSummary.total) */
export const totalOf = (d: DistributionItem[]): number => d.reduce((s, x) => s + x.count, 0);
