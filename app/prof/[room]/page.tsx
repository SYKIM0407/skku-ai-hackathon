'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { ClusterList } from '@/components/prof/ClusterList';
import { ProfQuestionPanel } from '@/components/prof/ProfQuestionPanel';
import { useLectureFeed } from '@/components/prof/useLectureFeed';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { RoomEndedOverlay } from '@/components/ui/RoomEndedOverlay';
import { useMounted } from '@/components/ui/useMounted';
import { postJSON } from '@/lib/api-client';
import { useLive } from '@/lib/live';
import { speak, useLectureRecognition, type RecognitionStatus } from '@/lib/speech';
import { sb } from '@/lib/supabase/client';
import type { Cluster, OkRes, ProfQuestion, Room } from '@/lib/types';

const REC_LABEL: Record<RecognitionStatus, string> = {
  off: '⚪ 음성 인식 꺼짐',
  listening: '🟢 강의 인식 중',
  stopped: '🔴 재연결 중',
  denied: '🔴 마이크 권한 필요',
  unsupported: '🔴 크롬에서만 지원',
};

/** 교수 화면 /prof/[room] (SPEC §9.3). 강의 인식 결과(자막)는 표시하지 않는다 */
export default function ProfPage() {
  const roomId = String(useParams<{ room: string }>().room ?? '').toUpperCase();
  if (!useMounted()) return null; // QR 주소·음성 API가 브라우저 전용
  return <ProfRoom key={roomId} roomId={roomId} />;
}

function ProfRoom({ roomId }: { roomId: string }) {
  const [listen, setListen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [notice, setNotice] = useState('');
  const [stay, setStay] = useState(false); // 종료 후 결과를 더 보려고 이 화면에 남기로 함

  const { data: room, reload: reloadRoom } = useLive<Pick<Room, 'title' | 'status'> | null>(
    async () => (await sb().from('rooms').select('title, status').eq('id', roomId).maybeSingle()).data,
    null,
    undefined,
    [roomId],
  );
  const { data: clusters, mode, reload: reloadClusters } = useLive<Cluster[]>(
    async () =>
      ((await sb().from('clusters').select('*').eq('room_id', roomId).order('count', { ascending: false }).order('id')).data ??
        []) as Cluster[],
    'clusters',
    `room_id=eq.${roomId}`,
    [roomId],
  );
  const { data: profQs, reload: reloadProfQs } = useLive<ProfQuestion[]>(
    async () =>
      ((
        await sb()
          .from('prof_questions')
          .select('id, room_id, spoken, question, type, options, expected_answer, status, closes_at, summary')
          .eq('room_id', roomId)
          .neq('status', 'dismissed') // [삭제]한 질문은 목록에서 뺀다
          .order('id', { ascending: false })
          .limit(100)
      ).data ?? []) as ProfQuestion[],
    'prof_questions',
    `room_id=eq.${roomId}`,
    [roomId],
  );

  const ended = room?.status === 'ended';
  const feed = useLectureFeed(roomId, reloadProfQs);
  const recStatus = useLectureRecognition(listen && !ended, feed.handleFinal);
  const joinUrl = `${window.location.origin}/s/${roomId}`;

  async function readTopQuestion() {
    const next = (clusters ?? []).filter((c) => !c.read_aloud).sort((a, b) => b.count - a.count || a.id - b.id)[0];
    if (!next) {
      speak('새로 들어온 질문이 없습니다');
      return;
    }
    speak(next.count > 1 ? `${next.count}명이 질문했습니다. ${next.title}` : `학생 질문입니다. ${next.title}`);
    await postJSON<OkRes>('/api/cluster/read', { clusterId: next.id });
    reloadClusters();
  }

  async function endClass() {
    if (!window.confirm('수업을 종료할까요? 강의 인식 결과가 삭제되고 학생들은 더 이상 질문할 수 없습니다.')) return;
    setListen(false);
    const res = await postJSON<OkRes>('/api/room/end', { roomId });
    setNotice(res.ok ? '수업이 종료되었습니다. 강의 인식 결과를 삭제했습니다.' : res.message);
    reloadRoom();
  }

  if (room === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-lg">수업방 <b className="font-mono">{roomId}</b>을(를) 찾을 수 없습니다.</p>
        <Link href="/" className="text-indigo-600 underline">
          처음으로
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* 상단 바: 방 코드·QR·인식 상태·[질문 읽어 주기]·[수업 종료] — 자막 영역 없음 */}
      <header className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-gray-900">{room?.title ?? '…'}</h1>
          <LiveBadge mode={mode} />
        </div>
        <button
          onClick={() => setShowQr(true)}
          className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-2 hover:bg-gray-50"
          title="크게 보기"
        >
          <QRCodeSVG value={joinUrl} size={44} />
          <span className="text-left">
            <span className="block text-xs text-gray-500">참여 코드</span>
            <span className="font-mono text-2xl font-bold tracking-widest">{roomId}</span>
          </span>
        </button>
        {!ended && (
          <button
            onClick={() => setListen((v) => !v)}
            title={listen ? '누르면 강의 인식을 멈춥니다' : undefined}
            className={`flex flex-col items-start rounded-xl px-4 py-2 text-sm font-semibold ${listen ? 'bg-gray-100 text-gray-800' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
          >
            <span>{listen ? REC_LABEL[recStatus] : '🎙 강의 인식 시작'}</span>
            {/* 문장 내용(자막)은 보여 주지 않고, 서버에 저장된 문장 수만 표시해 제대로 듣고 있는지 확인 */}
            {(listen || feed.lineCount > 0) && (
              <span key={feed.lineCount} className="animate-[pulse_0.6s_ease-out_1] text-xs font-normal opacity-70">
                📝 문장 {feed.lineCount}개 받음
              </span>
            )}
          </button>
        )}
        <button
          onClick={readTopQuestion}
          className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          🔊 질문 읽어 주기
        </button>
        {!ended && (
          <button onClick={endClass} className="rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-100">
            수업 종료
          </button>
        )}
      </header>

      {(ended || notice) && (
        <p className="bg-gray-800 px-6 py-2 text-center text-sm text-white">{notice || '종료된 수업입니다.'}</p>
      )}

      <main className="grid flex-1 gap-6 p-6 lg:grid-cols-[1fr_26rem]">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-500">🙋 학생 질문 (많이 물어본 순)</h2>
          <ClusterList clusters={clusters} />
        </section>
        <aside>
          <h2 className="mb-3 text-sm font-semibold text-gray-500">📢 교수 질문</h2>
          <ProfQuestionPanel roomId={roomId} questions={profQs} reload={reloadProfQs} disabled={ended} />
        </aside>
      </main>

      {ended && !stay && (
        <RoomEndedOverlay
          title="수업이 종료되었습니다"
          message="강의 인식 결과를 삭제했습니다. 학생 화면도 처음 화면으로 돌아갑니다."
          seconds={5}
          onStay={() => setStay(true)}
        />
      )}

      {showQr && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60" onClick={() => setShowQr(false)}>
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-10">
            <QRCodeSVG value={joinUrl} size={320} />
            <p className="font-mono text-6xl font-bold tracking-[0.3em]">{roomId}</p>
            <p className="text-gray-500">{joinUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}
