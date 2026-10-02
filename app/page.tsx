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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1>
          <Image src="/logo.png" alt="갸웃" width={781} height={242} priority className="mx-auto h-auto w-80" />
        </h1>
        <p className="mt-3 text-gray-600">갸웃한 순간 편하게 묻고, 교수님께 바로 닿는 수업</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={join} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">🙋 수업 참여</h2>
          <p className="text-sm text-gray-500">교수님이 알려 준 4자리 코드를 입력하세요</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="K7Q2"
            aria-label="방 코드"
            className="rounded-lg border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] uppercase focus:border-indigo-500 focus:outline-none"
          />
          <button
            disabled={code.trim().length !== 4}
            className="rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-300"
          >
            참여하기
          </button>
        </form>

        <form onSubmit={createRoom} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">👩‍🏫 수업 만들기</h2>
          <label className="text-sm text-gray-600">
            수업 제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="선형대수 3주차"
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="text-sm text-gray-600">
            핵심 용어 <span className="text-gray-400">(선택, 쉼표로 구분)</span>
            <input
              value={glossary}
              onChange={(e) => setGlossary(e.target.value)}
              placeholder="고유벡터, 고윳값, 람다"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <button
            disabled={!title.trim() || busy}
            className="rounded-lg bg-gray-900 py-3 font-semibold text-white hover:bg-gray-700 disabled:bg-gray-300"
          >
            {busy ? '만드는 중…' : '수업 만들기'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </main>
  );
}
