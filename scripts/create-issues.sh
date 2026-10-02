#!/usr/bin/env bash
# docs/TASKS.md의 태스크를 GitHub 이슈·라벨·마일스톤으로 한 번에 만든다.
# 데이터: scripts/tasks.tsv  (TASKS.md를 바꾸면 tsv도 맞춰 고친다)
#
# 사용법 (저장소 루트에서):
#   gh auth login            # 처음 한 번
#   bash scripts/create-issues.sh
#
# 다시 실행해도 이미 있는 라벨·마일스톤·이슈(T-번호 기준)는 건너뛴다.
set -euo pipefail

TSV="$(dirname "$0")/tasks.tsv"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "▶ 대상 저장소: $REPO"

# ── 라벨 ──
make_label () { gh label create "$1" --color "$2" --description "$3" 2>/dev/null && echo "  + 라벨 $1" || true; }
make_label "role:P" "1f77b4" "교수 화면"
make_label "role:S" "2ca02c" "학생 화면"
make_label "role:B" "ff7f0e" "백엔드"
make_label "role:A" "9467bd" "AI·품질"
make_label "role:전원" "7f7f7f" "전원"
make_label "P0" "d62728" "없으면 데모 불가"
make_label "P1" "ffbb78" "가능하면"
make_label "P2" "c7c7c7" "여유 있으면"
make_label "contract" "000000" "공용 계약 변경 (types/config/schema/API)"

# ── 마일스톤 ──
existing_ms="$(gh api "repos/$REPO/milestones?state=all&per_page=100" -q '.[].title')"
for ms in "M0 킥오프" "M1 뼈대" "M2 흐름 A 연결" "M3 흐름 B 연결" "M4 보완·평가" "M5 시연 준비" "P2 여유"; do
  if ! grep -qxF "$ms" <<< "$existing_ms"; then
    gh api "repos/$REPO/milestones" -f title="$ms" >/dev/null && echo "  + 마일스톤 $ms"
  fi
done

# ── 이슈 ──
existing_issues="$(gh issue list --state all --limit 300 --json title -q '.[].title')"

tail -n +2 "$TSV" | while IFS=$'\t' read -r id role priority milestone title depends done; do
  if grep -q "^$id " <<< "$existing_issues"; then
    echo "  = $id 이미 있음"; continue
  fi

  # 역할 라벨 (A+B, B+전원 같은 복수 역할 처리)
  labels="$priority"
  IFS='+' read -ra roles <<< "$role"
  for r in "${roles[@]}"; do labels="$labels,role:$r"; done
  [[ "$id" == "T-02" ]] && labels="$labels,contract"

  body="$(cat <<EOF
## 내용
$title

## 관련 문서
- 태스크 표: docs/TASKS.md ($id)
- 명세: docs/SPEC.md
- 프롬프트: docs/PROMPTS.md

## 의존
$depends

## 완료 기준
- [ ] $done

---
Claude Code에서: \`$id 구현해줘\`
EOF
)"
  short_title="$(echo "$title" | sed 's/`//g' | cut -c1-80)"
  gh issue create --title "$id $short_title" --body "$body" --label "$labels" --milestone "$milestone" >/dev/null
  echo "  + $id"
done

echo "✅ 완료. GitHub > Projects에서 보드를 만들고 이슈를 추가하면 칸반으로 볼 수 있어요."
