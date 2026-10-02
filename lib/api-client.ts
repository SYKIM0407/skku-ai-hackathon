'use client';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };

/** 화면에서 API route 호출. 실패해도 throw하지 않고 SPEC 오류 형식으로 돌려준다 */
export async function postJSON<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    return {
      ok: false,
      status: res.status,
      code: json?.error?.code ?? 'UNKNOWN',
      message: json?.error?.message ?? '잠시 후 다시 시도해 주세요',
    };
  } catch {
    return { ok: false, status: 0, code: 'NETWORK', message: '네트워크 연결을 확인해 주세요' };
  }
}

/** multipart 업로드 (교안 PDF). postJSON과 같은 결과 형식 */
export async function postForm<T>(path: string, form: FormData): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { method: 'POST', body: form });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    return {
      ok: false,
      status: res.status,
      code: json?.error?.code ?? 'UNKNOWN',
      message: json?.error?.message ?? '잠시 후 다시 시도해 주세요',
    };
  } catch {
    return { ok: false, status: 0, code: 'NETWORK', message: '네트워크 연결을 확인해 주세요' };
  }
}

/** localStorage 안전 래퍼 (시크릿 창·차단 환경에서도 화면이 깨지지 않게) */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장이 안 돼도 화면은 계속 동작 */
    }
  },
};

/** 기기별 익명 ID (FR-R4). 화면에 표시하지 않는다 */
export function getAnonId(): string {
  const key = 'gyaut:anon';
  let id = store.get<string | null>(key, null);
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    store.set(key, id);
  }
  return id;
}
