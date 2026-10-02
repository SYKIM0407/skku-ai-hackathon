'use client';
import { useState } from 'react';
import { postJSON } from '@/lib/api-client';
import { useLive } from '@/lib/live';
import { sb } from '@/lib/supabase/client';
import type { ClusterJoinRes, MyQuestion } from '@/lib/types';

type Row = { id: number; title: string; count: number };

/**
 * 다른 학생들의 질문 (묶음 대표 질문·인원) + [나도 모르겠어요] (SPEC §9.2, FR-A10).
 * clusters의 id·title·count만 읽는다. 강의 문장·원문은 받지 않는다 (규칙 9)
 */
export function RoomQuestions({
  roomId,
  anonId,
  mine,
  onJoined,
  disabled,
}: {
  roomId: string;
  anonId: string;
  mine: MyQuestion[];
  onJoined: (q: MyQuestion) => void;
  disabled: boolean;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const joined = new Set(mine.map((q) => q.clusterId));

  const { data: rows } = useLive<Row[]>(
    async () => {
      const { data } = await sb()
        .from('clusters')
        .select('id, title, count')
        .eq('room_id', roomId)
        .order('count', { ascending: false })
        .order('id', { ascending: false });
      return (data ?? []).map((c) => ({ id: Number(c.id), title: c.title, count: Number(c.count) }));
    },
    'clusters',
    `room_id=eq.${roomId}`,
    [roomId],
  );

  async function join(c: Row) {
    if (busyId || joined.has(c.id)) return;
    setBusyId(c.id);
    setNotice('');
    const res = await postJSON<ClusterJoinRes>('/api/cluster/join', { clusterId: c.id, anonId });
    setBusyId(null);
    if (!res.ok) return setNotice(res.message);
    onJoined({ id: res.data.questionId, refined: c.title, clusterId: res.data.clusterId });
  }

  if (!rows) return null;
  if (!rows.length) return <p className="rounded-2xl border border-dashed border-[#24407e] py-8 text-center text-slate-400">아직 올라온 질문이 없어요</p>;

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {rows.map((c) => {
          const mineToo = joined.has(c.id);
          return (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-[#1d3266] bg-[#0c1730]/80 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-slate-100">{c.title}</p>
                <p className="mt-0.5 text-sm text-slate-400">{c.count}명이 궁금해해요</p>
              </div>
              {mineToo ? (
                <span className="shrink-0 rounded-lg bg-[#13254d] px-3 py-2 text-sm font-medium text-[#5b9bff]">나도 질문함 ✓</span>
              ) : (
                <button
                  disabled={disabled || busyId === c.id}
                  onClick={() => join(c)}
                  className="shrink-0 rounded-lg border border-[#2563eb] bg-[#0b2a6b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#10378a] disabled:opacity-40"
                >
                  {busyId === c.id ? '…' : '나도 모르겠어요'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {notice && <p className="mt-2 text-sm text-red-400">{notice}</p>}
    </div>
  );
}
