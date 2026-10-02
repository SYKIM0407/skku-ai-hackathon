'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJSON } from '@/lib/api-client';
import type { CreateRoomRes } from '@/lib/types';

/** 시작 화면 (SPEC §9.1): 수업 만들기 / 수업 참여 */
export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [glossary, setGlossary] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError('');
    const terms = glossary.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const res = await postJSON<CreateRoomRes>('/api/room', { title: title.trim(), glossary: terms });
    if (res.ok) router.push(`/prof/${res.data.roomId}`);
    else {
      setError(res.message);
      setBusy(false);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length === 4) router.push(`/s/${c}`);
  }

  return (
    <div className="flex flex-1 flex-col bg-[#070d1c] bg-[radial-gradient(ellipse_at_top,#0f1f45_0%,transparent_60%)] text-white">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-4 py-12">
        <header className="text-center">
          <h1>
            <Image src="/logo-dark.png" alt="갸웃" width={781} height={242} priority className="mx-auto h-auto w-96" />
          </h1>
          <p className="mt-4 text-lg text-slate-300">갸웃한 순간 편하게 묻고, 교수님께 바로 닿는 수업</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <form onSubmit={join} className={CARD}>
            <CardHead icon={<UserPlusIcon />} badge="학생용" title="수업 참여" />
            <p className="text-slate-300">교수님이 알려 준 4자리 코드를 입력하세요</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="K7Q2"
              aria-label="방 코드"
              className={`${INPUT} py-5 text-center text-4xl font-bold tracking-[0.5em] uppercase placeholder:text-slate-500`}
            />
            <button
              disabled={code.trim().length !== 4}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-[#0b5cff] py-4 text-lg font-semibold hover:bg-[#2a72ff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              참여하기 <span aria-hidden>→</span>
            </button>
          </form>

          <form onSubmit={createRoom} className={CARD}>
            <CardHead icon={<FilePlusIcon />} badge="교수자용" title="수업 만들기" />
            <label className="text-slate-200">
              수업 제목
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="선형대수 3주차"
                maxLength={100}
                className={`${INPUT} mt-2 px-4 py-3`}
              />
            </label>
            <label className="text-slate-200">
              핵심 용어 (선택, 쉼표로 구분)
              <input
                value={glossary}
                onChange={(e) => setGlossary(e.target.value)}
                placeholder="고유벡터, 고윳값, 람다"
                className={`${INPUT} mt-2 px-4 py-3`}
              />
            </label>
            <button
              disabled={!title.trim() || busy}
              className="mt-auto rounded-xl border-2 border-[#2563eb] bg-[#0b2a6b] py-4 text-lg font-semibold hover:bg-[#10378a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? '만드는 중…' : '수업 만들기'}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}

const CARD = 'flex flex-col gap-5 rounded-3xl border border-[#1d3266] bg-[#0c1730]/80 p-8 shadow-[0_20px_60px_-20px_rgba(11,92,255,0.25)]';
const INPUT =
  'w-full rounded-xl border border-[#24407e] bg-[#08122a] text-white placeholder:text-slate-500 focus:border-[#3b82f6] focus:outline-none';

function CardHead({ icon, badge, title }: { icon: React.ReactNode; badge: string; title: string }) {
  return (
    <div className="flex items-center gap-5">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#13254d] text-[#4c8dff]">{icon}</div>
      <div>
        <span className="inline-block rounded-md border border-[#1d3a7a] bg-[#13254d] px-2.5 py-0.5 text-xs font-semibold text-[#5b9bff]">
          {badge}
        </span>
        <h2 className="mt-1.5 text-3xl font-bold">{title}</h2>
      </div>
    </div>
  );
}

const ICON = { width: 30, height: 30, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function UserPlusIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function FilePlusIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4M12 12v6M9 15h6" />
    </svg>
  );
}
