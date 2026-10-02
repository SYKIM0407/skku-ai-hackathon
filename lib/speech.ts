'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Web Speech API는 표준 타입 정의가 없어 필요한 부분만 선언한다
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

const getCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export type RecognitionStatus = 'off' | 'listening' | 'stopped' | 'denied' | 'unsupported';

/**
 * 강의 음성 인식 (FR-T1~T4). 확정(final) 문장만 onFinal로 넘긴다.
 * 인식 결과는 화면에 표시하지 않는다 — 상태(🟢/🔴)만 돌려준다 (규칙 5).
 * 크롬은 말이 멈추거나 약 1분이 지나면 스스로 끝내므로 onend에서 자동 재시작한다.
 */
export function useLectureRecognition(enabled: boolean, onFinal: (text: string) => void): RecognitionStatus {
  const [status, setStatus] = useState<RecognitionStatus>('off');
  const cb = useRef(onFinal);
  useLayoutEffect(() => {
    cb.current = onFinal;
  });

  useEffect(() => {
    if (!enabled) return;
    const Ctor = getCtor();
    if (!Ctor) {
      queueMicrotask(() => setStatus('unsupported'));
      return;
    }
    const rec = new Ctor();
    rec.lang = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = false;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    rec.onstart = () => setStatus('listening');
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript?.trim();
        if (r.isFinal && text) cb.current(text);
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopped = true;
        setStatus('denied');
      }
    };
    rec.onend = () => {
      if (stopped) return;
      setStatus('stopped'); // 🔴 잠깐 표시 후 재시작
      retry = setTimeout(() => {
        try {
          rec.start();
        } catch {
          /* 이미 시작된 경우 */
        }
      }, 300);
    };
    try {
      rec.start();
    } catch {
      queueMicrotask(() => setStatus('stopped'));
    }

    return () => {
      stopped = true;
      clearTimeout(retry);
      rec.onend = null;
      rec.stop();
      setStatus('off');
    };
  }, [enabled]);

  return enabled ? status : 'off';
}

/** 한국어 음성 출력. 버튼 onClick에서만 부른다 (규칙 6: 자동 낭독 금지) */
export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 1;
  const ko = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('ko'));
  if (ko) u.voice = ko;
  window.speechSynthesis.speak(u);
}
