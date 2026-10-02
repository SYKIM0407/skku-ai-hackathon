'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CONFIG } from './config';
import { sb } from './supabase/client';

export type LiveMode = 'realtime' | 'polling' | 'connecting';

/**
 * 실시간 조회 훅 (CLAUDE.md "Realtime 구독 또는 주기 조회").
 * Realtime 변경 이벤트가 오면 fetcher를 다시 부른다(목록 병합 로직 없이 단순하게).
 * 구독이 안 되거나 USE_REALTIME=false면 POLL_INTERVAL_MS 주기 조회로 전환한다.
 * table을 null로 주면 주기 조회만 한다 (Realtime이 안 되는 뷰 answer_counts 등).
 */
export function useLive<T>(
  fetcher: () => Promise<T>,
  table: string | null,
  filter: string | undefined,
  deps: unknown[],
): { data: T | undefined; mode: LiveMode; reload: () => void } {
  const [data, setData] = useState<T>();
  const [mode, setMode] = useState<LiveMode>('connecting');
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher; // 최신 fetcher를 쓰되 구독은 deps가 바뀔 때만 다시 한다
  });
  const reloadRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = () => {
      fetcherRef.current().then(
        (d) => alive && setData(d),
        () => {}, // 일시적 네트워크 오류는 다음 주기에 다시 시도
      );
    };
    reloadRef.current = load;
    const startPolling = () => {
      if (timer) return;
      timer = setInterval(load, CONFIG.POLL_INTERVAL_MS);
      if (alive) setMode('polling');
    };
    load();

    if (!table || !CONFIG.USE_REALTIME) {
      startPolling();
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }

    const channel = sb()
      .channel(`live:${table}:${filter ?? '*'}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, load)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearInterval(timer);
          timer = undefined;
          if (alive) setMode('realtime');
          load(); // 구독 전 사이에 바뀐 것 반영
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startPolling();
        }
      });

    return () => {
      alive = false;
      clearInterval(timer);
      sb().removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, mode, reload: () => reloadRef.current() };
}
