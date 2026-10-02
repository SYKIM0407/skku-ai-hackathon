# 갸웃 기능 명세서 (v1.0)

> **한 줄 소개:** 수업을 함께 듣고, 학생과 교수 사이에서 대신 손을 들어 주는 AI
> **이름의 의미:** 이해가 되지 않아 고개를 갸웃하는 순간을 놓치지 않는다
> **해커톤 주제:** 2. 더 나은 캠퍼스를 위한 AI (AI for Smarter Campus)
> **기준 문서:** `docs/PROPOSAL.md` (기획서 v1.0). 기획서와 이 문서가 다르면 기획서를 따르고 이 문서를 고친다.
> **변경 이력:** v1.0 — 기획서 기준 개정 (강의 자막·규칙 필터·차단 통계·막힘 알림·묶음 숨기기·강의 원문 확인 제거, 흐름 B 필수화, 음성 출력은 교수 요청 시에만)

---

## 목차

1. 문제 정의
2. 서비스 범위
3. 핵심 흐름
4. 기능 요구사항 (FR)
5. 비기능 요구사항 (NFR)
6. 시스템 구조
7. 데이터 모델
8. API 명세
9. 화면 명세
10. 정책
11. 설정값과 결정 필요 사항
12. 평가 계획
13. 용어 정리

---

## 1. 문제 정의

수업 중 학생과 교수 사이의 **실시간 쌍방향 소통**이 원활하지 않다.

| 대상 | 문제 |
|---|---|
| 학생 | 수업 흐름을 끊을 것에 대한 부담, 자신만 모를 수 있다는 불안, 무엇을 모르는지 정리하기 어려움 때문에 질문하지 않는다. 한 번 놓친 내용이 이후 이해를 어렵게 한다 |
| 교수 | 질문을 해도 학생들이 응답하지 않아 이해도를 판단할 수 없고, 참여 저조로 수업 진행 의욕이 저하된다 |

### 기존 방법과의 차별점

| | 익명 채팅·Slido | AI 챗봇 | AskNow (해외 연구, 2025) | **갸웃** |
|---|---|---|---|---|
| 익명 질문 | ✅ | - | ✅ | ✅ |
| 실시간 강의 음성 인식으로 질문 시점 매칭 | ❌ | ❌ | ✅ | ✅ |
| AI가 다듬은 질문을 학생이 승인 | ❌ | - | ❌ | ✅ |
| 강의 시점 기준 질문 묶기 | ❌ | - | ❌ (의미 기반) | ✅ |
| 교수가 말로 한 질문 감지 → 학생 익명 응답 → 오해 분석 | ❌ | ❌ | ❌ | ✅ |
| 질문이 교수에게 모이는 양방향 구조 | ✅ | ❌ | ✅ | ✅ |

---

## 2. 서비스 범위

### 포함

- 수업방 생성·입장 (로그인 없음, 방 코드·QR)
- 교수 강의 음성 실시간 인식 (**결과는 화면에 표시하지 않음**)
- **흐름 A:** 학생 질문 → AI 1회 호출(분류·시점 매칭·다듬기) → 학생 승인 → 강의 시점 기준 묶기 → 교수 화면 → 교수 요청 시 음성 낭독
- **흐름 B:** 교수 발화 → 질문 감지 → 교수 확인 → 학생 익명 응답 → 분포·흔한 오해 → 교수 요청 시 음성 낭독
- AI 판정에 의한 거르기 (제외된 질문은 저장하지 않고 폐기)
- 교안 PDF 업로드 (핵심 용어 추출, 필수 여부는 D-1)
- 수업 종료 시 강의 인식 결과 삭제
- 가짜 강의 모드 (개발·시연용)

### 제외

- 강의 자막 표시
- 규칙 기반 필터 (욕설·도배·링크·전송 횟수 제한)
- 걸러진 메시지 수 표시 및 차단 기록
- 막힘 알림, 질문 묶음 숨기기
- 학생 화면의 강의 원문 표시
- 음성 자동 낭독 (모든 음성 출력은 교수 요청 시에만)
- 교수 질문 완전 자동 전송, 수업 후 리포트 화면
- 로그인, LMS 연동
- 모바일 전용 최적화·실기기 테스트 (이번 개발 범위에서는 학생 화면도 PC 브라우저 기준으로 개발·테스트한다)

---

## 3. 핵심 흐름

### 흐름 A: 학생 질문 (학생 → 교수)

```
① 학생이 질문 입력                    예: "방금 그거 왜 0임"
② 서버가 질문 시점 기준 최근 3분 강의 인식 결과 조회
③ AI 호출 1회 (P1): 분류 + 강의 시점 매칭 + 질문 다듬기
④ 무관·부적절 → 질문 폐기(저장 안 함), 학생에게 전달 불가 안내
   관련       → 질문을 승인 대기로 저장, 학생에게 다듬은 질문 표시
⑤ 학생 [보내기] → 같은 강의 시점 묶음에 합류 (없으면 새 묶음)
   학생 [취소]   → 질문 삭제
⑥ 교수 화면 질문 목록 갱신, 학생에게 "n명이 같은 질문을 했습니다" 표시
⑦ 교수가 [질문 읽어 주기]를 누르면 가장 많은 질문을 음성으로 낭독
```

### 흐름 B: 교수 질문 (교수 → 학생)

```
① 교수 브라우저: 인식된 문장이 질문 어미 규칙에 해당하면 이후 5초간 발화 수집
② AI 호출 1회 (P2): 실제 질문 여부 판별(수사적 질문 제외) + 문항 정리 + 형식·선택지 생성
③ 교수 화면 알림 "학생들에게 보낼까요?" [보내기] / [무시]
④ 학생 화면에 문항과 남은 시간 표시 (기본 45초), 학생 익명 응답 (1인 1회)
⑤ 시간 종료 또는 [마감] → 서버가 답변 분포 계산
⑥ AI 호출 1회 (P3): 흔한 오해, 다시 설명할 내용, 음성 요약문
⑦ 교수 화면 결과 표시, 교수가 [요약 읽어 주기]를 누르면 음성 낭독
```

---

## 4. 기능 요구사항 (FR)

우선순위: **P0** = 없으면 시연 불가, **P1** = 가능하면, **P2** = 여유 있으면
괄호 안은 기획서 기능 번호.

### 4.1 수업방

| ID | 요구사항 | 우선 |
|---|---|---|
| FR-R1 | 교수는 수업 제목을 입력해 수업방을 만든다. 4자리 영숫자 방 코드가 생성된다 (P-1) | P0 |
| FR-R2 | 교수 화면에 방 코드와 접속용 QR 코드를 표시한다 (P-1) | P0 |
| FR-R3 | 학생은 QR 또는 방 코드로 로그인 없이 입장한다 (S-1) | P0 |
| FR-R4 | 학생 첫 입장 시 익명 ID(`crypto.randomUUID()`)를 만들어 localStorage에 저장한다. 1인 1회 응답 확인에만 쓰고 화면에 표시하지 않는다 | P0 |
| FR-R5 | 교수는 교안 PDF를 업로드할 수 있고, 서버는 핵심 용어를 추출해 용어집으로 저장한다 (P-2, 필수 여부 D-1) | P1 |
| FR-R6 | 교수는 용어집(키워드)을 직접 입력할 수 있다 | P1 |
| FR-R7 | 교수가 [수업 종료]를 누르면 강의 인식 결과를 삭제하고 수업방을 종료 상태로 바꾼다 | P1 |

### 4.2 강의 음성 인식

| ID | 요구사항 | 우선 |
|---|---|---|
| FR-T1 | 교수 화면에서 Web Speech API(`ko-KR`)로 강의 음성을 실시간 인식한다 (P-3) | P0 |
| FR-T2 | 확정(final) 문장만 서버에 저장한다. 시각은 서버(DB)가 기록한다 | P0 |
| FR-T3 | **인식 결과(자막)는 화면에 표시하지 않는다.** 인식 동작 상태(🟢 인식 중 / 🔴 중단)만 표시한다 | P0 |
| FR-T4 | 인식이 끊기면 자동으로 재시작한다 | P0 |
| FR-T5 | 가짜 강의 모드: 대본 JSON을 정해진 간격으로 강의 인식 결과에 넣는다 (숨김 버튼) | P0 |

### 4.3 흐름 A: 학생 질문

| ID | 요구사항 | 우선 |
|---|---|---|
| FR-A1 | 학생은 자유 텍스트로 질문한다. "ㅁㄹ", "?" 같은 짧은 입력도 허용한다 (S-2) | P0 |
| FR-A2 | 서버는 질문 1건당 AI를 1회 호출해 분류(관련/무관/부적절), 강의 시점 매칭, 질문 다듬기를 한다 | P0 |
| FR-A3 | 무관·부적절이면 질문을 저장하지 않고 폐기하며, "수업과 관련된 질문만 보낼 수 있습니다"를 안내한다 (S-4) | P0 |
| FR-A4 | 관련이면 다듬은 질문을 학생에게 보여 주고 [보내기]·[취소]를 받는다. **강의 원문은 보여 주지 않는다** (S-3) | P0 |
| FR-A5 | 확신도가 `LOW_CONFIDENCE` 미만이면 다듬은 질문 후보 2~3개 중에서 고르게 한다 (S-3) | P1 |
| FR-A6 | [보내기]된 질문은 강의 시점 기준으로 묶는다 (§8.3 묶기 규칙) | P0 |
| FR-A7 | [취소]된 질문은 삭제한다 | P0 |
| FR-A8 | 학생은 자기 질문과 같은 묶음의 인원을 본다 ("12명이 같은 질문을 했습니다") (S-5) | P0 |
| FR-A9 | AI 호출 실패·시간 초과 시 원문을 그대로 전달하고 "AI 정리 없이 전달되었습니다"를 안내한다 | P0 |

### 4.4 교수 화면: 질문 수신

| ID | 요구사항 | 우선 |
|---|---|---|
| FR-P1 | 질문 묶음을 인원 내림차순으로 표시한다 (대표 질문, 인원) (P-4) | P0 |
| FR-P2 | [질문 읽어 주기]를 눌렀을 때에만, 아직 읽지 않은 묶음 중 인원이 가장 많은 묶음을 음성으로 읽는다 (P-5) | P0 |
| FR-P3 | 묶음 인원이 3, 5, 10이 될 때 대표 질문을 AI로 다시 쓴다 | P2 |

### 4.5 흐름 B: 교수 질문

| ID | 요구사항 | 우선 |
|---|---|---|
| FR-B1 | 확정 문장이 질문 어미 규칙에 해당하면 5초간 이후 발화를 모아 서버에 판별을 요청한다 | P0 |
| FR-B2 | AI가 실제 질문/수사적 질문을 판별하고, 실제 질문이면 문항·형식·선택지·예상 정답을 만든다 | P0 |
| FR-B3 | 교수 화면에 "학생들에게 보낼까요?" 알림과 [보내기]·[무시]를 표시한다 (P-6) | P0 |
| FR-B4 | 교수는 감지와 별도로 질문을 직접 입력해 보낼 수 있다 (P-7) | P1 |
| FR-B5 | [보내기] 시 학생 화면 상단에 문항과 남은 시간을 표시한다 (기본 45초) (S-6) | P0 |
| FR-B6 | 학생은 1인 1회 응답한다. 선택형의 마지막 선택지는 항상 "모르겠어요" (S-6) | P0 |
| FR-B7 | 시간 종료 또는 [마감] 시 답변 분포를 서버 코드로 계산한다 (P-8) | P0 |
| FR-B8 | AI가 흔한 오해(최대 2개), 다시 설명할 내용 1문장, 음성 요약문을 만든다 (P-8) | P0 |
| FR-B9 | [요약 읽어 주기]를 눌렀을 때에만 음성 요약문을 낭독한다 (P-8) | P0 |
| FR-B10 | 교수 질문이 진행 중일 때 새로 감지된 질문은 보류했다가 마감 후 알린다 | P1 |

---

## 5. 비기능 요구사항 (NFR)

| ID | 항목 | 기준 |
|---|---|---|
| NFR-1 | 응답 속도 | 학생 질문 입력 → 승인 화면 평균 3초 이내 |
| NFR-2 | 실시간성 | 교수·학생 화면 갱신 지연 2초 이내 (Realtime, 장애 시 2초 주기 조회) |
| NFR-3 | 동시 접속 | 한 수업방에 학생 50명까지 시연 가능 |
| NFR-4 | 브라우저 | 교수: 데스크톱 크롬 (Web Speech API). 학생: 데스크톱 크롬 (모바일 최적화는 범위 외) |
| NFR-5 | 보안 | AI API 키와 Supabase service role 키는 서버에서만 사용 |
| NFR-6 | 장애 대응 | AI·음성 인식·네트워크 각각에 대체 동작 (§10.3) |
| NFR-7 | 언어 | UI·프롬프트·음성 모두 한국어 |

---

## 6. 시스템 구조

### 6.1 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js (App Router) + TypeScript + Tailwind CSS |
| 배포 | Vercel |
| DB·실시간 | Supabase (PostgreSQL + Realtime) |
| AI | `lib/llm.ts`에서 공급자 전환. 응답 속도 기준 가장 빠른 소형 모델 (D-2) |
| 음성 인식 | Web Speech API (교수 브라우저) |
| 음성 출력 | `speechSynthesis` (교수 브라우저, 교수 요청 시에만) |
| PDF 텍스트 추출 | `pdf-parse` |
| QR | `qrcode.react` |

### 6.2 구성도

```
┌──────────────── 교수 화면 /prof/[room] ─────────────────┐
│ 마이크 → Web Speech API (결과 미표시, 상태만 🟢/🔴)        │
│  ├─ 확정 문장 ──────────────▶ POST /api/transcript        │
│  └─ 질문 어미 감지 → 5초 대기 ▶ POST /api/prof-q/detect    │
│ 질문 목록 · [질문 읽어 주기] · 교수 질문 패널 · [요약 읽어 주기] │
└──────────────────────────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   Supabase DB    │◀── Realtime / 2초 주기 조회
                   └────────▲────────┘
                            │
┌──────────────── 학생 화면 /s/[room] ────────────────────┐
│ 질문 → POST /api/question → 승인 → POST /api/question/confirm │
│ 교수 질문 카드 → POST /api/answer                             │
└──────────────────────────────────────────────────────────┘
```

### 6.3 폴더 구조

```
/app
  page.tsx                        시작 (수업 만들기 / 수업 참여)
  prof/[room]/page.tsx            교수 화면
  s/[room]/page.tsx               학생 화면
  api/room/route.ts               POST 수업방 생성
  api/room/material/route.ts      POST 교안 PDF 업로드 → 용어집
  api/room/end/route.ts           POST 수업 종료
  api/transcript/route.ts         POST 강의 인식 문장 저장
  api/question/route.ts           POST 학생 질문 (AI 1회)
  api/question/confirm/route.ts   POST 보내기/취소 → 묶기
  api/cluster/read/route.ts       POST 낭독한 묶음 표시
  api/prof-q/detect/route.ts      POST 교수 질문 판별
  api/prof-q/open/route.ts        POST 학생에게 보내기 / 직접 질문
  api/prof-q/dismiss/route.ts     POST 무시
  api/prof-q/close/route.ts       POST 마감 + 분석
  api/answer/route.ts             POST 학생 응답
/components/prof/*                교수 화면 컴포넌트
/components/student/*             학생 화면 컴포넌트
/components/ui/*                  공용 컴포넌트
/lib
  types.ts                        공용 타입 (★ 계약)
  config.ts                       설정값 (★ 계약)
  llm.ts                          AI 호출
  prompts.ts                      프롬프트 (docs/PROMPTS.md와 동기화)
  context.ts                      최근 강의 인식 결과 조회·포맷
  cluster.ts                      묶기 로직
  speech.ts                       음성 인식·음성 출력 훅
  supabase/server.ts, client.ts
  mock.ts                         백엔드 완성 전 프론트용 목 데이터
/supabase/schema.sql
/scripts
  demo-lecture.json               가짜 강의 대본
  eval/*.json, eval.ts            평가
```

---

## 7. 데이터 모델

전체 SQL은 `supabase/schema.sql`.

| 테이블 | 용도 | 주요 컬럼 |
|---|---|---|
| `rooms` | 수업방 | id(방 코드), title, glossary[], material_text, status(live/ended) |
| `transcripts` | 강의 인식 문장 (**수업 종료 시 삭제**) | id, room_id, text, created_at |
| `questions` | 학생 질문 (승인 대기·전송됨) | anon_id, raw, refined, ref_line_ids[], candidates, confidence, status, cluster_id |
| `clusters` | 질문 묶음 | title, ref_line_ids[], count, read_aloud |
| `prof_questions` | 교수 질문 | spoken, question, type, options, expected_answer, status, closes_at, summary |
| `answers` | 학생 응답 (1인 1회) | prof_question_id, anon_id, answer |

뷰: `answer_counts` (교수 질문별 응답 수)

서버 전용 함수 (API route에서 service role로 `rpc` 호출, anon 실행 권한 없음):

| 함수 | 용도 |
|---|---|
| `recent_lines(p_room, p_sec)` | 최근 `p_sec`초 강의 인식 문장과 `ago_sec`(DB `now()` 기준 몇 초 전) |
| `join_cluster(p_room, p_qid, p_title, p_refs)` | 묶기 규칙 1~3 적용 + 인원 증가 + 질문 `sent` 처리를 방 단위 잠금으로 한 번에 |
| `prof_q_answerable(p_id)` | `status='open'`이고 `closes_at`이 지나지 않았는지 (DB 시각 기준) |

- 무관·부적절 판정 질문은 **어떤 테이블에도 저장하지 않는다.**
- 강의 문장 원문은 `transcripts`에만 있고, 묶음에는 문장 번호(`ref_line_ids`)만 저장한다. 수업 종료 시 강의 내용이 남지 않도록 하기 위함이다.

### 상태 값

- `questions.status`: `pending`(승인 대기) → `sent`. [취소] 시 행 삭제
- `prof_questions.status`: `pending`(교수 확인 대기) → `open` → `closed` | `dismissed`
- `rooms.status`: `live` → `ended`

### 공용 타입 (`lib/types.ts`)

```ts
export type QuestionCategory = '관련' | '무관' | '부적절';

export interface QuestionReview {          // 학생 승인 화면용
  id: number;
  refined: string;
  confidence: number;
  candidates: string[];                    // 다듬은 질문 후보 (확신도 낮을 때)
}

export interface Cluster {
  id: number; room_id: string; title: string;
  ref_line_ids: number[];
  count: number; read_aloud: boolean; updated_at: string;
}

export type ProfQType = 'choice' | 'short' | 'open';
export type ProfQStatus = 'pending' | 'open' | 'closed' | 'dismissed';

export interface ProfQuestion {
  id: number; room_id: string; spoken: string | null;
  question: string; type: ProfQType; options: string[] | null;
  expected_answer: string | null; status: ProfQStatus;
  closes_at: string | null; summary: ProfQSummary | null;
}

export interface ProfQSummary {
  total: number;
  distribution: { label: string; count: number; ratio: number }[];
  misconceptions: { text: string; ratio: number; line_ids: number[] }[];
  suggestion: string | null;
  spoken_summary: string;
}

export type ApiError = { error: { code: string; message: string } };
```

---

## 8. API 명세

공통:

- 요청·응답은 JSON (PDF 업로드만 multipart). 실패 시 `ApiError` + HTTP 상태 코드
- 거르기 판정은 오류가 아니라 정상 응답(200)
- 모든 시각은 DB `now()` 기준

### 8.1 수업방

**`POST /api/room`**
```jsonc
// req
{ "title": "선형대수 3주차", "glossary": ["고유벡터", "고윳값"] }   // glossary 선택
// res 200
{ "roomId": "K7Q2" }
```

**`POST /api/room/material`** (multipart: `roomId`, `file`)
```jsonc
// res 200 — PDF 텍스트 추출 → P6 → rooms.glossary 저장
{ "glossary": ["고유벡터", "고윳값", "람다", "특성방정식"] }
```

**`POST /api/room/end`**
```jsonc
// req
{ "roomId": "K7Q2" }
// res 200 — transcripts 삭제, status='ended'
{ "ok": true }
```

### 8.2 강의 인식

**`POST /api/transcript`**
```jsonc
// req
{ "roomId": "K7Q2", "text": "그래서 A에서 람다 I를 빼고 행렬식을 0으로 놓습니다" }
// res 200
{ "id": 43 }
```

### 8.3 학생 질문

**`POST /api/question`**
```jsonc
// req
{ "roomId": "K7Q2", "anonId": "uuid", "raw": "방금 그거 왜 0임" }

// res 200 — 관련: 승인 대기
{ "status": "review",
  "question": { "id": 101,
    "refined": "방금 행렬식을 0으로 놓으신 이유를 다시 설명해 주실 수 있나요?",
    "confidence": 0.85, "candidates": [] } }

// res 200 — 무관·부적절: 폐기 (저장 안 함)
{ "status": "rejected", "message": "수업과 관련된 질문만 보낼 수 있습니다" }

// res 200 — AI 실패: 원문 그대로 전송됨
{ "status": "sent", "fallback": true, "message": "AI 정리 없이 전달되었습니다",
  "questionId": 101, "clusterId": 9, "count": 1 }
```

처리 순서:
1. 최근 `CONTEXT_WINDOW_SEC` 강의 인식 결과 + 용어집 조회
2. 프롬프트 P1로 AI 1회 호출
3. `category`가 무관·부적절 → 저장 없이 `rejected` 응답
4. AI 실패 → 원문을 `sent`로 저장하고 묶기 (강의 시점 없음)
5. 관련 → 검증(§PROMPTS P1) 후 `questions(status='pending')` 저장, `review` 응답
   - 학생에게는 `ref_line_ids`를 보내지 않는다

**`POST /api/question/confirm`**
```jsonc
// req
{ "questionId": 101, "anonId": "uuid", "action": "send" }
{ "questionId": 101, "anonId": "uuid", "action": "send", "candidateIndex": 1 }   // 후보 선택
{ "questionId": 101, "anonId": "uuid", "action": "cancel" }
// res 200
{ "clusterId": 7, "count": 12 }    // send
{ "ok": true }                     // cancel (행 삭제)
// res 403 — anonId 불일치
{ "error": { "code": "FORBIDDEN", "message": "본인 질문만 처리할 수 있습니다" } }
```

**묶기 규칙 (`lib/cluster.ts`)**
1. `ref_line_ids`가 겹치는 기존 묶음이 있으면 합류 (강의 시점 기준)
2. 강의 시점이 없는 질문은 새 묶음 (P2: 프롬프트 P4로 의미 기반 합류)
3. 새 묶음의 `title`은 `refined`
4. 후보를 고른 경우 `refined`를 그 후보로 바꾼 뒤 묶는다
5. 1~3은 DB 함수 `join_cluster`로 한 번에 처리한다 (동시 [보내기]에도 인원이 꼬이지 않게)

**`POST /api/cluster/read`** (교수 화면 [질문 읽어 주기] 후 호출)
```jsonc
// req
{ "clusterId": 7 }
// res 200 — read_aloud=true
{ "ok": true }
```

### 8.4 교수 질문

**`POST /api/prof-q/detect`** (교수 브라우저가 호출)
```jsonc
// req
{ "roomId": "K7Q2", "spoken": "자 그럼 이 행렬은 고윳값이 몇 개일까요", "after": "옆 사람이랑 잠깐 생각해 보세요" }
// res 200
{ "detected": true, "profQuestionId": 12 }      // status='pending' 저장
{ "detected": false }
```
- 진행 중(`open`)인 교수 질문이 있으면 `pending`으로 저장만 하고, 교수 화면은 마감 후 알린다 (FR-B10)

**`POST /api/prof-q/open`**
```jsonc
// 감지된 질문 보내기
{ "profQuestionId": 12, "durationSec": 45 }
// 직접 질문하기 (FR-B4)
{ "roomId": "K7Q2", "question": "…", "type": "choice", "options": ["…", "모르겠어요"], "durationSec": 45 }
// res 200
{ "profQuestionId": 12, "closesAt": "2026-10-10T05:12:45Z" }
```

**`POST /api/prof-q/dismiss`** `{ "profQuestionId": 12 }` → `{ "ok": true }`

**`POST /api/prof-q/close`**
```jsonc
// req
{ "profQuestionId": 12 }
// res 200
{ "summary": { "total": 42,
  "distribution": [{ "label": "2개", "count": 29, "ratio": 0.69 }],
  "misconceptions": [{ "text": "행렬 크기와 고윳값 개수를 같다고 생각함", "ratio": 0.2, "line_ids": [52] }],
  "suggestion": "고윳값 개수는 특성방정식의 해의 개수라는 점을 다시 설명해 주세요",
  "spoken_summary": "69%가 2개라고 답했습니다. 20%는 행렬 크기와 고윳값 개수를 혼동했습니다." } }
```
- 분포는 코드로 계산, AI(P3)는 오해·추천·요약문만
- P3 실패 시 `misconceptions: []`, `suggestion: null`, `spoken_summary`는 분포로 코드 생성
- 시간 종료 시 교수 화면이 자동으로 호출한다

**`POST /api/answer`**
```jsonc
// req
{ "profQuestionId": 12, "anonId": "uuid", "answer": "2개" }
// res 200
{ "ok": true }
// res 409
{ "error": { "code": "ALREADY_ANSWERED", "message": "이미 응답했습니다" } }
// res 410
{ "error": { "code": "CLOSED", "message": "마감된 질문입니다" } }
```

### 8.5 읽기 (화면에서 Supabase 직접 조회)

| 화면 | 구독·조회 대상 |
|---|---|
| 교수 | `clusters`(count 내림차순), `prof_questions`(최근), 뷰 `answer_counts` |
| 학생 | `prof_questions`(status='open'), 내 질문의 묶음 인원(`clusters` by id) |

- 읽기는 anon 키 + RLS select 허용. **쓰기는 모두 API route(service role)** 를 거친다
- `questions`, `answers`는 원문·익명 ID 보호를 위해 anon 읽기를 막는다. 학생의 "내 질문" 목록은 API 응답(질문 id, 다듬은 질문, clusterId)을 localStorage에 보관해 그린다
- 뷰 `answer_counts`는 Realtime이 되지 않으므로 주기 조회한다

---

## 9. 화면 명세

### 9.1 시작 `/`

- [수업 만들기] → 제목, 교안 PDF(선택), 용어집(선택) → `/prof/[room]`
- [수업 참여] → 4자리 코드 → `/s/[room]`

### 9.2 학생 `/s/[room]`

| 영역 | 내용 |
|---|---|
| 상단 | 수업 제목, 연결 상태 |
| 교수 질문 카드 | `open` 질문이 있을 때만 최상단. 선택지 버튼 또는 입력창, 남은 시간 막대, 응답 후 "제출 완료" |
| 내 질문 목록 | 다듬은 질문 + "n명이 같은 질문을 했습니다" |
| 하단 입력 | 질문 입력창 + 전송 |
| 승인 창 | "이렇게 보낼까요?" + 다듬은 질문 + [보내기] [취소]. 후보가 있으면 후보 문장 버튼 |
| 안내 | 전달 불가·AI 미정리 안내 문구 |

### 9.3 교수 `/prof/[room]` (노트북·프로젝터)

| 영역 | 내용 |
|---|---|
| 상단 바 | 방 코드, QR, 음성 인식 상태(🟢/🔴), [질문 읽어 주기], [수업 종료], (숨김) 가짜 강의 모드 |
| 질문 목록 | 인원, 대표 질문 (인원 내림차순) |
| 교수 질문 패널 | 감지 알림 [보내기]/[무시], [직접 질문하기], 진행 중 남은 시간·응답 수·[마감], 결과(분포 막대, 흔한 오해, 다시 설명할 내용, [요약 읽어 주기]) |

- **자막, 걸러진 메시지 수, 막힘 알림은 표시하지 않는다**
- 음성은 [질문 읽어 주기], [요약 읽어 주기]를 눌렀을 때에만 출력한다

---

## 10. 정책

### 10.1 거르기

- **AI 판정으로만** 거른다. 규칙 기반 필터는 사용하지 않는다
- 판정 기준 (P1):
  - 수업·과제·시험·수업 운영 관련 → **관련** ("시험에 나와요?", "과제 마감 언제예요?" 포함)
  - 수업과 무관한 잡담 → **무관**
  - 욕설·조롱·비하 → **부적절**
  - **판단이 애매하면 관련.** 정상 질문의 누락을 더 큰 문제로 본다
- 무관·부적절 질문은 저장하지 않고 즉시 폐기한다. 차단 기록·통계도 남기지 않는다
- 짧은 입력("ㅁㄹ", "?", "모르겠어요", "다시")은 가장 최근 설명을 이해하지 못한 것으로 해석한다

### 10.2 데이터 처리

| 데이터 | 처리 |
|---|---|
| 강의 음성 | 저장하지 않는다 |
| 강의 인식 결과 | 수업 중에만 저장, 수업 종료 시 삭제 |
| 거르기로 제외된 질문 | 저장하지 않고 즉시 폐기 |
| 승인 대기 질문 | 저장. [취소] 시 삭제 |
| 전송된 질문 | 저장. 교수 화면에는 다듬은 질문만 표시, 원문 미표시 |
| 학생 식별 정보 | 수집하지 않음. 기기별 익명 ID만 내부 사용, 화면 미표시 |

### 10.3 예외 처리

| 상황 | 처리 |
|---|---|
| AI 실패·시간 초과 (학생 질문) | 원문 그대로 전송 + "AI 정리 없이 전달되었습니다" |
| AI 실패 (교수 질문 감지) | 해당 감지 무시. 직접 입력으로 대체 가능 |
| AI 실패 (응답 분석) | 분포만 표시, 요약문은 코드로 생성 |
| 강의 인식 결과 없음 (수업 초반) | 강의 시점 없이 질문 처리 |
| 음성 인식 중단 | 자동 재시작 + 🔴 표시, 안 되면 가짜 강의 모드 |
| 교수 질문 진행 중 새 감지 | 마감 후 알림 |
| Realtime 불안정 | 2초 주기 조회로 전환 |
| 네트워크 장애 (시연) | 백업 수업방 → 녹화 영상 |

---

## 11. 설정값과 결정 필요 사항

### 11.1 설정값 (`lib/config.ts`)

| 키 | 기본값 | 설명 |
|---|---|---|
| `CONTEXT_WINDOW_SEC` | 180 | 질문 해석에 쓰는 최근 강의 인식 범위 (D-3) |
| `CONTEXT_GRACE_SEC` | 5 | 질문 시각 이후 여유 (인식 지연 보정) |
| `PROFQ_CONTEXT_SEC` | 120 | 교수 질문 판별용 맥락 범위 |
| `PROFQ_WAIT_MS` | 5000 | 질문 후보 뒤 이후 발화 수집 시간 |
| `PROFQ_DURATION_SEC` | 45 | 교수 질문 응답 시간 (D-4) |
| `LOW_CONFIDENCE` | 0.6 | 이 값 미만이면 후보 표시 |
| `LLM_TIMEOUT_MS` | 8000 | AI 제한 시간 |
| `POLL_INTERVAL_MS` | 2000 | 주기 조회 간격 |
| `USE_REALTIME` | true | false면 주기 조회 |

### 11.2 결정 필요 사항

확정하면 ✅와 날짜를 적고 기획서(PROPOSAL.md §8)도 함께 고친다.

| # | 항목 | 선택지 | 기본안 | 상태 |
|---|---|---|---|---|
| D-1 | 교안 PDF 업로드 필수 여부 | 필수 / 선택 | 선택 (시점 매칭은 음성 인식으로 수행, PDF는 용어 보정용) | ⬜ |
| D-2 | AI 모델 | gpt-4o-mini / Claude Haiku 등 | 응답 속도 측정 후 결정 | ⬜ |
| D-3 | 강의 내용 조회 범위 | 2분 / 3분 / 4분 | 3분 | ⬜ |
| D-4 | 교수 질문 응답 시간 | 30초 / 45초 / 60초 | 45초 | ⬜ |

확정된 사항: 서비스명 **갸웃** ✅

---

## 12. 평가 계획

| ID | 테스트 | 데이터 | 지표 |
|---|---|---|---|
| E1 | 강의 시점 매칭 | 가짜 강의 + 모호한 질문 30개, 정답 문장 번호 | 적중률 |
| E2 | 교수 질문 감지 | 문장 40개 (실제 질문 15 / 수사적 질문 15 / 일반 문장 10) | 정밀도·재현율 |
| E3 | AI 거르기 | 무관·부적절 15개 + 경계 사례 15개 ("시험에 나와요?", "ㅁㄹ", "?") | 제외율 / 오제외율 |
| E4 | 응답 속도 | 질문 입력 → 승인 화면 20회 | 평균·최대 |

`scripts/eval.ts`로 실행하고 결과를 `docs/EVAL_RESULTS.md`에 기록한다.

---

## 13. 용어 정리

| 용어 | 뜻 |
|---|---|
| 강의 인식 결과 (transcript) | 교수 음성을 실시간으로 글자로 바꾼 것. 문장 단위로 저장하며 화면에 표시하지 않음 |
| 강의 시점 매칭 | "방금 그거", "아까 그 공식"이 강의의 어느 문장인지 찾는 것 |
| 묶음 (cluster) | 같은 강의 시점(또는 같은 의미)의 질문 모음 |
| 승인 | AI가 다듬은 질문을 학생이 확인하고 [보내기]하는 것 |
| 교수 질문 | 교수가 말로 던진 질문 중 AI가 감지해 학생에게 보내는 것 |
| 수사적 질문 | 교수가 스스로 답하는 질문. 학생에게 보내지 않음 |
| 가짜 강의 모드 | 대본 파일로 강의 인식을 흉내 내는 개발·시연 도구 |
