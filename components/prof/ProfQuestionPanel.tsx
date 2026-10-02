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
  const [composing, setComposing] = useState(false);
  const list = questions ?? [];
  const open = list.find((q) => q.status === 'open');
  // 진행 중 질문이 있으면 새 감지는 보류했다가 마감 후 알린다 (FR-B10)
  const pending = open ? undefined : [...list].filter((q) => q.status === 'pending').sort((a, b) => a.id - b.id)[0];
  // 지난 질문은 수업 종료 전까지 모두 보인다 (최근 것 먼저). [삭제]하면 dismissed가 되어 목록에서 빠진다
  const past = list.filter((q) => q.status === 'closed' && q.summary).sort((a, b) => b.id - a.id);

  return (
    <div className="flex flex-col gap-4">
      {pending && !disabled && <DetectedAlert key={pending.id} q={pending} reload={reload} />}
      {open && <OpenQuestion key={open.id} q={open} reload={reload} />}
      {!open && !disabled &&
        (composing ? (
          <DirectQuestionForm roomId={roomId} onDone={() => (setComposing(false), reload())} onCancel={() => setComposing(false)} />
        ) : (
          <button
            onClick={() => setComposing(true)}
            className="flex items-center justify-center gap-3 rounded-xl border-2 border-[#2563eb] bg-[#0b1f4d] py-4 text-lg font-semibold text-white hover:bg-[#10306f]"
          >
            <PencilIcon /> 직접 질문하기
          </button>
        ))}
      {!pending && !open && !past.length && (
        <p className="py-2 text-center leading-relaxed text-slate-400">
          강의 중 &ldquo;~일까요?&rdquo;처럼 질문하시면
          <br />
          학생들에게 보낼지 여기서 물어봅니다
        </p>
      )}
      {past.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-400">지난 질문 · {past.length}개</h3>
          <ul className="flex flex-col gap-3">
            {past.map((q, i) => (
              <li key={q.id}>
                <Result q={q} defaultOpen={i === 0} reload={reload} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** 보내기 옵션: 기본은 시간 제한 없음(교수가 [마감]), 원하면 45초 제한 */
function DurationToggle({ timed, onChange }: { timed: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={timed} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#0b5cff]" />
      {CONFIG.PROFQ_DURATION_SEC}초 뒤 자동 마감
    </label>
  );
}

function Options({ q }: { q: Pick<ProfQuestion, 'type' | 'options' | 'expected_answer'> }) {
  return (
    <p className="text-sm text-slate-400">
      {TYPE_LABEL[q.type]}
      {q.options && ` · ${q.options.join(' / ')}`}
      {q.expected_answer && ` · 예상 정답: ${q.expected_answer}`}
    </p>
  );
}

function DetectedAlert({ q, reload }: { q: ProfQuestion; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [timed, setTimed] = useState(false);
  const [error, setError] = useState('');
  async function act(kind: 'open' | 'dismiss') {
    setBusy(true);
    const res =
      kind === 'open'
        ? await postJSON<OpenRes>('/api/prof-q/open', { profQuestionId: q.id, durationSec: timed ? CONFIG.PROFQ_DURATION_SEC : 0 })
        : await postJSON<OkRes>('/api/prof-q/dismiss', { profQuestionId: q.id });
    setBusy(false);
    if (!res.ok) setError(res.message);
    reload();
  }
  return (
    <section className="rounded-2xl border-2 border-amber-400/70 bg-amber-400/10 p-5">
      <p className="text-sm font-semibold text-amber-300">🔔 질문이 감지되었습니다. 학생들에게 보낼까요?</p>
      <p className="mt-2 text-xl font-semibold text-white">{q.question}</p>
      <div className="mt-1">
        <Options q={q} />
      </div>
      <div className="mt-3">
        <DurationToggle timed={timed} onChange={setTimed} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={busy}
          onClick={() => act('open')}
          className="flex-1 rounded-lg bg-[#0b5cff] py-3 font-semibold text-white hover:bg-[#2a72ff] disabled:opacity-40"
        >
          학생에게 보내기
        </button>
        <button disabled={busy} onClick={() => act('dismiss')} className="rounded-lg px-5 py-3 text-slate-300 hover:bg-amber-400/10">
          무시
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
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
    <section className="rounded-2xl border-2 border-[#0b5cff] bg-[#0c1a3d] p-5 shadow-[0_0_40px_-12px_rgba(11,92,255,0.6)]">
      <div className="flex items-center justify-between text-sm font-semibold text-[#5b9bff]">
        <span>📢 학생들이 응답하는 중</span>
        {sec === null ? (
          <span className="text-xs font-medium text-[#5b9bff]/80">마감을 누를 때까지 받습니다</span>
        ) : (
          <span className="text-2xl tabular-nums">{sec > 0 ? `${sec}초` : '마감 중…'}</span>
        )}
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{q.question}</p>
      <div className="mt-1">
        <Options q={q} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-lg text-slate-200">
          응답 <b className="text-3xl tabular-nums text-[#5b9bff]">{answered ?? 0}</b>명
        </p>
        <button onClick={close} className="rounded-lg bg-[#0b5cff] px-6 py-3 font-semibold text-white hover:bg-[#2a72ff]">
          마감
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}

function Result({ q, defaultOpen, reload }: { q: ProfQuestion; defaultOpen: boolean; reload: () => void }) {
  const s = q.summary!;
  const [expanded, setExpanded] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const max = Math.max(1, ...s.distribution.map((d) => d.count));
  const top = [...s.distribution].sort((a, b) => b.count - a.count)[0];

  async function remove() {
    if (!window.confirm('이 질문을 목록에서 삭제할까요? (응답 결과는 되돌릴 수 없습니다)')) return;
    setBusy(true);
    const res = await postJSON<OkRes>('/api/prof-q/dismiss', { profQuestionId: q.id });
    setBusy(false);
    if (!res.ok) window.alert(res.message);
    reload();
  }

  return (
    <section className="rounded-2xl border border-[#24407e] bg-[#08122a]">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 p-5 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-400">
            📊 응답 {s.total}명
            {!expanded && top && top.count > 0 && (
              <span className="font-normal"> · 가장 많은 답 {top.label} {Math.round(top.ratio * 100)}%</span>
            )}
          </p>
          <p className={`mt-1 font-semibold text-white ${expanded ? 'text-lg' : 'truncate'}`}>{q.question}</p>
        </div>
        <span className="shrink-0 text-slate-500">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <ul className="flex flex-col gap-2">
            {s.distribution.map((d) => {
              const correct = q.expected_answer && d.label === q.expected_answer;
              const dontKnow = d.label === DONT_KNOW;
              return (
                <li key={d.label} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2">
                  <span className={`truncate text-sm ${correct ? 'font-bold text-emerald-400' : 'text-slate-200'}`}>
                    {correct && '✓ '}
                    {d.label}
                  </span>
                  <span className="h-6 overflow-hidden rounded bg-[#13254d]">
                    <span
                      className={`block h-full ${correct ? 'bg-emerald-500' : dontKnow ? 'bg-slate-500' : 'bg-[#3b82f6]'}`}
                      style={{ width: `${(d.count / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-sm tabular-nums text-slate-300">{Math.round(d.ratio * 100)}%</span>
                </li>
              );
            })}
          </ul>

          {s.misconceptions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-400">흔한 오해</p>
              <ul className="mt-1 list-disc pl-5 text-slate-200">
                {s.misconceptions.map((m) => (
                  <li key={m.text}>
                    {m.text} <span className="text-sm text-slate-400">({Math.round(m.ratio * 100)}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.suggestion && (
            <div className="mt-4 rounded-lg bg-amber-400/10 p-3">
              <p className="text-sm font-semibold text-amber-300">다시 설명하면 좋을 내용</p>
              <p className="mt-1 text-slate-200">{s.suggestion}</p>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => speak(s.spoken_summary)}
              className="flex-1 rounded-lg bg-[#0b5cff] py-3 font-semibold text-white hover:bg-[#2a72ff]"
            >
              🔊 요약 읽어 주기
            </button>
            <button disabled={busy} onClick={remove} className="rounded-lg px-4 py-3 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400">
              삭제
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DirectQuestionForm({ roomId, onDone, onCancel }: { roomId: string; onDone: () => void; onCancel: () => void }) {
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<ProfQType>('choice');
  const [options, setOptions] = useState('');
  const [timed, setTimed] = useState(false);
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
      durationSec: timed ? CONFIG.PROFQ_DURATION_SEC : 0,
    });
    setBusy(false);
    if (res.ok) onDone();
    else setError(res.message);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-[#24407e] bg-[#08122a] p-5">
      <p className="font-semibold">✏️ 직접 질문하기</p>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="학생들에게 물어볼 질문"
        maxLength={300}
        className="rounded-lg border border-[#24407e] bg-[#0c1730] text-white placeholder:text-slate-500 px-3 py-2 focus:border-[#3b82f6] focus:outline-none"
      />
      <div className="flex gap-2">
        {(Object.keys(TYPE_LABEL) as ProfQType[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1 text-sm ${type === t ? 'bg-[#0b5cff] text-white' : 'bg-[#13254d] text-slate-300'}`}
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
          className="rounded-lg border border-[#24407e] bg-[#0c1730] text-white placeholder:text-slate-500 px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
        />
      )}
      <DurationToggle timed={timed} onChange={setTimed} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-slate-300 hover:bg-[#13254d]">
          취소
        </button>
        <button
          disabled={busy || !question.trim()}
          className="rounded-lg bg-[#0b5cff] px-5 py-2 font-semibold text-white hover:bg-[#2a72ff] disabled:opacity-40"
        >
          학생에게 보내기
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}

function PencilIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4c8dff]" aria-hidden>
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
