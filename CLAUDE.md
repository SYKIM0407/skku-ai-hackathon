# CLAUDE.md

이 저장소에서 작업하는 Claude Code를 위한 안내입니다. 작업 전에 반드시 읽고 따르세요.

## 프로젝트

**갸웃**: 수업을 함께 듣고, 학생과 교수 사이에서 대신 손을 들어 주는 AI. 해커톤(주제: 더 나은 캠퍼스를 위한 AI) 프로젝트. 팀 저장소: `SYKIM0407/skku-ai-hackathon`

- 흐름 A (학생 → 교수): 학생의 모호한 질문("방금 그거 뭐임")을 AI 1회 호출로 분류·강의 시점 매칭·다듬기 → 학생이 다듬은 질문을 승인 → 강의 시점 기준으로 묶어 교수 화면에 표시 → 교수가 요청하면 음성 낭독
- 흐름 B (교수 → 학생): 교수가 말로 한 질문을 감지 → 교수 확인 후 학생 화면으로 전송 → 익명 응답 → 분포·흔한 오해 → 교수가 요청하면 음성 낭독
- 거르기: AI 판정(관련/무관/부적절)으로만 수행. 무관·부적절 질문은 저장하지 않고 폐기

## 먼저 읽을 문서

| 문서 | 내용 |
|---|---|
| `docs/PROPOSAL.md` | **기획서 (최상위 기준).** 다른 문서와 다르면 기획서를 따른다 |
| `docs/SPEC.md` | 기능 요구사항(FR-*), 데이터 모델, **API 요청·응답 형식**, 정책, 설정값 |
| `docs/PROMPTS.md` | AI 프롬프트 P1~P6 원문과 출력 형식 |
| `docs/TASKS.md` | 태스크 T-* 목록, 역할·파일 소유권, 의존 관계, 완료 기준 |
| `CONTRIBUTING.md` | 브랜치·커밋·PR 규칙 |
| `supabase/schema.sql` | DB 스키마 |

사용자가 "T-32 구현해줘"처럼 태스크 번호를 주면: `docs/TASKS.md`에서 해당 행(내용·의존·완료 기준)을 찾고, 관련 SPEC 절을 읽은 뒤 작업한다. 의존 태스크가 아직 없으면 `lib/mock.ts`나 시그니처만 있는 함수로 우회하고 그 사실을 알린다.

## 기술 스택

- Next.js (App Router) + TypeScript + Tailwind CSS, npm
- Supabase (PostgreSQL + Realtime). 읽기는 브라우저에서 anon 키, **쓰기는 전부 `app/api/**` route에서 service role 키**
- AI: `lib/llm.ts`의 `askJSON()`만 사용 (공급자는 env `LLM_PROVIDER`로 전환)
- 음성 인식: Web Speech API (`webkitSpeechRecognition`, `ko-KR`), 교수 화면 전용
- 음성 출력: `speechSynthesis`, 교수 화면 전용
- PDF 텍스트 추출: `pdf-parse` (서버)

## 명령어

```bash
npm run dev       # 로컬 개발 (http://localhost:3000)
npm run build     # 빌드 확인 (PR 전 필수)
npm run lint
npm test          # vitest (AI 출력 검증 함수, 묶기 로직 등 단위 테스트)
npm run eval      # scripts/eval.ts: 프롬프트 정확도 평가 (E1~E4)
```

## 반드시 지킬 규칙

1. **계약 파일은 임의로 바꾸지 않는다:** `lib/types.ts`, `lib/config.ts`, `supabase/schema.sql`, SPEC §8의 API 형식. 바꿔야 하면 작업을 멈추고 사용자에게 먼저 묻는다. 바꾸게 되면 같은 변경에서 `docs/SPEC.md`도 고친다.
2. **설정값은 하드코딩하지 않는다.** 시간 범위, 임계값 등은 `lib/config.ts`에서 가져온다.
3. **비밀 키는 서버에서만.** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 클라이언트 컴포넌트나 `NEXT_PUBLIC_*`에 쓰지 않는다.
4. **시간은 DB `now()` 기준.** 클라이언트 시각을 저장하거나 비교에 쓰지 않는다 ("방금" 해석이 틀어짐).
5. **강의 인식 결과는 화면에 표시하지 않는다.** 교수 화면에는 인식 상태(🟢/🔴)만 표시한다. 자막 UI를 만들지 않는다.
6. **음성은 교수가 버튼을 눌렀을 때만 출력한다.** ([질문 읽어 주기], [요약 읽어 주기]) 자동 낭독을 넣지 않는다.
7. **거르기는 AI 판정으로만 한다.** 규칙 기반 필터(욕설 목록, 도배·링크 검사, 전송 횟수 제한)를 만들지 않는다.
8. **무관·부적절 질문은 저장하지 않는다.** DB 어디에도, 차단 기록이나 통계로도 남기지 않는다. 걸러진 메시지 수를 표시하지 않는다.
9. **학생에게 강의 원문을 보내지 않는다.** `/api/question` 응답과 학생 화면에는 다듬은 질문·후보 문장만 포함한다.
10. **짧은 입력을 막지 않는다.** "ㅁㄹ", "?", "모르겠어요", "다시"는 핵심 입력이다.
11. **AI 실패에 대비한다.** `askJSON()`은 실패 시 `null`을 반환한다. 모든 호출부에 SPEC §10.3의 대체 동작을 구현한다.
12. **AI 출력은 검증한다.** 입력에 없는 문장 번호 제거, confidence 0~1 자르기, 선택형 마지막 선택지 "모르겠어요" 보정 등 (PROMPTS.md "검증").
13. **프롬프트를 바꾸면 `docs/PROMPTS.md`도 바꾼다.**
14. **UI 문구는 한국어, 존댓말, 간결하게.** 학생 화면은 모바일 우선.
15. **소유권 밖 파일을 크게 고쳐야 하면** 먼저 사용자에게 알린다 (TASKS.md §1).

## 코드 컨벤션

- 공용 타입은 `lib/types.ts`에서 import한다. 같은 타입을 다시 정의하지 않는다
- API route는 요청 body를 검증하고, 실패 시 `{ error: { code, message } }` + 적절한 HTTP 상태
- 거르기 판정은 오류가 아니라 200 + `{ status: "rejected", message }`
- 서버 Supabase 클라이언트: `lib/supabase/server.ts`, 브라우저: `lib/supabase/client.ts`
- 실시간 갱신은 `USE_REALTIME` 설정에 따라 Realtime 구독 또는 `POLL_INTERVAL_MS` 주기 조회. 둘 다 지원하는 훅으로 만든다
- 컴포넌트: `components/prof/*`, `components/student/*`, 공용은 `components/ui/*`
- 주석은 "왜"만 간결하게. 한국어 가능

## 작업 마무리

1. `npm run lint && npm run build` (해당 시 `npm test`, `npm run eval`)
2. 태스크의 완료 기준을 어떻게 확인했는지 사용자에게 요약
3. 커밋 메시지: `feat(T-32): 질문 API에 AI 분류·매칭 연결` 형식
4. 브랜치: `feat/T-32-question-api` 형식. `main`에 직접 커밋·푸시하지 않는다
5. PR을 만들 때는 `.github/pull_request_template.md`를 채운다

@AGENTS.md
