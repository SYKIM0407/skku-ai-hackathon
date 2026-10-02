import 'server-only';
import type { ApiError } from '@/lib/types';

// API route 공용 도우미. _lib 폴더는 라우트로 노출되지 않는다.

export const ok = <T>(body: T, status = 200) => Response.json(body, { status });

export const fail = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } } satisfies ApiError, { status });

export const badRequest = (message: string) => fail(400, 'BAD_REQUEST', message);
export const serverError = () => fail(500, 'SERVER_ERROR', '잠시 후 다시 시도해 주세요');

/** JSON body를 객체로 읽는다. 형식이 틀리면 null */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 공백을 다듬은 비어 있지 않은 문자열이면 그 값, 아니면 null */
export function str(v: unknown, max = 1000): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s && s.length <= max ? s : null;
}

/** 양의 정수(숫자 또는 숫자 문자열)면 number, 아니면 null */
export function id(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Postgres 오류 코드 (supabase-js error.code) */
export const PG = { UNIQUE: '23505', FK: '23503' } as const;
