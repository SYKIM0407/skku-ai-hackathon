'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { postJSON } from '@/lib/api-client';
import { extractPdfText } from '@/lib/pdf-text';
import type { CreateRoomRes, MaterialRes } from '@/lib/types';

// 브라우저에서 글자만 뽑아 보내므로 서버 크기 제한과 무관. 너무 큰 파일은 메모리 때문에만 막는다
const MAX_PDF_MB = 50;

/** 시작 화면 (SPEC §9.1): 수업 만들기 / 수업 참여 */
export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [glossary, setGlossary] = useState('');
  const [code, setCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'' | 'room' | 'extract' | 'material'>('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  // 교안 업로드가 실패해도 수업방은 이미 만들어졌으므로 그대로 시작할 수 있게 둔다
  const [createdRoom, setCreatedRoom] = useState('');

  function pickFile(f: File | null) {
    setError('');
    if (f && f.size > MAX_PDF_MB * 1024 * 1024) {
      setError(`PDF는 ${MAX_PDF_MB}MB까지 올릴 수 있어요`);
      if (fileInput.current) fileInput.current.value = '';
      return setFile(null);
    }
    setFile(f);
  }

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setError('');
    const terms = glossary.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

    let roomId = createdRoom;
    if (!roomId) {
      setBusy('room');
      const res = await postJSON<CreateRoomRes>('/api/room', { title: title.trim(), glossary: terms });
      if (!res.ok) {
        setError(res.message);
        return setBusy('');
      }
      roomId = res.data.roomId;
      setCreatedRoom(roomId);
    }

    // 교안 PDF → (브라우저에서) 텍스트 추출 → 서버가 핵심 용어를 용어집에 합친다 (FR-R5). 직접 입력한 용어는 유지된다
    if (file) {
      setBusy('extract');
      const pdf = await extractPdfText(file, (page, total) => setProgress(`${page}/${total}쪽`));
      setProgress('');
      if ('error' in pdf) {
        setError(
          pdf.error === 'no_text'
            ? '글자를 찾을 수 없는 PDF예요(스캔본). 수업은 만들어졌으니 용어를 직접 입력하거나 그대로 시작해 주세요.'
            : 'PDF를 읽을 수 없어요. 수업은 만들어졌으니 다른 PDF를 골라 다시 누르거나 그대로 시작해 주세요.',
        );
        return setBusy('');
      }
      setBusy('material');
      const up = await postJSON<MaterialRes>('/api/room/material', { roomId, text: pdf.text });
      if (!up.ok) {
        setError(`${up.message} — 수업은 만들어졌어요. 그대로 시작하거나 다시 눌러 주세요.`);
        return setBusy('');
      }
    }
    router.push(`/prof/${roomId}`);
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
              강의 교안 PDF <span className="text-sm text-slate-400">(선택, {MAX_PDF_MB}MB까지 · 핵심 용어를 자동으로 뽑아요)</span>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border file:border-[#24407e] file:bg-[#13254d] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#5b9bff] hover:file:bg-[#1a3061]"
              />
            </label>
            <label className="text-slate-200">
              핵심 용어 <span className="text-sm text-slate-400">(선택, 쉼표로 구분 · PDF에서 뽑은 용어와 합쳐져요)</span>
              <input
                value={glossary}
                onChange={(e) => setGlossary(e.target.value)}
                placeholder="고유벡터, 고윳값, 람다"
                className={`${INPUT} mt-2 px-4 py-3`}
              />
            </label>
            <button
              disabled={!title.trim() || !!busy}
              className="mt-auto rounded-xl border-2 border-[#2563eb] bg-[#0b2a6b] py-4 text-lg font-semibold hover:bg-[#10378a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'room' ? '만드는 중…' : busy === 'extract' ? `교안 읽는 중… ${progress}` : busy === 'material' ? '핵심 용어 뽑는 중…' : createdRoom ? '다시 시도' : '수업 만들기'}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {createdRoom && !busy && (
              <button type="button" onClick={() => router.push(`/prof/${createdRoom}`)} className="text-sm text-[#5b9bff] underline">
                교안 없이 수업 시작하기
              </button>
            )}
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
