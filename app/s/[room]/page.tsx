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
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg">수업방 <b className="font-mono">{roomId}</b>을(를) 찾을 수 없습니다.</p>
        <Link href="/" className="text-indigo-600 underline">
          코드 다시 입력하기
        </Link>
      </main>
    );
  }

  const ended = room?.status === 'ended';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="font-semibold text-gray-900">{room?.title ?? '불러오는 중…'}</h1>
          <p className="font-mono text-xs text-gray-400">{roomId}</p>
        </div>
        <LiveBadge mode={mode} />
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        {ended ? (
          <p className="rounded-xl bg-gray-100 p-4 text-center text-gray-600">수업이 종료되었습니다. 참여해 주셔서 감사합니다.</p>
        ) : (
          anonId && <ProfQuestionCard roomId={roomId} anonId={anonId} />
        )}
        <h2 className="text-sm font-semibold text-gray-500">내 질문</h2>
        <MyQuestions roomId={roomId} items={mine} />
      </main>

      {!ended && anonId && <QuestionComposer roomId={roomId} anonId={anonId} onSent={addMine} />}

      {/* rooms는 주기 조회라 교수가 종료하면 POLL_INTERVAL_MS 안에 감지된다 */}
      {ended && <RoomEndedOverlay title="수업이 종료되었습니다" message="참여해 주셔서 감사합니다." seconds={5} />}
    </div>
  );
}
