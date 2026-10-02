# 태스크 분배 계획 (v1.0)

> 기획서: `docs/PROPOSAL.md` · 명세: `docs/SPEC.md` · 프롬프트: `docs/PROMPTS.md` · 협업 규칙: `CONTRIBUTING.md`
> 기준 일정: **약 24시간 해커톤.** 기간이 다르면 마일스톤 시간을 비율로 조정한다.

---

## 1. 분배 방법

### 원칙: 역할(영역)별 + 파일 소유권 + 계약 우선 + 목 데이터

| 원칙 | 내용 | 이유 |
|---|---|---|
| **역할별 분배** | 교수 화면 / 학생 화면 / 백엔드 / AI·품질 | 4명이 서로 다른 폴더를 맡아 병합 충돌이 거의 없다 |
| **파일 소유권** | 폴더마다 담당자 1명 (아래 표) | 다른 사람의 파일을 고칠 때는 담당자에게 알리고 PR 리뷰를 요청한다 |
| **계약 우선** | 첫 1~2시간에 `types.ts`, API 요청·응답, DB 스키마를 전원 합의로 고정 | 이후 각자 독립적으로 개발할 수 있다 |
| **목 데이터** | 프론트는 `lib/mock.ts`로 먼저 화면을 완성하고, API가 준비되면 교체 | 백엔드를 기다리느라 멈추지 않는다 |

기능별 분배(흐름 A 담당, 흐름 B 담당)는 권장하지 않는다. 두 흐름이 같은 화면과 API 파일을 수정하므로 충돌이 잦다.

### 역할과 파일 소유권

| 역할 | 담당자 | 소유 폴더·파일 |
|---|---|---|
| **P · 교수 화면** | (이름) | `app/prof/**`, `components/prof/**`, `lib/speech.ts`, 가짜 강의 모드 재생 로직 |
| **S · 학생 화면** | (이름) | `app/page.tsx`, `app/s/**`, `components/student/**`, `components/ui/**` |
| **B · 백엔드** | (이름) | `app/api/**`, `lib/supabase/**`, `lib/cluster.ts`, `supabase/schema.sql`, 배포 |
| **A · AI·품질** | (이름) | `lib/llm.ts`, `lib/prompts.ts`, `lib/context.ts`, `scripts/demo-lecture.json`, `scripts/eval*`, `docs/PROMPTS.md`, 발표 자료 |
| **공동 (계약)** | B 관리, 전원 리뷰 | `lib/types.ts`, `lib/config.ts`, `lib/mock.ts`, `docs/SPEC.md` |

### 연결 지점

```
A ──(llm.ts, prompts.ts, context.ts)──▶ B (API route에서 호출)
B ──(API, DB)────────────────────────▶ P, S (화면에서 호출·구독)
P ──(강의 인식 문장, 교수 질문 후보)──▶ B
공동 계약(types.ts, config.ts) ◀── 전원 import
```

**함수 계약 (A → B)**: A가 시그니처만 있는 함수를 먼저 올리고, B는 이를 호출하는 코드를 바로 작성한다.

```ts
// lib/context.ts
export async function recentLines(roomId: string, at: Date, seconds?: number): Promise<TranscriptLine[]>;
export function formatLines(lines: TranscriptLine[], at: Date): string;
// lib/llm.ts
export async function askJSON<T>(system: string, user: string, timeoutMs?: number): Promise<T | null>;
// lib/prompts.ts
export async function interpretQuestion(input: P1Input): Promise<P1Result | null>;   // P1
export async function judgeProfQuestion(input: P2Input): Promise<P2Result | null>;   // P2
export async function analyzeAnswers(input: P3Input): Promise<P3Result | null>;      // P3
export async function extractGlossary(text: string): Promise<string[] | null>;       // P6
```

---

## 2. 마일스톤

| 마일스톤 | 시간 | 목표 | 완료 기준 (전원 확인) |
|---|---|---|---|
| **M0 킥오프** | 0 ~ 1.5h | 저장소·계약 고정 | 배포 URL이 휴대폰에서 열림, 스키마 적용, `types.ts`·`config.ts`·`mock.ts` 병합, D-1~D-4 기본안 합의 |
| **M1 뼈대** | ~ 6h | 목 데이터로 화면·API 뼈대 | 교수·학생 화면이 목 데이터로 표시됨, 강의 인식 문장이 DB에 저장됨, AI 호출 함수 동작 |
| **M2 흐름 A 연결** | ~ 10h | 학생 질문 전 과정 | 휴대폰에서 "방금 그거" → 다듬은 질문 승인 → 교수 화면 묶음 → [질문 읽어 주기] 낭독 |
| **M3 흐름 B 연결** | ~ 14h | 교수 질문 전 과정 | 발화 → 감지 알림 → 보내기 → 휴대폰 응답 → 분포·오해 → [요약 읽어 주기] 낭독 |
| **M4 보완·평가** | ~ 20h | P1 기능, 평가 수치 | PDF 용어 추출·직접 질문·수업 종료 동작, E1~E4 결과 기록 |
| **M5 시연 준비** | ~ 24h | 리허설 | 리허설 3회, 백업 수업방·녹화 영상, **신규 기능 금지** |

**점검 규칙**
- M2가 10시간 안에 끝나지 않으면 → 후보 선택(FR-A5)을 보류하고 [보내기]/[취소]만 구현
- M3가 16시간 안에 끝나지 않으면 → 시연은 가짜 강의 모드로 감지를 보여 주고, 직접 질문 입력(T-17)을 대체 수단으로 확보
- 마일스톤마다 **5분 점검 회의**: 완료한 것 / 막힌 것 / 다음 할 것

---

## 3. 태스크 목록

표기: `T-번호` · 역할 · 우선순위 · 의존 = 먼저 끝나야 하는 태스크

### M0 킥오프

| ID | 역할 | 우선 | 태스크 | 의존 | 완료 기준 |
|---|---|---|---|---|---|
| T-00 | B | P0 | 저장소 생성, Next.js(TS·Tailwind·App Router) 초기화, Vercel·Supabase 연결, `.env` 공유 | - | main 배포 URL이 HTTPS로 열림 |
| T-01 | B | P0 | `supabase/schema.sql` 적용, Realtime 활성화 | T-00 | 테이블 6개 + 뷰 1개 확인 |
| T-02 | B+전원 | P0 | `lib/types.ts`, `lib/config.ts`, `lib/supabase/{server,client}.ts`, `lib/mock.ts` 작성·리뷰 | T-00 | 전원 승인 후 병합 |
| T-03 | 전원 | P0 | SPEC §11.2 결정 사항 D-1~D-4 기본안 합의 (15분) | - | SPEC·PROPOSAL에 반영 |
| T-04 | A | P0 | `lib/context.ts`, `lib/llm.ts`, `lib/prompts.ts` **시그니처만** 있는 함수 커밋 | T-02 | B가 import 가능 |

### P · 교수 화면

| ID | 우선 | 태스크 | 의존 | 완료 기준 |
|---|---|---|---|---|
| T-10 | P0 | `/prof/[room]` 레이아웃 (상단 바, 질문 목록, 교수 질문 패널), 방 코드·QR. 자막 영역 없음 | T-02 | 목 데이터로 전체 화면 표시 |
| T-11 | P0 | `lib/speech.ts`: 음성 인식 훅 (ko-KR, final → `/api/transcript`, 자동 재시작, 🟢/🔴 상태만 표시, 인식 결과 미표시) | T-31 | 30초 말하면 DB에 문장 저장, 화면에 문장이 보이지 않음 |
| T-12 | P0 | 가짜 강의 모드: `scripts/demo-lecture.json`을 delay대로 `/api/transcript`에 전송 (숨김 버튼) | T-31 | 마이크 없이 인식 결과가 쌓임 |
| T-13 | P0 | 질문 목록: Realtime 구독 + 주기 조회 전환, 인원 내림차순 | T-33 | 학생 질문 후 2초 안에 갱신 |
| T-14 | P0 | `speak()` + [질문 읽어 주기]: 버튼을 눌렀을 때만 안 읽은 묶음 중 최대 인원 낭독, `read_aloud` 표시 | T-13 | 버튼 없이는 음성이 나오지 않음 |
| T-15 | P0 | 교수 질문 후보 감지: 어미 정규식 + 5초 이후 발화 수집 → `/api/prof-q/detect` | T-11, T-34 | 대본의 실제 질문에만 알림 |
| T-16 | P0 | 교수 질문 패널: 감지 알림 [보내기]/[무시], 남은 시간·응답 수, [마감](시간 종료 시 자동), 결과(분포 막대·흔한 오해·다시 설명할 내용) + [요약 읽어 주기] | T-34, T-36 | M3 완료 기준 통과 |
| T-17 | P1 | [직접 질문하기]: 문항·형식·선택지 입력 → `/api/prof-q/open` | T-16 | 직접 입력 질문이 학생 화면에 표시 |
| T-18 | P1 | [수업 종료] → `/api/room/end` | T-30 | 종료 후 transcripts 비어 있음 |

### S · 학생 화면 + 시작 화면

| ID | 우선 | 태스크 | 의존 | 완료 기준 |
|---|---|---|---|---|
| T-20 | P0 | 시작 화면: [수업 만들기](제목·용어집 → `/api/room`, PDF 선택 업로드 → `/api/room/material`) / [수업 참여](코드) | T-30 | 수업방 생성 후 교수 화면 이동 |
| T-21 | P0 | `/s/[room]` 레이아웃, 익명 ID 생성·저장, 연결 상태 | T-02 | 목 데이터로 화면 표시 |
| T-22 | P0 | 질문 입력 → `/api/question`, `review`/`rejected`/`sent(fallback)` 세 응답 처리, 안내 문구 | T-32 | 세 응답별 화면 확인 |
| T-23 | P0 | 승인 창: "이렇게 보낼까요?" + 다듬은 질문, [보내기]/[취소], 후보 문장 버튼 → `/api/question/confirm`. **강의 원문 미표시** | T-33 | 보내기 후 인원 표시, 취소 후 목록에서 사라짐 |
| T-24 | P0 | 내 질문 목록 (localStorage) + "n명이 같은 질문을 했습니다" 실시간 | T-23 | 다른 휴대폰 질문 시 인원 증가 |
| T-25 | P0 | 교수 질문 카드: open 구독, 남은 시간, 선택형·단답형·서술형, 제출, 409/410 처리 | T-35 | 1인 1회, 마감 후 비활성 |
| T-26 | P1 | 모바일 UI 다듬기 (아이폰·안드로이드 실기기), 발표 자료 디자인 지원 | T-25 | 실기기 2종 확인 |

### B · 백엔드

| ID | 우선 | 태스크 | 의존 | 완료 기준 |
|---|---|---|---|---|
| T-30 | P0 | `/api/room` (방 코드 생성·중복 확인), `/api/room/end` (transcripts 삭제, status='ended') | T-01 | SPEC §8.1 형식 |
| T-31 | P0 | `/api/transcript` | T-01 | 서버 시각으로 저장 |
| T-32 | P0 | `/api/question`: 맥락 조회 → P1 → 무관·부적절 폐기(저장 안 함) / 관련 pending 저장 / AI 실패 시 원문 전송 | T-04, T-41 | SPEC §8.3 세 가지 응답, 제외 질문이 DB에 없음 |
| T-33 | P0 | `/api/question/confirm` + `lib/cluster.ts` (send·cancel·후보 선택, 강의 시점 기준 묶기) | T-32 | 같은 문장을 가리킨 질문이 한 묶음 |
| T-34 | P0 | `/api/prof-q/detect` (P2, 진행 중 질문 있으면 보류), `/open` (감지·직접), `/dismiss` | T-42 | SPEC §8.4 |
| T-35 | P0 | `/api/answer`: 1인 1회(409), 마감(410) | T-34 | 중복·마감 처리 |
| T-36 | P0 | `/api/prof-q/close`: 분포 코드 계산 + P3 + 실패 대체 | T-35, T-43 | summary 저장 |
| T-37 | P1 | `/api/room/material`: PDF 텍스트 추출(`pdf-parse`) → P6 → glossary 저장 | T-44 | 업로드 후 용어집 저장 |
| T-38 | P0 | 시연 환경: 배포 환경 변수 점검, 백업 수업방 데이터 | M4 | 체크리스트 통과 |

### A · AI·품질

| ID | 우선 | 태스크 | 의존 | 완료 기준 |
|---|---|---|---|---|
| T-40 | P0 | `lib/llm.ts` (공급자 전환, JSON 모드, 제한 시간·null 반환), `lib/context.ts` | T-04 | 샘플 호출 성공 |
| T-41 | P0 | P1 `interpretQuestion`: 분류(관련/무관/부적절) + 시점 매칭 + 다듬기 + 결과 검증 | T-40 | 대본 기준 "방금 그거" 정답, "점심 뭐 먹지" 무관 |
| T-42 | P0 | P2 `judgeProfQuestion` + 검증 ("모르겠어요" 보정) | T-40 | 수사적 질문 제외 |
| T-43 | P0 | P3 `analyzeAnswers` + 실패 대체 | T-40 | 오해 1~2개, 정중한 요약문 |
| T-44 | P1 | P6 `extractGlossary` | T-40 | 샘플 PDF에서 용어 추출 |
| T-45 | P0 | `scripts/demo-lecture.json` 데모 대본 + 평가 데이터 E1~E3 | - | 개념 3~4개, 수사적/실제 질문 포함 |
| T-46 | P1 | `scripts/eval.ts` + `npm run eval` + `docs/EVAL_RESULTS.md` | T-41, T-42, T-45 | E1~E4 수치 출력 |
| T-47 | P1 | 평가 기반 프롬프트 개선 (PR마다 eval 결과 첨부) | T-46 | 개선 전후 수치 기록 |
| T-48 | P0 | 발표 자료 + 3분 시연 대본 + 예상 질문 답변 | M3 | 리허설 가능 |

### 여유 있으면 (P2)

| ID | 역할 | 태스크 |
|---|---|---|
| T-50 | A+B | P4 의미 기반 묶기, P5 대표 질문 다시 쓰기 (FR-P3) |

---

## 4. 시간대별 담당 요약

| 시간 | P · 교수 화면 | S · 학생 화면 | B · 백엔드 | A · AI·품질 |
|---|---|---|---|---|
| 0~1.5h | T-03 | T-03 | T-00, T-01, T-02 | T-03, T-04 |
| 1.5~6h | T-10, T-11, T-12 | T-20, T-21 | T-30, T-31 | T-40, T-45 |
| 6~10h | T-13, T-14 | T-22, T-23 | T-32, T-33 | T-41, T-42 |
| 10~14h | T-15, T-16 | T-24, T-25 | T-34, T-35, T-36 | T-43, T-44, T-46 |
| 14~20h | T-17, T-18 | T-26 | T-37, 버그 수정 | T-47, T-48 |
| 20~24h | 리허설·버그 | 리허설·버그 | T-38 | 발표 |

---

## 5. 통합 테스트 시나리오 (M2·M3 완료 확인용)

1. 노트북에서 수업방 생성 → 휴대폰 3대로 QR 입장
2. 가짜 강의 모드 재생 → 교수 화면에 인식 문장이 **표시되지 않는지** 확인
3. 휴대폰1 "방금 그거 왜 0임" → 승인 창에 다듬은 질문만 표시(강의 원문 없음) → [보내기]
4. 휴대폰2·3도 비슷한 질문 → 교수 화면 묶음 인원 3, 학생 화면 "3명이 같은 질문을 했습니다"
5. 휴대폰1 "점심 뭐 먹지" → 전달 불가 안내, DB `questions`에 저장되지 않았는지 확인
6. 휴대폰2 질문 후 [취소] → 목록·DB에서 사라짐
7. 아무 버튼도 누르지 않으면 음성이 나오지 않는지 확인 → [질문 읽어 주기] → 낭독
8. 대본의 "왜 0으로 놓을까요 / 그건 바로…" → 감지되지 않음
9. 대본의 "이 행렬은 고윳값이 몇 개일까요 / 생각해 보세요" → 감지 알림 → [보내기]
10. 휴대폰 3대 응답 → 마감 → 분포 + 흔한 오해 → [요약 읽어 주기]
11. [수업 종료] → transcripts 삭제 확인
