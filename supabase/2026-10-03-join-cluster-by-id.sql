-- 이미 schema.sql을 실행한 Supabase에 이 블록만 SQL Editor에서 추가 실행 (schema.sql에도 포함됨)
-- 다른 학생의 질문 묶음에 "나도 모르겠어요"로 합류 (/api/cluster/join). 같은 학생이 같은 묶음에 두 번 합류하지 않는다
create or replace function join_cluster_by_id(p_cluster bigint, p_anon text)
returns table(question_id bigint, cnt int)
language plpgsql as $$
declare c record; qid bigint;
begin
  select id, room_id, title, ref_line_ids into c from clusters where id = p_cluster;
  if c.id is null then return; end if;
  perform pg_advisory_xact_lock(hashtext(c.room_id));
  select q.id into qid from questions q where q.cluster_id = c.id and q.anon_id = p_anon limit 1;
  if qid is null then
    insert into questions(room_id, anon_id, raw, refined, ref_line_ids, status, cluster_id, confidence)
      values (c.room_id, p_anon, '나도 모르겠어요', c.title, c.ref_line_ids, 'sent', c.id, 1)
      returning id into qid;
    update clusters set count = count + 1, updated_at = now() where id = c.id;
  end if;
  return query select qid, cl.count from clusters cl where cl.id = c.id;
end $$;


revoke execute on function join_cluster_by_id(bigint, text) from public, anon, authenticated;
