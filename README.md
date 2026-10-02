# 🤔 갸웃

> 수업을 함께 듣고, 학생과 교수 사이에서 대신 손을 들어 주는 AI
>
> **갸웃:** 이해가 되지 않아 고개를 갸웃하는 순간을 놓치지 않는다

수업 중 학생은 흐름을 끊을까 봐, 자신만 모를까 봐, 무엇을 모르는지 정리가 안 되어서 질문하지 못합니다.
교수는 질문을 해도 응답이 없어 학생들의 이해도를 알 수 없습니다.
갸웃은 실시간 강의 음성 인식과 AI로 수업 중 질문과 응답을 다시 연결합니다.

## 핵심 기능

| | 기능 |
|---|---|
| 🙋 **학생 → 교수** | "방금 그거 뭐임" 같은 모호한 질문을 AI가 질문 시점의 강의 내용과 매칭해 구체적인 질문으로 다듬고, 학생이 승인하면 같은 강의 시점의 질문끼리 묶어 교수에게 전달. 교수가 요청하면 음성으로 낭독 |
| 📢 **교수 → 학생** | 교수가 말로 던진 질문을 감지해 학생 화면으로 보내고, 익명 응답의 분포와 흔한 오해를 분석. 교수가 요청하면 요약을 음성으로 낭독 |
| 🧹 **거르기** | 수업과 무관하거나 부적절한 질문은 AI가 판정해 저장 없이 폐기 |
| 🔒 **최소 저장** | 강의 음성은 저장하지 않고, 강의 인식 결과는 수업 종료 시 삭제 |

## 문서

| 문서 | 내용 |
|---|---|
| [docs/PROPOSAL.md](docs/PROPOSAL.md) | 기획서 (최상위 기준) |
| [docs/SPEC.md](docs/SPEC.md) | 기능 명세서 (요구사항, 데이터 모델, API, 화면, 정책) |
| [docs/PROMPTS.md](docs/PROMPTS.md) | AI 프롬프트 명세 |
| [docs/TASKS.md](docs/TASKS.md) | 태스크 분배·마일스톤 |
| [docs/SETUP.md](docs/SETUP.md) | 저장소·Supabase·Vercel·Claude Code 시작 가이드 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 브랜치·커밋·PR 규칙 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 작업 지침 |

## 기술 스택

Next.js · TypeScript · Tailwind CSS · Supabase · Vercel · Web Speech API · AI 소형 모델 (gpt-4o-mini / Claude Haiku 등)

## 빠른 시작

```bash
gh repo clone SYKIM0407/skku-ai-hackathon
cd skku-ai-hackathon
npm install
cp .env.example .env.local   # 값 채우기
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
