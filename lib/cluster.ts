import 'server-only';
import { sbAdmin } from './supabase/server';

/**
 * 질문을 묶음에 합류시킨다 (SPEC §8.3 묶기 규칙).
 * 겹치는 강의 문장(ref_line_ids)이 있는 묶음에 합류, 없으면 새 묶음(title=질문).
 * 인원 증가·질문 sent 처리까지 DB 함수 join_cluster가 방 단위 잠금으로 한 번에 한다. 실패하면 null
 */
export async function joinCluster(
  roomId: string,
  questionId: number,
  title: string,
  refLineIds: number[],
): Promise<{ clusterId: number; count: number } | null> {
  const { data, error } = await sbAdmin().rpc('join_cluster', {
    p_room: roomId,
    p_qid: questionId,
    p_title: title,
    p_refs: refLineIds,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return null;
  return { clusterId: Number(row.cluster_id), count: Number(row.cnt) };
}

/** 이미 묶인 질문의 현재 인원 (같은 [보내기]가 두 번 와도 같은 결과를 주기 위해) */
export async function clusterCount(clusterId: number): Promise<number | null> {
  const { data } = await sbAdmin().from('clusters').select('count').eq('id', clusterId).maybeSingle();
  return data ? Number(data.count) : null;
}
