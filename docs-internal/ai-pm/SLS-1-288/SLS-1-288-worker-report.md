# SLS-1-288 워커 보고 — graft 훅을 전역에만 맡긴다 (선택지 c, fast-track)

## 요약

프로젝트 `.claude/settings.json`에서 graft 훅 5개, `statusLine`, `subagentStatusLine`을 뺐고 `CLAUDE.md`에 graft 안내 3줄을 더했다.
전역 `~/.claude/settings.json`의 graft 훅 5종은 이벤트·매처·인자·timeout이 제거한 훅과 모두 같다. 차이는 helper 경로(전역 절대경로)뿐이다.
graft 상태줄은 전역에 대체가 없어 사라진다. 이 부분은 사용자가 결정할 일로 남긴다(아래).

- 브랜치: `bluesky78060/sls-288-graft` (커밋 해시는 worker_done 본문에 적는다. push하지 않았다)
- AI PM: SLS-1-288 done (start_work → submit_test → approve_review)

## 훅 전후 비교

| 이벤트 | 전 | 후 |
| --- | --- | --- |
| SessionStart | `session-start.sh`, graft `session-start` | `session-start.sh` |
| PreToolUse `Edit\|Write\|MultiEdit` | `ticket-guard.sh` | 그대로 |
| PreToolUse `mcp__ai-pm__create_task\|…` | `epic-id-guard.sh` | 그대로 |
| PostToolUse `Write\|Edit\|MultiEdit` | graft `post-edit` | (키 삭제) |
| PostToolUse `Bash\|mcp__graft__\|Read\|Grep\|Glob` | graft `tool-savings` | (키 삭제) |
| UserPromptSubmit | graft `prompt` | (키 삭제) |
| Stop | graft `stop` | (키 삭제) |
| statusLine / subagentStatusLine | `graft-statusline.cjs` | (삭제) |

diff는 삭제만 있다(61줄). `python3 -m json.tool`로 JSON 유효성을 확인했다.

## 전역과의 비교

| 항목 | 프로젝트(제거 전) | 전역 | 차이 |
| --- | --- | --- | --- |
| SessionStart `session-start` | 8000ms | 8000ms | 경로만 다름 |
| PostToolUse `Write\|Edit\|MultiEdit` `post-edit` | 10000ms | 10000ms | 경로만 다름 |
| PostToolUse `Bash\|mcp__graft__\|Read\|Grep\|Glob` `tool-savings` | 8000ms | 8000ms | 경로만 다름 |
| UserPromptSubmit `prompt` | 15000ms | 15000ms | 경로만 다름 |
| Stop `stop` | 8000ms | 8000ms | 경로만 다름 |
| statusLine | `graft-statusline.cjs` | `node ~/.claude/hud/omc-hud.mjs` | **graft 상태줄이 전역에 없다** |
| subagentStatusLine | `graft-statusline.cjs` | 없음 | **전역에 없다** |
| helper `BAKED` 경로 | nvm `v22.23.2/lib/...` (메인 체크아웃 로컬 파일) | `/opt/homebrew/lib/...` | 둘 다 후보 중 최고 버전을 고르므로 실동작은 같다 |

- 전역 helper `~/.claude/helpers/graft-hooks.cjs`는 존재하고 `node --check`를 통과한다. `hooks.js`는 homebrew와 nvm 양쪽에 있다. graft CLI는 0.20.0이다.
- 부수 효과: 메인 체크아웃처럼 로컬 helper가 있던 곳에서는 **같은 훅이 전역·프로젝트에서 두 번씩 돌던 중복**이 없어진다.

## `grep -c graft .claude/settings.json` = 4

- `permissions.allow`의 `Bash(graft:*)`, `Bash(npx graft:*)`, `Bash(graft-dev:*)` 3줄: CLI 실행 허용이다.
- `footerLinksRegexes`의 `graft/[\w./-]+\.md` 1줄: 링크 인식 패턴이다.
- **helper 경로(`.claude/helpers`) 참조는 0건이다.** 넷 다 없는 파일을 부르지 않으므로 남겨 두었다.

## `.mcp.json` graft MCP 유지 근거

`"command": "graft", "args": ["mcp"]`는 PATH의 전역 바이너리(`~/.nvm/versions/node/v22.23.2/bin/graft`)를 직접 실행하고 `.claude/helpers`를 쓰지 않는다. 그래서 유지했다.
graft가 설치되지 않은 환경에서는 MCP 연결만 실패하고, 이것은 helper 문제와 별개다.

## 검증

| 항목 | 결과 |
| --- | --- |
| `npm run build` | exit 0, `✓ built in 3.66s`. docs/·src/manual 변경 없음 |
| `npm run test:unit` | 60 files / 925 tests passed |
| `npm run lint` | 0 errors, 6 warnings (한도 6) |
| E2E (`npx playwright test`) | **돌리지 않았다.** `src/`·`docs/` 변경이 없는 설정·문서 변경이기 때문이다 |
| 리뷰 | codexa 독립 리뷰 1건: C0 / M0 / m0 / S0, 승인. 원문은 `SLS-1-288-code-review.md` |

## 못 한 검증 / 사용자 결정

1. **새 세션에서 전역 훅이 실제로 뜨는지는 확인하지 못했다.** 이 세션은 제거 전 설정으로 시작했다. 새 워크트리에서 세션을 열고 graft 훅 오류가 없는지, SessionStart에 graft 문맥이 한 번만 나오는지 봐야 한다.
2. **graft 상태줄이 사라진다.** 전역 statusLine은 omc-hud다. graft 상태줄이 필요하면 전역을 손봐야 하는데, 전역 수정은 이 티켓의 범위 밖이다.
3. `.claude/helpers/`와 `.claude/skills/graft/` 로컬 파일은 지우지 않았다(ignore 대상).
