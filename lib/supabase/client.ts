import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browser: SupabaseClient | undefined;

/** 브라우저 읽기·Realtime 구독 전용 (anon 키 + RLS). 쓰기는 반드시 API route를 거친다. */
export function sb(): SupabaseClient {
  if (!browser) {
    // 빌드 시점이 아니라 처음 쓸 때 만들어야 env 없이도 빌드가 된다
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 없습니다 (.env.local 확인)');
    browser = createClient(url, key, { auth: { persistSession: false } });
  }
  return browser;
}
