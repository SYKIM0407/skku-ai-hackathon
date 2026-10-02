# 시작 가이드

갸웃을 내 PC에서 실행하고, 배포·DB를 관리하는 방법입니다.

준비물: Node.js 20 이상, Git, [GitHub CLI(`gh`)](https://cli.github.com), 크롬 (교수 화면 음성 인식)

---

## 1. 내 PC에서 실행

```bash
git clone https://github.com/SYKIM0407/skku-ai-hackathon gyaut
cd gyaut
npm install
cp .env.example .env.local      # 팀원에게 DM으로 받은 값 채우기 (커밋 금지)
npm run dev                     # http://localhost:3000
```

> 💡 Windows는 `C:\dev\gyaut`처럼 **짧은 경로**에 받으세요. 경로가 길면 clone이 실패합니다.

### 환경 변수 (`.env.local`)

| 이름 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 (`sb_publishable_…` 또는 anon). 브라우저 읽기 전용 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 비밀 키 (`sb_secret_…` 또는 service_role). **서버 전용, 공개 금지** |
| `LLM_PROVIDER` / `LLM_MODEL` | `openai` / `gpt-4o-mini` (또는 `anthropic` / `claude-haiku-4-5`) |
| `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY` | AI 키. **공개 저장소이므로 절대 커밋하지 않기** |
| `NEXT_PUBLIC_USE_REALTIME` | `true` (Realtime 불안하면 `false` → 2초 주기 조회) |

## 2. 명령어

```bash
npm run dev       # 개발 서버
npm run lint      # 코드 검사
npm run build     # 빌드 확인 (PR 전 필수)
npm test          # 단위 테스트 (vitest)
npm run eval      # 데모 대본·평가 데이터로 AI 프롬프트 확인 (AI 키 필요, 호출 비용 발생)
```

## 3. Supabase (DB)

- 프로젝트: `gyaut` (Northeast Asia (Seoul), 무료 플랜)
- 새 프로젝트를 만들 때: SQL Editor에 `supabase/schema.sql` **전체**를 붙여 넣고 Run (테이블·DB 함수·RLS·Realtime 모두 포함)
- 스키마를 바꾸면 `schema.sql`과 `docs/SPEC.md §7`을 같이 고치고, **이미 운영 중인 DB에 바뀐 부분만 SQL Editor로 실행**
- ⚠️ 무료 플랜은 일주일 미사용 시 일시 정지 → 시연 전날 대시보드에서 활성 상태 확인

## 4. Vercel (배포)

- 주소: https://skku-ai-hackathon.vercel.app
- `main`에 머지되면 자동 배포, PR마다 미리보기 주소 생성
- 환경 변수: Vercel → Settings → Environment Variables (위 표와 같음). **바꾸면 Redeploy 해야 반영**
- 함수 리전: **Seoul (icn1)** (Supabase와 같은 지역이라 응답이 빠름)
- 저장소 연결·설정 변경은 저장소 주인(SYKIM0407) 계정에서만 가능

## 5. 작업 흐름

```
git switch main && git pull → git switch -c feat/설명 → 작업
→ npm run lint && npm run build → 커밋·푸시 → PR → 리뷰 → Squash merge
```

브랜치·커밋·PR 규칙은 [CONTRIBUTING.md](../CONTRIBUTING.md), Claude Code 작업 지침은 [CLAUDE.md](../CLAUDE.md).

---

## 자주 막히는 곳

| 증상 | 해결 |
|---|---|
| 마이크 권한이 안 뜸 | `localhost` 또는 HTTPS에서만 동작. 다른 PC는 Vercel 주소로 |
| 🟢인데 "문장 N개 받음" 숫자가 안 올라감 | 마이크가 소리를 못 받는 중 → 마이크 연결·크롬 마이크 권한 확인. 크롬만 지원 |
| 학생 질문에 "강의가 진행 중이 아니에요" | 최근 3분간 강의 문장이 없음 → 교수 화면에서 🎙 강의 인식을 켜고 말하기 |
| AI 정리 없이 전달됨 | AI 키 누락·잔액 부족·시간 초과 → `.env.local` 또는 Vercel 환경 변수 확인 |
| Realtime 이벤트가 안 옴 | schema.sql 마지막 `alter publication` 실행 여부 확인, `NEXT_PUBLIC_USE_REALTIME=false`로 폴링 |
| 학생이 questions를 못 읽음 | 의도된 설계 (RLS로 원문 보호). 내 질문은 localStorage, 인원은 clusters 조회 |
| 교수 화면에서 transcripts를 못 읽음 | 의도된 설계 (강의 인식 결과는 화면에 표시하지 않음, 서버에서만 사용) |
