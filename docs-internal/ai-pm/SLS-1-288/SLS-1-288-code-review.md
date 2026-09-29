# SLS-1-288 코드 리뷰 — codexa 독립 리뷰

- 대상: `.claude/settings.json`(graft 훅 5개·statusLine·subagentStatusLine 제거), `CLAUDE.md`(graft 안내 3줄)
- 리뷰어: `codexa exec`(다른 계열 모델, 계정 자동 순환). 프롬프트는 따옴표 heredoc 파일로 넘겼고, 출력은 2,071바이트, exit 0이었다.
- 판정: **승인** — CRITICAL 0 / MAJOR 0 / MINOR 0 / SUGGESTION 0

## 리뷰 원문

검토 결과, 지적할 문제는 없습니다.

- `.claude/settings.json`에서 제거된 항목은 프로젝트 로컬 graft 훅 5종과 graft status line 2종뿐입니다.
- `session-start.sh`, `ticket-guard.sh`, `epic-id-guard.sh` 및 기존 권한은 그대로 유지됐습니다. 권한 객체 해시도 변경 전후 동일합니다.
- JSON 파싱에 성공했으며, 빈 이벤트 키나 빈 hook 그룹도 없습니다.
- 전역 graft 훅 5종은 프로젝트에서 제거된 훅과 이벤트, matcher, 인자, timeout이 모두 같습니다.
  - `SessionStart` → `session-start`, 8000ms
  - `PostToolUse Write|Edit|MultiEdit` → `post-edit`, 10000ms
  - `PostToolUse Bash|mcp__graft__|Read|Grep|Glob` → `tool-savings`, 8000ms
  - `UserPromptSubmit` → `prompt`, 15000ms
  - `Stop` → `stop`, 8000ms
  - 유일한 차이는 스크립트 경로가 프로젝트 상대 경로에서 전역 절대 경로로 바뀐 것으로, 이번 변경의 의도와 일치합니다.
- graft status line은 전역에서 대체되지 않습니다. 전역 `statusLine`은 `omc-hud`이고 graft `subagentStatusLine`도 없습니다. 따라서 graft 전용 표시가 사라지지만, 사용자가 선택한 “프로젝트 설정에서 제거” 범위에 부합하며 기능상 결함으로 보지 않습니다.
- 남은 graft 권한 3줄은 CLI 사용을 허용하고, `footerLinksRegexes`는 생성된 graft 문서 링크 인식에 쓰이므로 훅 제거와 독립적입니다. 유지가 타당합니다.
- `.mcp.json`의 `graft mcp` 등록도 훅과 별개인 MCP 기능입니다. `graft`는 PATH에서 `/Users/leechanhee/.nvm/versions/node/v22.23.2/bin/graft`로 해석되며 버전은 `0.20.0`입니다.
- `.claude/helpers/*`가 실제로 `.gitignore`의 `.claude/*` 규칙에 의해 제외되고 있음도 확인했습니다.
- `CLAUDE.md` 설명은 사실과 맞습니다. `graft ask --in src/` 옵션은 0.20.0 도움말에 존재하며 실제 범위 제한 질의도 정상 동작했습니다.
- `git diff --check`에서도 오류가 없습니다.

C=0 M=0 m=0 S=0
