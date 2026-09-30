# AI PM 워크플로우 상세 (CLAUDE.md 에서 분리, SLS-1-294)

> 훅 표·fast-track 판단 기준·docs/ 사본 절차. 프로젝트·에픽 ID 와 핵심 규칙은 CLAUDE.md 에 남겼다. 전역 워크플로우는 ~/.claude/rules/ai-pm-ticket.md.

### Hook 강제 시스템 (`.claude/hooks/`)

`.claude/settings.json`에 등록된 PreToolUse hook이 다음을 자동 차단합니다.

| Hook | 트리거 | 차단 조건 |
| --- | --- | --- |
| `ticket-guard.sh` | Edit/Write/MultiEdit | `src/` 또는 `tests/` 하위의 `.js .ts .tsx .html .css .scss` 등 소스 파일 수정 시 활성 티켓이 없으면 차단 |
| `epic-id-guard.sh` | `mcp__ai-pm__create_task` | `epic_id`가 누락/null이면 차단 |

**제외 대상** (자유 수정 가능): 루트 설정 파일(`vite.config.js`, `package.json` 등), 모든 `.md` 문서, 이미지/JSON 자산, `docs/` 빌드 산출물, `.claude/` 내부.

**활성 티켓 헬퍼**:
```bash
bash .claude/hooks/set-ticket.sh SLS-X-Y          # 활성화 (정식 워크플로우)
bash .claude/hooks/set-ticket.sh SLS-X-Y --fast   # fast-track (플랜·리뷰 산출물 생략)
bash .claude/hooks/set-ticket.sh                  # 조회 (모드 함께 표시)
bash .claude/hooks/set-ticket.sh clear            # 해제
```

### fast-track — 언제 쓰고 언제 쓰지 않나

전역 훅 `plan-review-guard`(start_work)와 `codex-review-guard`(approve_review)가
`docs/00-discovery` · `01-plan` · `02-review` · `03-code-review` 산출물을 요구한다.
`--fast`는 **네 가지를 모두 건너뛴다.**

기준은 **"몇 줄이냐"가 아니라 "틀렸을 때 되돌릴 수 있느냐"**다.
문구는 다음 배포에서 고치면 그만이지만, 삭제 로직은 되돌려도 데이터가 안 돌아온다.

| ✅ fast-track | ❌ 정식 워크플로우 |
| --- | --- |
| 화면 문구·라벨·안내문 | 조건문·분기 변경 |
| 오타·주석·문서 | 삭제·저장 경로 |
| 버전 동기화·릴리스노트 | 데이터 모델·스토리지 키 |
| CSS 색상·여백 | 내보내기 산출물 형식 |

⚠️ **한 줄짜리라고 fast-track이 아니다.** SLS-1-217은 `SAMPLE_DATA_PATTERNS`에서 한 줄을
뺀 것이었지만, 플랜 리뷰가 "금요일 자동 클리어는 호출부가 없다"는 오판을 잡아내
위험도가 뒤집혔다(무해 → 12주간 무음 데이터 유실). SLS-1-216도 한 줄 추가였으나
플랜 리뷰가 `SyntaxError`가 될 코드를 걸렀다. **로직이 바뀌면 정식 워크플로우다.**

보안·DB 마이그레이션·결제·권한 경로는 `--fast`를 걸어도 `codex-review-guard`가
변경 파일을 재확인해 차단한다(우회 불가).

### ⚠️ 훅이 요구하는 `docs/`는 빌드가 지운다 — 산출물 정본은 `docs-internal/`

두 전역 훅은 `docs/00-discovery` · `01-plan` · `02-review` · `03-code-review`를 찾는데,
**이 저장소의 `docs/`는 vite의 `outDir`이고 `emptyOutDir: true`다.** `npm run build`가
통째로 비우므로 그 자리에 둔 산출물은 다음 빌드에서 사라진다.

그래서 **정본은 `docs-internal/ai-pm/{티켓}/`에 두고 그쪽을 커밋한다.**
`docs/` 아래 사본은 훅을 통과시키기 위한 일회용이며 커밋하지 않는다.

```bash
# approve_review 직전에만 만든다 (훅은 파일명에 티켓 코드가 있으면 인정)
mkdir -p docs/03-code-review
cp docs-internal/ai-pm/SLS-1-223/SLS-1-223-code-review.md \
   docs/03-code-review/SLS-1-223-review.md
# 승인 후 제거 — 어차피 다음 빌드에서 지워진다
rm -rf docs/03-code-review
```

> 사본에는 "정본은 `docs-internal/`에 있다"는 한 줄을 머리에 남긴다. 빌드 산출물
> 사이에 리뷰 문서가 섞여 있으면 다음 사람이 그것을 정본으로 오해한다.

표준 워크플로우:
1. `mcp__ai-pm__create_task(epic_id="4d7bdd33-...", title="...")` → ticket_code 받음
2. `bash .claude/hooks/set-ticket.sh SLS-X-Y` (티켓 활성화)
3. `mcp__ai-pm__smart_workflow(task_id, 'start_work')`
4. 코드 수정 (Edit/Write 통과)
5. 빌드/테스트 → `submit_test`
6. 코드리뷰 → `approve_review`
7. `bash .claude/hooks/set-ticket.sh clear` (자동 done 후)

