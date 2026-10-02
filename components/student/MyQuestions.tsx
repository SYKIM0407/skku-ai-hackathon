'use client';
import { useLive } from '@/lib/live';
import { sb } from '@/lib/supabase/client';
import type { MyQuestion } from '@/lib/types';

/** 내 질문 목록 + "n명이 같은 질문을 했습니다" (SPEC §9.2, FR-A8). 질문 원문은 localStorage에만 있다 */
export function MyQuestions({ roomId, items }: { roomId: string; items: MyQuestion[] }) {
  const ids = [...new Set(items.map((q) => q.clusterId))];
  const { data: counts } = useLive<Record<number, number>>(
    async () => {
      if (!ids.length) return {};
      const { data } = await sb().from('clusters').select('id, count').in('id', ids);
      return Object.fromEntries((data ?? []).map((c) => [Number(c.id), Number(c.count)]));
    },
    'clusters',
    `room_id=eq.${roomId}`,
    [roomId, ids.join(',')],
  );

  if (!items.length) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        이해가 안 되는 순간 아래에 바로 적어 보세요.
        <br />
        &ldquo;방금 그거 뭐예요?&rdquo;처럼 짧아도 괜찮아요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {[...items].reverse().map((q) => {
        const n = counts?.[q.clusterId];
        return (
          <li key={q.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-gray-900">{q.refined}</p>
            <p className="mt-2 text-sm font-medium text-indigo-600">
              {n === undefined ? '전달됨' : n > 1 ? `🙋 ${n}명이 같은 질문을 했습니다` : '🙋 교수님께 전달되었습니다'}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
