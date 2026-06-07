#!/bin/bash
# set-ticket.sh — 활성 티켓 설정/해제 헬퍼
# Usage:
#   bash .claude/hooks/set-ticket.sh SLS-1-23   # 티켓 활성화
#   bash .claude/hooks/set-ticket.sh clear        # 티켓 해제
#   bash .claude/hooks/set-ticket.sh              # 현재 티켓 조회

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fi

TICKET_FILE="$PROJECT_ROOT/.claude/active-ticket"

if [[ "$1" == "clear" ]]; then
  rm -f "$TICKET_FILE"
  echo "Active ticket cleared."
elif [[ -z "$1" ]]; then
  if [[ -f "$TICKET_FILE" ]]; then
    echo "Active ticket: $(cat "$TICKET_FILE")"
  else
    echo "No active ticket."
  fi
else
  echo "$1" > "$TICKET_FILE"
  echo "Active ticket set: $1"
fi
