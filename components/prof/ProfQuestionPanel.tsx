'use client';
import { useEffect, useRef, useState } from 'react';
import { useRemaining } from '@/components/ui/useRemaining';
import { postJSON } from '@/lib/api-client';
import { CONFIG, DONT_KNOW } from '@/lib/config';
import { useLive } from '@/lib/live';
import { speak } from '@/lib/speech';
import { sb } from '@/lib/supabase/client';
import type { CloseRes, OkRes, OpenRes, ProfQType, ProfQuestion } from '@/lib/types';

const TYPE_LABEL: Record<ProfQType, string> = { choice: '선택형', short: '단답형', open: '서술형' };

/**
 * 교수 질문 패널 (SPEC §9.3, FR-B3·B4·B5·B7·B8·B9·B10)
 * 감지 알림 [보내기]/[무시] → 진행 중(남은 시간·응답 수·[마감]) → 결과(분포·흔한 오해·다시 설명할 내용·[요약 읽어 주기])
 */
export function ProfQuestionPanel({
  roomId,
  questions,
  reload,
  disabled,
}: {
  roomId: string;
  questions: ProfQuestion[] | undefined;
  reload: () => void;
  disabled: boolean;
}) {
  const [hiddenResult, setHiddenResult] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const list = questions ?? [];
  const open = list.find((q) => q.status === 'open');
  // 진행 중 질문이 있으면 새 감지는 보류했다가 마감 후 알린다 (FR-B10)
  const pending = open ? undefined : [...list].filter((q) => q.status === 'pending').sort((a, b) => a.id - b.id)[0];
  const result = list.find((q) => q.status === 'closed' && q.summary);

  return (
    <div className="flex flex-col gap-4">
      {pending && !disabled && <DetectedAlert key={pending.id} q={pending} reload={reload} />}
      {open && <OpenQuestion key={open.id} q={open} reload={reload} />}
      {!open && result && result.id !== hiddenResult && (
        <Result key={result.id} q={result} onHide={() => setHiddenResult(result.id)} />
      )}
      {!open && !disabled &&
        (composing ? (
          <DirectQuestionForm roomId={roomId} onDone={() => (setComposing(false), reload())} onCancel={() => setComposing(false)} />
        ) : (
          <button
            onClick={() => setComposing(true)}
            className="rounded-xl border-2 border-dashed border-gray-300 py-3 font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
          >
            ✏️ 직접 질문하기
          </button>
        ))}
      {!pending && !open && !result && (
        <p className="text-center text-sm text-gray-400">
          강의 중 &ldquo;~일까요?&rdquo;처럼 질문하시면
          <br />
          학생들에게 보낼지 여기서 물어봅니다
        </p>
      )}
    </div>
  );
}

function Options({ q }: { q: Pick<ProfQuestion, 'type' | 'options' | 'expected_answer'> }) {
  return (
    <p className="text-sm text-gray-500">
      {TYPE_LABEL[q.type]}
      {q.options && ` · ${q.options.join(' / ')}`}
      {q.expected_answer && ` · 예상 정답: ${q.expected_answer}`}
    </p>
  );
}

function DetectedAlert({ q, reload }: { q: ProfQuestion; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function act(kind: 'open' | 'dismiss') {
    setBusy(true);
    const res =
      kind === 'open'
        ? await postJSON<OpenRes>('/api/prof-q/open', { profQuestionId: q.id, durationSec: CONFIG.PROFQ_DURATION_SEC })
        : await postJSON<OkRes>('/api/prof-q/dismiss', { profQuestionId: q.id });
    setBusy(false);
    if (!res.ok) setError(res.message);
    reload();
  }
  return (
    <section className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
      <p className="text-sm font-semibold text-amber-700">🔔 질문이 감지되었습니다. 학생들에게 보낼까요?</p>
      <p className="mt-2 text-xl font-semibold text-gray-900">{q.question}</p>
      <div className="mt-1">
        <Options q={q} />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          disabled={busy}
          onClick={() => act('open')}
          className="flex-1 rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-300"
        >
          보내기 ({CONFIG.PROFQ_DURATION_SEC}초)
        </button>
        <button disabled={busy} onClick={() => act('dismiss')} className="rounded-lg px-5 py-3 text-gray-600 hover:bg-amber-100">
          무시
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function OpenQuestion({ q, reload }: { q: ProfQuestion; reload: () => void }) {
  const remaining = useRemaining(q.closes_at);
  const closing = useRef(false);
  const [error, setError] = useState('');
  const { data: answered } = useLive<number>(
    async () => {
      const { data } = await sb().from('answer_counts').select('count').eq('prof_question_id', q.id).maybeSingle();
      return Number(data?.count ?? 0);
    },
    null, // 뷰는 Realtime이 안 되므로 주기 조회
    undefined,
    [q.id],
  );

  async function close() {
    if (closing.current) return;
    closing.current = true;
    const res = await postJSON<CloseRes>('/api/prof-q/close', { profQuestionId: q.id });
    if (!res.ok) {
      closing.current = false;
      setError(res.message);
    }
    reload();
  }

  // 시간이 끝나면 자동 마감 (SPEC §8.4)
  useEffect(() => {
    if (!q.closes_at) return;
    const t = setTimeout(() => void close(), Math.max(0, new Date(q.closes_at).getTime() - Date.now()));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.closes_at]);

  const sec = remaining === null ? null : Math.ceil(remaining / 1000);
  return (
    <section className="rounded-2xl border-2 border-indigo-500 bg-indigo-50 p-5">
      <div className="flex items-center justify-between text-sm font-semibold text-indigo-700">
        <span>📢 학생들이 응답하는 중</span>
        <span className="text-2xl tabular-nums">{sec === null ? '' : sec > 0 ? `${sec}초` : '마감 중…'}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-gray-900">{q.question}</p>
      <div className="mt-1">
        <Options q={q} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-lg">
          응답 <b className="text-3xl tabular-nums text-indigo-700">{answered ?? 0}</b>명
        </p>
        <button onClick={close} className="rounded-lg bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-700">
          마감
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function Result({ q, onHide }: { q: ProfQuestion; onHide: () => void }) {
  const s = q.summary!;
  const max = Math.max(1, ...s.distribution.map((d) => d.count));
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-500">📊 응답 결과 · {s.total}명</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{q.question}</p>
        </div>
        <button onClick={onHide} aria-label="결과 닫기" className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {s.distribution.map((d) => {
          const correct = q.expected_answer && d.label === q.expected_answer;
          const dontKnow = d.label === DONT_KNOW;
          return (
            <li key={d.label} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2">
              <span className={`truncate text-sm ${correct ? 'font-bold text-emerald-700' : 'text-gray-700'}`}>
                {correct && '✓ '}
                {d.label}
              </span>
              <span className="h-6 overflow-hidden rounded bg-gray-100">
                <span
                  className={`block h-full ${correct ? 'bg-emerald-500' : dontKnow ? 'bg-gray-400' : 'bg-indigo-400'}`}
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-sm tabular-nums text-gray-600">{Math.round(d.ratio * 100)}%</span>
            </li>
          );
        })}
      </ul>

      {s.misconceptions.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-500">흔한 오해</p>
          <ul className="mt-1 list-disc pl-5 text-gray-800">
            {s.misconceptions.map((m) => (
              <li key={m.text}>
                {m.text} <span className="text-sm text-gray-500">({Math.round(m.ratio * 100)}%)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.suggestion && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-700">다시 설명하면 좋을 내용</p>
          <p className="mt-1 text-gray-800">{s.suggestion}</p>
        </div>
      )}
      <button
        onClick={() => speak(s.spoken_summary)}
        className="mt-4 w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700"
      >
        🔊 요약 읽어 주기
      </button>
    </section>
  );
}

function DirectQuestionForm({ roomId, onDone, onCancel }: { roomId: string; onDone: () => void; onCancel: () => void }) {
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<ProfQType>('choice');
  const [options, setOptions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const opts = options.split('\n').map((s) => s.trim()).filter(Boolean);
    const res = await postJSON<OpenRes>('/api/prof-q/open', {
      roomId,
      question: question.trim(),
      type,
      ...(type === 'choice' ? { options: opts } : {}),
      durationSec: CONFIG.PROFQ_DURATION_SEC,
    });
    setBusy(false);
    if (res.ok) onDone();
    else setError(res.message);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5">
      <p className="font-semibold">✏️ 직접 질문하기</p>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="학생들에게 물어볼 질문"
        maxLength={300}
        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex gap-2">
        {(Object.keys(TYPE_LABEL) as ProfQType[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1 text-sm ${type === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      {type === 'choice' && (
        <textarea
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          rows={3}
          placeholder={`선택지를 한 줄에 하나씩 (마지막에 "${DONT_KNOW}"는 자동으로 붙어요)`}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100">
          취소
        </button>
        <button
          disabled={busy || !question.trim()}
          className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-300"
        >
          보내기 ({CONFIG.PROFQ_DURATION_SEC}초)
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
