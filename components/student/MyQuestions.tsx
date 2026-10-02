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
      <p className="py-16 text-center text-slate-400">
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
          <li key={q.id} className="rounded-2xl border border-l-4 border-[#1d3266] border-l-[#0b5cff] bg-[#0c1730]/90 px-7 py-6">
            <p className="text-xl leading-relaxed font-medium text-slate-100">{q.refined}</p>
            <p className="mt-4 inline-flex items-center gap-2.5 rounded-xl bg-[#11214a] px-4 py-2 font-semibold text-[#4c8dff]">
              <CheckCircle />
              {n !== undefined && n > 1 ? `${n}명이 같은 질문을 했습니다` : '교수님께 전달되었습니다'}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function CheckCircle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}
