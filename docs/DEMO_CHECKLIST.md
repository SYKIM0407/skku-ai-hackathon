# 시연 체크리스트 (T-38)

시연 전날·당일에 위에서부터 순서대로 확인한다. 막히면 맨 아래 "장애 대응"으로.

## 1. 환경 변수 (Vercel → Settings → Environment Variables)

| 이름 | 값 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public 키 | 브라우저 읽기 전용 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | **서버 전용. `NEXT_PUBLIC_` 금지** |
| `LLM_PROVIDER` | `openai` | D-2 결정 |
| `LLM_MODEL` | `gpt-4o-mini` | D-2 결정 |
| `OPENAI_API_KEY` | 팀 키 | 콘솔에서 **월 사용 한도** 설정 |
| `NEXT_PUBLIC_USE_REALTIME` | `true` | 실시간이 불안하면 `false` (2초 주기 조회) |

- [ ] 값을 바꿨으면 **Redeploy** (환경 변수는 재배포해야 반영됨)
- [ ] 자동 점검: `vercel env pull .env.local` 후
      `npx tsx --conditions=react-server scripts/check-env.ts --url https://<배포 주소>` → "모두 통과"
      (환경 변수·테이블·DB 함수·RLS·AI 응답 속도·배포 URL을 확인. AI 1회 호출, 1원 미만)

## 2. Supabase

- [ ] `supabase/schema.sql` 전체 실행 (테이블 + 함수 + RLS + Realtime publication)
- [ ] Database → Replication에서 `clusters`, `prof_questions` Realtime 켜짐
- [ ] 무료 플랜이면 일주일 미사용 시 일시 정지됨 → 시연 전날 대시보드에서 활성 상태 확인

## 3. 백업 수업방

- [ ] `npx tsx --conditions=react-server scripts/seed-demo-room.ts` → 방 코드 `DEMO`
      (질문 묶음 4개 + 마감된 교수 질문 1개와 분석 결과가 채워진 방. AI 호출 없음. 다시 실행하면 초기화)
- [ ] `/prof/DEMO`, `/s/DEMO`가 열리고 묶음·결과가 보이는지 확인
- [ ] 시연 직전에 한 번 더 실행해 깨끗한 상태로 (리허설 중 데이터가 섞이지 않게)

## 4. 시연 기기

- [ ] 교수 화면: **크롬**, HTTPS 배포 주소 (Web Speech API·마이크는 HTTPS에서만)
- [ ] 마이크 권한 허용, 스피커 볼륨 (질문/요약 읽어 주기)
- [ ] 학생 화면: 다른 브라우저 프로필 또는 시크릿 창 여러 개 (익명 ID가 달라야 1인 1응답 확인 가능)
- [ ] 가짜 강의 모드 버튼 위치 확인 (`scripts/demo-lecture.json`, 25문장 약 2분 40초)

## 5. 리허설 (3회)

흐름 A
- [ ] 가짜 강의 모드 시작 → 학생 "방금 그거 왜 0임" → 승인 창에 행렬식 질문으로 다듬어짐 → [보내기]
- [ ] 다른 학생 "?" → 같은 묶음 인원 증가 → 교수 [질문 읽어 주기]
- [ ] "점심 뭐 먹지" → "수업과 관련된 질문만 보낼 수 있습니다"

흐름 B
- [ ] "고윳값이 몇 개일까요 / 생각해 보세요" → 교수 화면 감지 알림 → [보내기]
- [ ] 학생 2~3명 응답 → 시간 종료 또는 [마감] → 분포·흔한 오해·[요약 읽어 주기]
- [ ] "왜 0으로 놓을까요 / 그건 바로…"(수사적)는 알림이 뜨지 않음

마무리
- [ ] [수업 종료] → 진행 중 질문 마감, 강의 인식 결과 삭제

## 6. 장애 대응 (SPEC §10.3)

| 상황 | 대응 |
|---|---|
| AI 느림·실패 | 학생 질문은 원문 그대로 전달("AI 정리 없이 전달되었습니다"), 교수 질문은 [직접 질문하기] |
| 마이크·음성 인식 불안 | 가짜 강의 모드로 진행 |
| Realtime 끊김 | 화면은 주기 조회로 자동 전환. 계속 문제면 `NEXT_PUBLIC_USE_REALTIME=false` 후 재배포 |
| 네트워크 장애 | 백업 수업방 `DEMO`로 결과 화면 설명 → 그래도 안 되면 녹화 영상 |
| 이전 질문이 안 닫혀 새 질문이 막힘 | 시간이 지난 질문은 [보내기] 때 자동 마감됨. 시간 전이면 [마감] |
