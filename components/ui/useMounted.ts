'use client';
import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** 브라우저에서 그려질 때만 true (서버 렌더링 중에는 false) */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
