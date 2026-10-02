'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * 수업 종료 안내 → seconds초 뒤 시작 화면(/)으로 이동. 교수·학생 화면 공용.
 * onStay를 주면 [이 화면에 머무르기]로 이동을 취소할 수 있다 (교수가 결과를 더 보고 싶을 때).
 */
export function RoomEndedOverlay({
  title,
  message,
  seconds,
  onStay,
}: {
  title: string;
  message: string;
  seconds: number;
  onStay?: () => void;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) router.replace('/'); // 뒤로 가기로 종료된 방에 다시 들어오지 않게 replace
  }, [left, router]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <p className="text-4xl">👋</p>
        <h2 className="mt-3 text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <p className="mt-4 text-sm text-gray-500">{Math.max(left, 0)}초 뒤 처음 화면으로 이동합니다</p>
        <button
          onClick={() => router.replace('/')}
          className="mt-4 w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          지금 처음 화면으로
        </button>
        {onStay && (
          <button onClick={onStay} className="mt-2 w-full rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-100">
            이 화면에 머무르기
          </button>
        )}
      </div>
    </div>
  );
}
