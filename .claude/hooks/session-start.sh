#!/bin/bash
# session-start.sh — 세션 시작 시 AI PM 워크플로우 안내

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fi

TICKET_FILE="$PROJECT_ROOT/.claude/active-ticket"
ACTIVE_TICKET=""
if [[ -f "$TICKET_FILE" ]]; then
  ACTIVE_TICKET=$(cat "$TICKET_FILE" | tr -d '[:space:]')
fi

cat <<INFO
=========================================================
  sample-log-soil — AI PM 티켓-우선 개발 모드
=========================================================
  프로젝트 ID:   0a5f80f1-ede5-4b09-89b2-0001d6b89426 (SLS)
  General 에픽:  4d7bdd33-38c5-4c17-9cfc-c3c37b664549
  활성 티켓:     ${ACTIVE_TICKET:-(없음)}

  [규칙] src/ tests/ 하위 .js .ts .html .css 등 소스 수정은
         반드시 AI PM 티켓 발행 후 진행됩니다 (ticket-guard).

  [헬퍼] bash .claude/hooks/set-ticket.sh SLS-X-Y  → 티켓 활성화
         bash .claude/hooks/set-ticket.sh clear     → 해제
         bash .claude/hooks/set-ticket.sh           → 조회
=========================================================
INFO
exit 0
