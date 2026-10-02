'use client';
import { useState } from 'react';
import { postJSON } from '@/lib/api-client';
import type { Cluster, OkRes } from '@/lib/types';

/** 질문 묶음 목록 (FR-P1) + 확인 후 [삭제] (FR-P4). 정렬은 화면에서 정해 넘긴다. 학생 원문은 없고 대표 질문만 보인다 */
export function ClusterList({ clusters, onChange }: { clusters: Cluster[] | undefined; onChange?: () => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function remove(c: Cluster) {
    const who = c.count > 1 ? `${c.count}명이 물어본 질문` : '이 질문';
    if (!window.confirm(`${who}을 삭제할까요?\n"${c.title}"\n\n삭제하면 목록에서 사라지고 되돌릴 수 없습니다.`)) return;
    setBusyId(c.id);
    const res = await postJSON<OkRes>('/api/cluster/delete', { clusterId: c.id });
    setBusyId(null);
    if (!res.ok) window.alert(res.message);
    onChange?.();
  }

  if (!clusters) return <p className="py-10 text-center text-slate-500">불러오는 중…</p>;
  if (!clusters.length)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500" aria-hidden>
          <path d="M7 18H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-7l-4 3Z" />
          <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.5" />
        </svg>
        <p className="text-2xl font-bold">아직 들어온 질문이 없습니다</p>
        <p className="text-slate-400">학생들이 질문을 보내면 여기에 표시됩니다</p>
      </div>
    );

  return (
    <ul className="flex flex-col gap-3">
      {clusters.map((c) => (
        <li
          key={c.id}
          className={`flex items-center gap-4 rounded-xl border p-4 ${
            c.read_aloud ? 'border-[#1d3266] bg-[#0a1428] text-slate-500' : 'border-[#24407e] bg-[#08122a] text-slate-100'
          }`}
        >
          <span
            className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-bold ${
              c.read_aloud ? 'bg-[#13254d] text-slate-400' : 'bg-[#0b5cff] text-white'
            }`}
          >
            <span className="text-xl leading-none">{c.count}</span>
            <span className="text-[10px] font-medium">명</span>
          </span>
          <p className="flex-1 text-lg leading-snug">{c.title}</p>
          {c.read_aloud && <span className="shrink-0 rounded-full bg-[#13254d] px-2 py-0.5 text-xs text-slate-400">읽음</span>}
          <button
            disabled={busyId === c.id}
            onClick={() => remove(c)}
            aria-label="질문 삭제"
            title="삭제"
            className="shrink-0 rounded-lg px-2 py-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
