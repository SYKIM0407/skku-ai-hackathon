'use client';
import { useState } from 'react';
import { postJSON } from '@/lib/api-client';
import type { ConfirmRes, MyQuestion, QuestionRes, QuestionReview } from '@/lib/types';

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'review'; q: QuestionReview; sending: boolean }
  | { kind: 'notice'; message: string; tone: 'info' | 'warn' };

/**
 * 질문 입력 → AI 정리 → 승인 창 (SPEC §9.2, FR-A1·A3·A4·A5·A9).
 * 강의 원문은 받지도 보여 주지도 않는다. 짧은 입력("ㅁㄹ", "?")도 그대로 보낸다.
 */
export function QuestionComposer({
  roomId,
  anonId,
  onSent,
}: {
  roomId: string;
  anonId: string;
  onSent: (q: MyQuestion) => void;
}) {
  const [raw, setRaw] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const text = raw.trim();
    if (!text || phase.kind === 'loading') return;
    setPhase({ kind: 'loading' });
    const res = await postJSON<QuestionRes>('/api/question', { roomId, anonId, raw: text });
    if (!res.ok) return setPhase({ kind: 'notice', message: res.message, tone: 'warn' });
    const r = res.data;
    if (r.status === 'review') {
      setPhase({ kind: 'review', q: r.question, sending: false });
    } else if (r.status === 'rejected') {
      setPhase({ kind: 'notice', message: r.message, tone: 'warn' });
    } else {
      onSent({ id: r.questionId, refined: text, clusterId: r.clusterId });
      setRaw('');
      setPhase({ kind: 'notice', message: r.message, tone: 'info' });
    }
  }

  async function confirm(action: 'send' | 'cancel', candidateIndex?: number) {
    if (phase.kind !== 'review' || phase.sending) return;
    const q = phase.q;
    setPhase({ ...phase, sending: true }); // [보내기] 중복 클릭 방지
    const res = await postJSON<ConfirmRes>('/api/question/confirm', {
      questionId: q.id,
      anonId,
      action,
      ...(candidateIndex !== undefined ? { candidateIndex } : {}),
    });
    if (!res.ok) return setPhase({ kind: 'notice', message: res.message, tone: 'warn' });
    if (action === 'send' && 'clusterId' in res.data) {
      const refined = candidateIndex !== undefined ? q.candidates[candidateIndex] : q.refined;
      onSent({ id: q.id, refined, clusterId: res.data.clusterId });
      setRaw('');
      setPhase({ kind: 'notice', message: '교수님께 보냈습니다', tone: 'info' });
    } else {
      setPhase({ kind: 'idle' });
    }
  }

  return (
    <>
      {phase.kind === 'review' && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div role="dialog" aria-modal className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            {phase.q.candidates.length > 0 ? (
              <>
                <h3 className="text-lg font-semibold">어떤 뜻인가요?</h3>
                <p className="mt-1 text-sm text-gray-500">가장 가까운 질문을 고르면 교수님께 보냅니다</p>
                <div className="mt-4 flex flex-col gap-2">
                  {phase.q.candidates.map((c, i) => (
                    <button
                      key={i}
                      disabled={phase.sending}
                      onClick={() => confirm('send', i)}
                      className="rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-indigo-500 hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">이렇게 보낼까요?</h3>
                <p className="mt-4 rounded-lg bg-indigo-50 p-4 text-gray-900">{phase.q.refined}</p>
              </>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={phase.sending}
                onClick={() => confirm('cancel')}
                className="rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                취소
              </button>
              {phase.q.candidates.length === 0 && (
                <button
                  disabled={phase.sending}
                  onClick={() => confirm('send')}
                  className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-300"
                >
                  {phase.sending ? '보내는 중…' : '보내기'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        {phase.kind === 'notice' && (
          <p
            className={`mb-2 text-sm ${phase.tone === 'warn' ? 'text-amber-700' : 'text-indigo-700'}`}
            role="status"
          >
            {phase.message}
          </p>
        )}
        <form onSubmit={ask} className="mx-auto flex max-w-2xl gap-2">
          <input
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (phase.kind === 'notice') setPhase({ kind: 'idle' });
            }}
            maxLength={500}
            placeholder="궁금한 걸 편하게 적어 주세요 (예: 방금 그거 왜 0임?)"
            aria-label="질문 입력"
            className="flex-1 rounded-full border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
          <button
            disabled={!raw.trim() || phase.kind === 'loading'}
            className="rounded-full bg-indigo-600 px-6 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-300"
          >
            {phase.kind === 'loading' ? '정리 중…' : '질문'}
          </button>
        </form>
      </div>
    </>
  );
}
