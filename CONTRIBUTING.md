# 협업 규칙

해커톤은 짧으니까 규칙은 이것만 지킵니다.

## 1. 브랜치

- `main`: 항상 배포 가능한 상태. **직접 푸시 금지** (GitHub 브랜치 보호 설정)
- 작업 브랜치: `<종류>/T-<번호>-<짧은설명>`
  - 예: `feat/T-32-question-api`, `fix/T-23-confirm-modal`, `docs/T-03-decisions`
- 작업 시작 전 `git pull origin main`, 작업 중에도 1~2시간마다 main을 받아서 충돌을 작게 유지

## 2. 커밋 메시지

```
<종류>(T-<번호>): <무엇을 했는지>

feat(T-32): 질문 API에 AI 분류·매칭 연결
fix(T-23): 후보 버튼이 2개 이상일 때 겹치는 문제
docs(T-03): D1 LLM 모델 확정
```

종류: `feat` 기능 · `fix` 버그 · `refactor` 구조 개선 · `docs` 문서 · `chore` 설정 · `test` 테스트

## 3. PR

- 태스크 하나 = PR 하나. 크면 쪼갠다
- PR 제목: `T-32 질문 API: P1 분류·매칭·다듬기 연결`
- 본문은 템플릿을 채운다 (완료 기준 체크, 화면 캡처, 테스트 방법)
- **리뷰 1명 승인 후 Squash merge.** 급하면 담당 영역 내 수정은 셀프 머지 허용, 대신 팀 채팅에 알림
- Vercel 미리보기 URL로 폰에서 직접 확인

## 4. 파일 소유권

`docs/TASKS.md §1`의 표를 따른다. 남의 영역 파일을 고쳐야 하면:
1. 담당자에게 먼저 말하고
2. PR에 담당자를 리뷰어로 지정

## 5. 계약 변경 (중요)

아래 파일은 **모두가 의존**한다. 바꿀 때는 `contract` 라벨을 달고 팀 채팅에 알린다.

- `lib/types.ts`, `lib/config.ts`, `supabase/schema.sql`
- API 요청·응답 형식 (`docs/SPEC.md §8`)

그리고 **같은 PR에서 `docs/SPEC.md`도 함께 고친다.** 문서와 코드가 다르면 문서를 기준으로 보며, 문서 간에는 `docs/PROPOSAL.md`(기획서)가 최상위 기준이다.

## 6. 프롬프트 변경

- `lib/prompts.ts`를 고치면 `docs/PROMPTS.md`도 같이 고친다
- PR 본문에 `npm run eval` 결과(전/후)를 붙인다

## 7. 비밀 정보

- `.env.local`은 절대 커밋하지 않는다 (`.gitignore` 확인)
- 키 공유는 팀 채팅 DM 또는 Vercel 환경 변수로만
- `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 서버 코드(`app/api/**`, `lib/**` 서버 함수)에서만 사용. `NEXT_PUBLIC_` 접두사 금지

## 8. Claude Code 사용 규칙

- 저장소 루트에서 `claude` 실행. `CLAUDE.md`를 자동으로 읽는다
- 요청할 때 **태스크 번호를 먼저 말한다**: "T-32 구현해줘. SPEC §8.3 기준"
- Claude가 계약 파일(§5)을 바꾸려 하면 멈추고 팀과 상의
- 커밋·PR 전에 `npm run lint && npm run build` 통과 확인
- Claude가 만든 코드도 PR 리뷰를 똑같이 거친다

## 9. 막혔을 때

- 30분 이상 막히면 팀 채팅에 공유 (무엇을 / 어디까지 / 에러 메시지)
- 다른 사람 작업을 기다려야 하면 `lib/mock.ts`로 우회하고 계속 진행
