# 🤔 갸웃

> 갸웃한 순간 편하게 묻고, 교수님께 바로 닿는 수업
>
> **갸웃:** 이해가 되지 않아 고개를 갸웃하는 순간을 놓치지 않는다

수업 중 학생은 흐름을 끊을까 봐, 자신만 모를까 봐, 무엇을 모르는지 정리가 안 되어서 질문하지 못합니다.
교수는 질문을 해도 응답이 없어 학생들의 이해도를 알 수 없습니다.
갸웃은 실시간 강의 음성 인식과 AI로 수업 중 질문과 응답을 다시 연결합니다.

**배포:** https://skku-ai-hackathon.vercel.app (교수 화면은 데스크톱 크롬)

## 핵심 기능

| | 기능 |
|---|---|
| 🙋 **학생 → 교수** | "방금 그거 뭐임" 같은 모호한 질문을 AI가 질문 시점의 강의 내용과 매칭해 구체적인 질문으로 다듬고, 학생이 승인하면 같은 강의 시점의 질문끼리 묶어 교수에게 전달. 다른 학생 질문에 **[나도 모르겠어요]** 로 합류. 교수가 요청하면 음성으로 낭독 |
| 📢 **교수 → 학생** | 교수가 말로 던진 질문을 감지해 학생 화면으로 보내고(직접 입력도 가능), 익명 응답의 분포와 흔한 오해를 분석. 교수가 요청하면 요약을 음성으로 낭독 |
| 🧹 **거르기** | 수업과 무관하거나 부적절한 질문은 AI가 판정해 저장 없이 폐기. 강의 시작 전에는 "강의 진행 중이 아니에요" 안내 |
| 📄 **교안 용어** | 교안 PDF를 올리면 핵심 용어를 뽑아 질문 다듬기에 활용 (선택) |
| 🔒 **최소 저장** | 강의 음성은 저장하지 않고, 강의 인식 결과는 화면에 표시하지 않으며 수업 종료 시 삭제 |

## 사용 방법

1. **교수**: 시작 화면 → [수업 만들기] → 교수 화면에서 QR·4자리 코드 공유 → **🎙 강의 인식 시작**
   - 버튼 아래 "📝 문장 N개 받음" 숫자가 올라가면 정상
2. **학생**: QR 또는 코드로 입장 (로그인 없음, 익명) → 질문 입력 → "이렇게 보낼까요?" 확인 → 보내기
3. **교수**: 질문 목록(많이 물어본 순) 확인, [🔊 질문 읽어 주기], 질문이 감지되면 [보내기] → 마감 후 결과·[🔊 요약 읽어 주기]

## 문서

| 문서 | 내용 |
|---|---|
| [docs/PROPOSAL.md](docs/PROPOSAL.md) | 기획서 (최상위 기준) |
| [docs/SPEC.md](docs/SPEC.md) | 기능 명세서 (요구사항, 데이터 모델, API, 화면, 정책) |
| [docs/PROMPTS.md](docs/PROMPTS.md) | AI 프롬프트 명세 |
| [docs/TASKS.md](docs/TASKS.md) | 태스크 분배·마일스톤 (진행 기록) |
| [docs/SETUP.md](docs/SETUP.md) | 실행·환경 변수·Supabase·Vercel 가이드 |
| [docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md) | 시연 전 점검 목록 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 브랜치·커밋·PR 규칙 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 작업 지침 |

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Realtime) · Vercel (Seoul) · Web Speech API · OpenAI gpt-4o-mini

## 빠른 시작

```bash
git clone https://github.com/SYKIM0407/skku-ai-hackathon gyaut
cd gyaut
npm install
cp .env.example .env.local   # 값 채우기 (팀원에게 DM으로 받기, 커밋 금지)
npm run dev
```

자세한 내용은 [docs/SETUP.md](docs/SETUP.md)

## 팀

| 역할 | 이름 |
|---|---|
| P · 교수 화면 | |
| S · 학생 화면 | |
| B · 백엔드 | |
| A · AI·품질 | |
