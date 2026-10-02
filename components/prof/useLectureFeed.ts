'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { postJSON } from '@/lib/api-client';
import { CONFIG } from '@/lib/config';
import type { DetectRes, TranscriptRes } from '@/lib/types';
import { createDetectPlanner } from './detectPlanner';

/**
 * 강의 문장 처리: 서버 저장 + 교수 질문 감지 요청.
 * 언제 무엇을 AI(P2, Speech Act 분류)에게 보낼지는 detectPlanner가 정한다 (평가 스크립트와 같은 로직).
 */
export function useLectureFeed(roomId: string, onDetected: () => void) {
  const planner = useRef(
    createDetectPlanner({ scanLines: CONFIG.PROFQ_SCAN_LINES, waitMs: CONFIG.PROFQ_WAIT_MS, silenceMs: CONFIG.PROFQ_SILENCE_MS }),
  );
  const [lineCount, setLineCount] = useState(0);
  const detected = useRef(onDetected);
  useEffect(() => {
    detected.current = onDetected;
  });

  const handleFinal = useCallback(
    (text: string) => {
      void postJSON<TranscriptRes>('/api/transcript', { roomId, text }).then((r) => r.ok && setLineCount((n) => n + 1));
      planner.current.push(text, Date.now());
    },
    [roomId],
  );

  // 0.5초마다 시간을 흘려 보낼 감지 요청이 있으면 보낸다
  useEffect(() => {
    const t = setInterval(() => {
      for (const req of planner.current.tick(Date.now())) {
        void postJSON<DetectRes>('/api/prof-q/detect', { roomId, spoken: req.spoken, after: req.after }).then((res) => {
          const hit = res.ok && res.data.detected;
          planner.current.result(hit, Date.now());
          if (hit) detected.current();
        });
      }
    }, 500);
    return () => clearInterval(t);
  }, [roomId]);

  return { handleFinal, lineCount };
}
