#!/bin/bash
# ticket-guard.sh — PreToolUse hook for Ticket-First Development
# src/, tests/ 하위 소스 코드 수정 시 활성 티켓 존재를 강제합니다.
# 차단 대상 확장자: .js .jsx .ts .tsx .mjs .cjs .html .css .scss .vue .svelte
# 통과 대상: 루트 설정(vite.config.js 등), docs/(빌드 산출물), .md, 이미지, JSON

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# 프로젝트 루트 감지
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT=$(dirname "$FILE_PATH")
  while [[ "$PROJECT_ROOT" != "/" && ! -f "$PROJECT_ROOT/CLAUDE.md" ]]; do
    PROJECT_ROOT=$(dirname "$PROJECT_ROOT")
  done
fi

# 절대경로 → 상대경로
REL_PATH="${FILE_PATH#$PROJECT_ROOT/}"

# .claude/ 내부 파일은 제외
if [[ "$REL_PATH" == .claude/* ]]; then
  exit 0
fi

# src/ 또는 tests/ 하위만 검사 대상
case "$REL_PATH" in
  src/*|tests/*)
    ;;
  *)
    exit 0
    ;;
esac

# 소스 코드 확장자만 검사
case "$FILE_PATH" in
  *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs|*.html|*.css|*.scss|*.vue|*.svelte)
    ;;
  *)
    exit 0
    ;;
esac

TICKET_FILE="$PROJECT_ROOT/.claude/active-ticket"

if [[ -f "$TICKET_FILE" ]]; then
  TICKET=$(cat "$TICKET_FILE" | tr -d '[:space:]')
  if [[ -n "$TICKET" ]]; then
    echo "{\"additionalContext\": \"[Active Ticket: $TICKET]\"}"
    exit 0
  fi
fi

cat >&2 <<'WARN'
[Ticket-First Rule] 활성 티켓 없이 소스 코드를 수정하려고 합니다!

먼저 AI PM 티켓을 발행하세요:
1. mcp__ai-pm__get_project_status로 에픽 확인
2. mcp__ai-pm__create_task(epic_id="b0b0e282-9c1d-41ad-986d-3d347077e6a5", title="...")
3. echo "SAMPL-X-Y" > .claude/active-ticket  (또는 bash .claude/hooks/set-ticket.sh SAMPL-X-Y)
4. mcp__ai-pm__smart_workflow(task_id, 'start_work')
5. 그 후 코드 수정 진행

프로젝트: sample-log-soil (ID: ca36c527-a379-47e9-bdda-938d57fa916c)
General 에픽: b0b0e282-9c1d-41ad-986d-3d347077e6a5
WARN
exit 2
