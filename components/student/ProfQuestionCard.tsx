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
    <section className="rounded-2xl border-2 border-indigo-500 bg-indigo-50 p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-indigo-700">
        <span>📢 교수님 질문</span>
        {remaining !== null && <span>{closed ? '마감' : `${Math.ceil(remaining / 1000)}초 남음`}</span>}
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-indigo-100">
        <div className="h-full bg-indigo-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mb-4 text-lg font-medium text-gray-900">{q.question}</p>

      {answered ? (
        <p className="rounded-lg bg-white py-3 text-center font-semibold text-indigo-700">✅ 제출 완료 · 익명으로 전달됩니다</p>
      ) : closed ? (
        <p className="rounded-lg bg-white py-3 text-center text-gray-500">마감된 질문입니다</p>
      ) : q.type === 'choice' && q.options ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => (
            <button
              key={o}
              disabled={busy}
              onClick={() => submit(o)}
              className="rounded-lg border border-indigo-200 bg-white px-4 py-3 text-left font-medium hover:border-indigo-500 hover:bg-indigo-100 disabled:opacity-50"
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
              className="flex-1 rounded-lg border border-indigo-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          ) : (
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={100}
              placeholder="짧게 답해 주세요"
              className="flex-1 rounded-lg border border-indigo-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          )}
          <button
            disabled={busy || !text.trim()}
            className="rounded-lg bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-300"
          >
            제출
          </button>
        </form>
      )}
      {notice && <p className="mt-2 text-sm text-red-600">{notice}</p>}
    </section>
  );
}
