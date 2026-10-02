'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { MyQuestions } from '@/components/student/MyQuestions';
import { ProfQuestionCard } from '@/components/student/ProfQuestionCard';
import { QuestionComposer } from '@/components/student/QuestionComposer';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { RoomEndedOverlay } from '@/components/ui/RoomEndedOverlay';
import { useMounted } from '@/components/ui/useMounted';
import { getAnonId, store } from '@/lib/api-client';
import { useLive } from '@/lib/live';
import { sb } from '@/lib/supabase/client';
import type { MyQuestion, Room } from '@/lib/types';

/** 학생 화면 /s/[room] (SPEC §9.2) */
export default function StudentPage() {
  const roomId = String(useParams<{ room: string }>().room ?? '').toUpperCase();
  // localStorage(익명 ID·내 질문)는 브라우저에서만 읽을 수 있어서 마운트 후에 그린다
  if (!useMounted()) return null;
  return <StudentRoom key={roomId} roomId={roomId} />;
}

function StudentRoom({ roomId }: { roomId: string }) {
  const myKey = `gyaut:my:${roomId}`;
  const [anonId] = useState(getAnonId);
  const [mine, setMine] = useState<MyQuestion[]>(() => store.get<MyQuestion[]>(myKey, []));

  const { data: room } = useLive<Pick<Room, 'title' | 'status'> | null>(
    async () => {
      const { data } = await sb().from('rooms').select('title, status').eq('id', roomId).maybeSingle();
      return data;
    },
    null, // rooms는 Realtime 대상이 아니라 주기 조회 (수업 종료 감지)
    undefined,
    [roomId],
  );

  // 연결 표시는 학생 화면이 실제로 구독하는 교수 질문 채널 기준
  const { mode } = useLive(async () => null, 'prof_questions', `room_id=eq.${roomId}`, [roomId]);

  function addMine(q: MyQuestion) {
    setMine((prev) => {
      const next = [...prev.filter((p) => p.id !== q.id), q];
      store.set(myKey, next);
      return next;
    });
  }

  if (room === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#070d1c] p-8 text-center text-white">
        <p className="text-lg">수업방 <b className="font-mono">{roomId}</b>을(를) 찾을 수 없습니다.</p>
        <Link href="/" className="text-[#5b9bff] underline">
          코드 다시 입력하기
        </Link>
      </main>
    );
  }

  const ended = room?.status === 'ended';

  return (
    <div className="flex flex-1 flex-col bg-[#070d1c] bg-[radial-gradient(ellipse_at_top,#0c1a3a_0%,transparent_55%)] text-white">
      <header className="sticky top-0 z-10 border-b border-[#16264d] bg-[#0a1226]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="text-2xl font-extrabold tracking-tight">GYAUT</span>
            <span className="h-6 w-px bg-[#24345e]" aria-hidden />
            <h1 className="truncate text-lg font-semibold text-slate-200">{room?.title ?? '불러오는 중…'}</h1>
            <span className="rounded-lg bg-[#13254d] px-3 py-1 font-mono text-sm font-semibold text-[#5b9bff]">{roomId}</span>
          </div>
          <LiveBadge mode={mode} dark />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-8">
        {ended ? (
          <p className="rounded-2xl border border-[#1d3266] bg-[#0c1730] p-5 text-center text-slate-300">
            수업이 종료되었습니다. 참여해 주셔서 감사합니다.
          </p>
        ) : (
          anonId && <ProfQuestionCard roomId={roomId} anonId={anonId} />
        )}
        <h2 className="flex items-center gap-3 px-1 text-2xl font-bold">
          내 질문
          <span className="rounded-lg border border-[#1d3a7a] bg-[#0f1d3d] px-3 py-0.5 text-lg text-[#5b9bff]">{mine.length}</span>
        </h2>
        <MyQuestions roomId={roomId} items={mine} />
      </main>

      {!ended && anonId && <QuestionComposer roomId={roomId} anonId={anonId} onSent={addMine} />}

      {/* rooms는 주기 조회라 교수가 종료하면 POLL_INTERVAL_MS 안에 감지된다 */}
      {ended && <RoomEndedOverlay title="수업이 종료되었습니다" message="참여해 주셔서 감사합니다." seconds={5} />}
    </div>
  );
}
