# 시작 가이드: GitHub + Claude Code

순서대로 따라 하면 돼요. **1~6은 팀장(백엔드 담당 추천) 한 명**, 7은 **팀원 전원**이 해요.

준비물: Node.js 20 이상, Git, GitHub 계정, [GitHub CLI(`gh`)](https://cli.github.com), [Claude Code](https://docs.claude.com/en/docs/claude-code)

---

## 1. 이 문서 묶음으로 저장소 만들기 (팀장)

받은 zip 파일을 풀고, 그 폴더에서:

```bash
cd gyaut
git init -b main
git add .
git commit -m "docs: 명세서·태스크·협업 규칙 초기화"

gh auth login                                   # 처음 한 번
gh repo create gyaut --private --source=. --push
```

팀원 초대: GitHub 저장소 → Settings → Collaborators → 3명 추가

## 2. Next.js 프로젝트 초기화 = T-00 (팀장)

저장소 폴더에서 Claude Code를 실행하고 맡겨도 되고, 직접 해도 돼요.

**Claude Code로 하기**

```bash
claude
```
```
T-00 해줘. Next.js(App Router, TypeScript, Tailwind, ESLint, npm)를 이 저장소에 초기화하되
기존 문서 파일(CLAUDE.md, README.md, docs/, supabase/, scripts/, .github/)은 덮어쓰지 마.
@supabase/supabase-js, qrcode.react, pdfjs-dist, vitest, tsx도 설치하고
package.json에 "test": "vitest run", "eval": "tsx scripts/eval.ts" 스크립트를 추가해 줘.
.gitignore에 .env*.local이 들어 있는지 확인하고, 빌드가 통과하면 feat/T-00-init 브랜치로 커밋해 줘.
```

**직접 하기**

```bash
npx create-next-app@latest _app --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
rsync -a --ignore-existing _app/ ./      # 기존 문서는 그대로 두고 복사
rm -rf _app
npm i @supabase/supabase-js qrcode.react pdfjs-dist
npm i -D vitest tsx
# package.json scripts에 "test": "vitest run", "eval": "tsx scripts/eval.ts" 추가
npm run build
```

## 3. Supabase (팀장)

1. [supabase.com](https://supabase.com) → New project (리전: Northeast Asia (Seoul))
2. SQL Editor → `supabase/schema.sql` 전체 붙여 넣고 Run
3. Project Settings → API에서 URL, anon key, service_role key 복사
4. 저장소 루트에서 `cp .env.example .env.local` 후 값 채우기

## 4. Vercel 배포 (팀장)

1. [vercel.com](https://vercel.com) → Add New Project → GitHub 저장소 import
2. Environment Variables에 `.env.local` 값 입력
3. Deploy → **브라우저로 배포 URL 접속 확인** (HTTPS여야 마이크 권한이 동작)
4. PR마다 미리보기 URL이 자동 생성돼요

## 5. 브랜치 보호 (팀장)

GitHub 저장소 → Settings → Branches → Add rule
- Branch name pattern: `main`
- ✅ Require a pull request before merging (Required approvals: 1)

## 6. 이슈·마일스톤 자동 생성 (팀장)

```bash
bash scripts/create-issues.sh
```

`docs/TASKS.md`의 태스크 40개가 라벨(역할·우선순위)과 마일스톤(M0~M5)이 붙은 이슈로 만들어져요.
그다음 GitHub → Projects → New project(Board) → 이슈 추가 → 각자 자기 이슈에 Assignee 지정.

## 7. 팀원 각자

```bash
gh repo clone <팀장아이디>/gyaut
cd gyaut
npm install
cp .env.example .env.local      # 팀장에게 받은 값 채우기
npm run dev                     # http://localhost:3000
claude                          # Claude Code 실행 (CLAUDE.md 자동 로드)
```

### Claude Code 첫 요청 예시 (역할별)

**P · 교수 화면**
```
docs/TASKS.md에서 role P 태스크를 확인하고 T-10부터 시작하자.
lib/mock.ts 목 데이터로 /prof/[room] 화면을 SPEC §9.3대로 만들어 줘. 자막 영역은 만들지 마.
브랜치는 feat/T-10-prof-layout.
```

**S · 학생 화면**
```
T-21 해줘. /s/[room] 학생 화면을 SPEC §9.2대로, 익명 ID는 FR-R4대로.
아직 API가 없으니 lib/mock.ts로 동작하게 해 줘.
```

**B · 백엔드**
```
T-02 해줘. SPEC §7의 공용 타입을 lib/types.ts로, §11.1 설정값을 lib/config.ts로,
Supabase 서버·브라우저 클라이언트와 lib/mock.ts를 만들어 줘. 계약 파일이니 PR에 contract 라벨.
```

**A · AI·품질**
```
T-04 먼저 해줘. TASKS.md §1의 함수 계약대로 lib/context.ts, llm.ts, prompts.ts에
시그니처와 TODO만 있는 함수를 만들어 줘. 그다음 T-40으로 askJSON을 구현하고, T-41로 P1 프롬프트를 구현하자.
```

### 작업 루프

```
이슈 선택 → git switch -c feat/T-xx-설명 → claude에게 "T-xx 해줘"
→ npm run dev로 확인 → lint·build → 커밋·푸시 → PR → 리뷰 → Squash merge
```

---

## 자주 막히는 곳

| 증상 | 해결 |
|---|---|
| 마이크 권한이 안 뜸 | `localhost` 또는 HTTPS에서만 동작. 다른 PC는 Vercel URL로 |
| 받아쓰기가 아무것도 안 함 | 크롬인지 확인 (사파리·파이어폭스 미지원) |
| Realtime 이벤트가 안 옴 | schema.sql 마지막 `alter publication` 실행 여부 확인, `NEXT_PUBLIC_USE_REALTIME=false`로 폴링 |
| 학생이 questions를 못 읽음 | 의도된 설계 (RLS로 원문 보호). 내 질문은 localStorage, 인원은 clusters 조회 |
| 교수 화면에서 transcripts를 못 읽음 | 의도된 설계 (강의 인식 결과는 화면에 표시하지 않음, 서버에서만 사용) |
| `create-issues.sh` 권한 오류 | `gh auth refresh -s repo,project` |
