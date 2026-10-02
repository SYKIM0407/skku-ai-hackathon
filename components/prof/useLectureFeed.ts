'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { postJSON } from '@/lib/api-client';
import { CONFIG } from '@/lib/config';
import type { DetectRes, TranscriptRes } from '@/lib/types';

/**
 * 교수 질문 후보 1차 감지 (FR-B1): 질문 어미로 끝나는 문장.
 * 넉넉하게 잡고, 수사적 질문·일반 문장은 서버의 P2가 거른다.
 */
const QUESTION_END = /(까요|나요|습니까|ㅂ니까|인가요|일까|을까|ㄹ까|뭘까|뭐죠|뭐예요|어때요|어떨까|있죠|맞죠|알겠죠|\?|？)\s*[?？]?\s*$/;

/**
 * 강의 문장 처리: 서버 저장 + 교수 질문 후보면 PROFQ_WAIT_MS 동안 이후 발화를 모아 detect 요청.
 */
export function useLectureFeed(roomId: string, onDetected: () => void) {
  const buffer = useRef<{ spoken: string; after: string[] } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [lineCount, setLineCount] = useState(0);

  const flush = useCallback(async () => {
    const b = buffer.current;
    buffer.current = null;
    if (!b) return;
    const res = await postJSON<DetectRes>('/api/prof-q/detect', { roomId, spoken: b.spoken, after: b.after.join(' ') });
    if (res.ok && res.data.detected) onDetected();
  }, [roomId, onDetected]);

  const handleFinal = useCallback(
    (text: string) => {
      void postJSON<TranscriptRes>('/api/transcript', { roomId, text }).then((r) => r.ok && setLineCount((n) => n + 1));
      if (buffer.current) {
        buffer.current.after.push(text);
        return;
      }
      if (QUESTION_END.test(text)) {
        buffer.current = { spoken: text, after: [] };
        timers.current.push(setTimeout(flush, CONFIG.PROFQ_WAIT_MS));
      }
    },
    [roomId, flush],
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return { handleFinal, lineCount };
}
