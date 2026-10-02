'use client';
import { useState } from 'react';
import { useRemaining } from '@/components/ui/useRemaining';
import { postJSON, store } from '@/lib/api-client';
import { useLive } from '@/lib/live';
import { sb } from '@/lib/supabase/client';
import type { OkRes, ProfQuestion } from '@/lib/types';

const ANSWERED_KEY = 'gyaut:answered';

type OpenQ = Pick<ProfQuestion, 'id' | 'question' | 'type' | 'options' | 'closes_at'>;

/** 교수 질문 카드 (SPEC §9.2, FR-B5·B6): open 질문이 있을 때만 최상단에 표시, 1인 1회 익명 응답 */
export function ProfQuestionCard({ roomId, anonId }: { roomId: string; anonId: string }) {
  const { data: q } = useLive<OpenQ | null>(
    async () => {
      const { data } = await sb()
        .from('prof_questions')
        .select('id, question, type, options, closes_at')
        .eq('room_id', roomId)
        .eq('status', 'open')
        .order('id', { ascending: false })
        .limit(1);
      return (data?.[0] as OpenQ) ?? null;
    },
    'prof_questions',
    `room_id=eq.${roomId}`,
    [roomId],
  );
  if (!q) return null;
  return <Card key={q.id} q={q} anonId={anonId} />;
}

function Card({ q, anonId }: { q: OpenQ; anonId: string }) {
  const [answered, setAnswered] = useState(() => store.get<number[]>(ANSWERED_KEY, []).includes(q.id));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const remaining = useRemaining(q.closes_at);
  // 처음 본 시점의 남은 시간을 막대 기준으로
  const [duration] = useState(() => (q.closes_at ? Math.max(1, new Date(q.closes_at).getTime() - Date.now()) : 1));
  const closed = remaining === 0;

  function markAnswered() {
    store.set(ANSWERED_KEY, [...store.get<number[]>(ANSWERED_KEY, []), q.id].slice(-100));
    setAnswered(true);
  }

  async function submit(answer: string) {
    if (busy || answered || closed || !answer.trim()) return;
    setBusy(true);
    const res = await postJSON<OkRes>('/api/answer', { profQuestionId: q.id, anonId, answer: answer.trim() });
    setBusy(false);
    if (res.ok || res.code === 'ALREADY_ANSWERED') markAnswered();
    else if (res.code === 'CLOSED') setNotice('마감된 질문입니다');
    else setNotice(res.message);
  }

  const pct = remaining === null ? 100 : Math.min(100, (remaining / duration) * 100);

  return (
    <section className="rounded-2xl border-2 border-[#0b5cff] bg-[#0c1a3d] p-6 shadow-[0_0_40px_-10px_rgba(11,92,255,0.5)]">
      <div className="mb-3 flex items-center justify-between text-sm font-semibold text-[#5b9bff]">
        <span>📢 교수님 질문</span>
        {remaining !== null && <span>{closed ? '마감' : `${Math.ceil(remaining / 1000)}초 남음`}</span>}
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-[#16295a]">
        <div className="h-full bg-[#0b5cff] transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mb-5 text-xl font-semibold text-white">{q.question}</p>

      {answered ? (
        <p className="rounded-xl bg-[#11214a] py-3 text-center font-semibold text-[#5b9bff]">✅ 제출 완료 · 익명으로 전달됩니다</p>
      ) : closed ? (
        <p className="rounded-xl bg-[#11214a] py-3 text-center text-slate-400">마감된 질문입니다</p>
      ) : q.type === 'choice' && q.options ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => (
            <button
              key={o}
              disabled={busy}
              onClick={() => submit(o)}
              className="rounded-xl border border-[#24407e] bg-[#08122a] px-4 py-3 text-left font-medium text-slate-100 hover:border-[#3b82f6] hover:bg-[#11214a] disabled:opacity-50"
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
          className="flex gap-2"
        >
          {q.type === 'open' ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="생각을 자유롭게 적어 주세요"
              className="flex-1 rounded-xl border border-[#24407e] bg-[#08122a] px-4 py-3 text-white placeholder:text-slate-500 focus:border-[#3b82f6] focus:outline-none"
            />
          ) : (
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={100}
              placeholder="짧게 답해 주세요"
              className="flex-1 rounded-xl border border-[#24407e] bg-[#08122a] px-4 py-3 text-white placeholder:text-slate-500 focus:border-[#3b82f6] focus:outline-none"
            />
          )}
          <button
            disabled={busy || !text.trim()}
            className="rounded-xl bg-[#0b5cff] px-6 font-semibold text-white hover:bg-[#2a72ff] disabled:opacity-40"
          >
            제출
          </button>
        </form>
      )}
      {notice && <p className="mt-2 text-sm text-red-400">{notice}</p>}
    </section>
  );
}
