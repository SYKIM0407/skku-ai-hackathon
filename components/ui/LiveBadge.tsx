'use client';
import type { LiveMode } from '@/lib/live';

const LABEL: Record<LiveMode, { text: string; dot: string }> = {
  realtime: { text: '실시간 연결됨', dot: 'bg-emerald-500' },
  polling: { text: '주기 갱신 중', dot: 'bg-amber-400' },
  connecting: { text: '연결 중', dot: 'bg-gray-300' },
};

/** 화면 갱신 방식 표시 (Realtime / 2초 주기 조회) */
export function LiveBadge({ mode }: { mode: LiveMode }) {
  const l = LABEL[mode];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`h-2 w-2 rounded-full ${l.dot}`} />
      {l.text}
    </span>
  );
}
