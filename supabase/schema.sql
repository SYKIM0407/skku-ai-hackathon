-- 갸웃 DB 스키마 v1.0 (docs/SPEC.md §7)
-- Supabase SQL Editor에 그대로 붙여 넣어 실행한다.
-- 원칙: 읽기는 anon 키 + RLS, 쓰기는 모두 API route(service role)에서만.
-- 거르기로 제외된 질문은 어떤 테이블에도 저장하지 않는다.

-- ───────────── 테이블 ─────────────

create table if not exists rooms (
  id            text primary key,                  -- 방 코드 (예: 'K7Q2')
  title         text not null,
  glossary      text[] not null default '{}',      -- 핵심 용어 (PDF 추출 또는 직접 입력)
  material_text text,                              -- 교안 PDF 텍스트 (선택)
  status        text not null default 'live' check (status in ('live','ended')),
  created_at    timestamptz not null default now()
);

create table if not exists transcripts (           -- 강의 인식 결과. 수업 종료 시 삭제
  id          bigserial primary key,
  room_id     text not null references rooms(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists transcripts_room_time on transcripts(room_id, created_at);

create table if not exists clusters (              -- 질문 묶음
  id           bigserial primary key,
  room_id      text not null references rooms(id) on delete cascade,
  title        text not null,                      -- 대표 질문
  ref_line_ids int[] not null default '{}',        -- 묶음이 가리키는 강의 문장
  count        int not null default 0,
  read_aloud   boolean not null default false,
  updated_at   timestamptz not null default now()
);
create index if not exists clusters_room on clusters(room_id, count desc);

create table if not exists questions (             -- 승인 대기·전송된 질문만
  id           bigserial primary key,
  room_id      text not null references rooms(id) on delete cascade,
  anon_id      text not null,
  raw          text not null,
  refined      text,
  ref_line_ids int[] not null default '{}',
  candidates   jsonb not null default '[]',        -- 다듬은 질문 후보 (문자열 배열)
  confidence   real,
  status       text not null default 'pending' check (status in ('pending','sent')),
  cluster_id   bigint references clusters(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists questions_room on questions(room_id, created_at);

create table if not exists prof_questions (        -- 교수 질문
  id               bigserial primary key,
  room_id          text not null references rooms(id) on delete cascade,
  spoken           text,                           -- 원래 발화 (직접 입력이면 null)
  question         text not null,
  type             text not null check (type in ('choice','short','open')),
  options          jsonb,
  expected_answer  text,
  context_line_ids int[] not null default '{}',
  status           text not null default 'pending' check (status in ('pending','open','closed','dismissed')),
  closes_at        timestamptz,
  summary          jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists prof_questions_room on prof_questions(room_id, created_at desc);

create table if not exists answers (               -- 학생 응답
  id               bigserial primary key,
  prof_question_id bigint not null references prof_questions(id) on delete cascade,
  anon_id          text not null,
  answer           text not null,
  created_at       timestamptz not null default now(),
  unique (prof_question_id, anon_id)               -- 1인 1회
);

-- ───────────── 공개 읽기용 뷰 (익명 ID·응답 원문 노출 없음) ─────────────

create or replace view answer_counts as
  select prof_question_id, count(*)::int as count
  from answers group by prof_question_id;

-- ───────────── RLS ─────────────
-- transcripts / questions / answers 는 anon 읽기 금지 (강의 인식 결과·질문 원문·익명 ID 보호)

alter table rooms          enable row level security;
alter table transcripts    enable row level security;
alter table clusters       enable row level security;
alter table questions      enable row level security;
alter table prof_questions enable row level security;
alter table answers        enable row level security;

create policy "read rooms"          on rooms          for select using (true);
create policy "read clusters"       on clusters       for select using (true);
create policy "read prof_questions" on prof_questions for select using (true);

grant select on answer_counts to anon, authenticated;

-- ───────────── Realtime ─────────────

alter publication supabase_realtime add table clusters;
alter publication supabase_realtime add table prof_questions;
