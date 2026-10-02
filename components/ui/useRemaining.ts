'use client';
import { useEffect, useState } from 'react';

/** closes_at까지 남은 밀리초 (0 이상). closesAt이 없으면 null */
export function useRemaining(closesAt: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!closesAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [closesAt]);
  if (!closesAt) return null;
  return Math.max(0, new Date(closesAt).getTime() - now);
}
