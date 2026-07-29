#!/bin/bash
# set-ticket.sh — 활성 티켓 설정/해제 헬퍼
# Usage:
#   bash .claude/hooks/set-ticket.sh SLS-1-23          # 티켓 활성화 (정식 워크플로우)
#   bash .claude/hooks/set-ticket.sh SLS-1-23 --fast   # fast-track 활성화
#   bash .claude/hooks/set-ticket.sh clear             # 티켓 해제
#   bash .claude/hooks/set-ticket.sh                   # 현재 티켓 조회
#
# --fast (fast-track):
#   plan-review-guard(start_work)와 codex-review-guard(approve_review)의 산출물 검증을
#   건너뛴다. docs/00-discovery·01-plan·02-review·03-code-review를 만들지 않아도 된다.
#
#   ✅ 허용: 화면 문구·라벨·안내문 / 오타·주석·문서 / 버전 동기화·릴리스노트 / CSS 색상·여백
#   ❌ 금지: 조건문·분기 변경 / 삭제·저장 경로 / 데이터 모델·스토리지 키 / 내보내기 산출물 형식
#
#   기준은 "몇 줄이냐"가 아니라 "틀렸을 때 되돌릴 수 있느냐"다.
#   문구는 다음 배포에서 고치면 그만이지만, 삭제 로직은 되돌려도 데이터가 안 돌아온다.
#   보안/DB 마이그레이션/결제/권한 경로는 --fast를 줘도 codex-review-guard가 계속 차단한다.

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fi

TICKET_FILE="$PROJECT_ROOT/.claude/active-ticket"
FASTTRACK_FILE="$PROJECT_ROOT/.claude/active-ticket-fasttrack"

if [[ "$1" == "clear" ]]; then
  rm -f "$TICKET_FILE" "$FASTTRACK_FILE"
  echo "Active ticket cleared."
elif [[ -z "$1" ]]; then
  if [[ -f "$TICKET_FILE" ]]; then
    echo "Active ticket: $(cat "$TICKET_FILE")"
    if [[ -f "$FASTTRACK_FILE" ]] && [[ "$(cat "$FASTTRACK_FILE" | tr -d '[:space:]')" == "$(cat "$TICKET_FILE" | tr -d '[:space:]')" ]]; then
      echo "  mode: fast-track (플랜·리뷰 산출물 생략)"
    else
      echo "  mode: 정식 워크플로우 (docs/00~03 산출물 필요)"
    fi
  else
    echo "No active ticket."
  fi
else
  echo "$1" > "$TICKET_FILE"
  # 티켓이 바뀌면 이전 fast-track 표식이 남아 새 티켓까지 우회시키면 안 된다
  rm -f "$FASTTRACK_FILE"
  if [[ "$2" == "--fast" ]]; then
    echo "$1" > "$FASTTRACK_FILE"
    echo "Active ticket set: $1 (fast-track)"
    echo "  플랜·리뷰 산출물 없이 진행합니다. 로직이 바뀌는 작업이면 --fast 없이 다시 설정하세요."
  else
    echo "Active ticket set: $1"
  fi
fi
