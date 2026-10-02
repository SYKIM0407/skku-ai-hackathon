'use client';
import type { Cluster } from '@/lib/types';

/** 질문 묶음 목록, 인원 내림차순 (FR-P1). 학생 원문은 없고 대표 질문만 보인다 */
export function ClusterList({ clusters }: { clusters: Cluster[] | undefined }) {
  if (!clusters) return <p className="py-10 text-center text-gray-400">불러오는 중…</p>;
  if (!clusters.length)
    return <p className="py-16 text-center text-lg text-gray-400">아직 들어온 질문이 없습니다</p>;

  return (
    <ul className="flex flex-col gap-3">
      {clusters.map((c) => (
        <li
          key={c.id}
          className={`flex items-center gap-4 rounded-xl border p-4 ${
            c.read_aloud ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-indigo-200 bg-white'
          }`}
        >
          <span
            className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-bold ${
              c.read_aloud ? 'bg-gray-200 text-gray-500' : 'bg-indigo-600 text-white'
            }`}
          >
            <span className="text-xl leading-none">{c.count}</span>
            <span className="text-[10px] font-medium">명</span>
          </span>
          <p className="flex-1 text-lg leading-snug">{c.title}</p>
          {c.read_aloud && <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs">읽음</span>}
        </li>
      ))}
    </ul>
  );
}
