# SLS-1-285 플랜 리뷰

> 정본. 훅 통과용 사본은 `docs/02-review/`.

리뷰어: `critic` 에이전트(Opus, 읽기 전용) + 오케스트레이터 · 2026-09-29

## 1R — REVISE (CRITICAL 0 / MAJOR 3 / MINOR 8 / SUGGESTION 2)

리뷰어가 스크래치에서 electron 39.2.6으로 CSP 판별·user-data-dir·UA를 재현하고, 39.8.10 lock으로 `npm audit`을 실제로 돌렸다.
lock 절차·릴리스 분리 추론·CI `npm install` 판단은 맞다고 확인.

- **MAJOR-1** 스모크 ③ `eval` 차단은 모든 페이지의 meta CSP만으로도 나서 헤더 CSP 유무를 못 가른다(재현: 헤더 없음 위반 1건 / 있음 2건·camera 차단)
  → 위반 이벤트 2건 + `featurePolicy.allowsFeature('camera') === false`로 교체
- **MAJOR-2** "audit에 electron 없음"은 반드시 실패 — electron 직접 advisory 33건은 닫히지만 `extract-zip`(postinstall 전용, 최신 2.0.1) 경유 항목이 남는다
  → 기준을 "electron via에 GHSA 직접 advisory 0건"으로
- **MAJOR-3** 주 내보내기 경로(Chromium 기본 다운로드 저장 대화상자)가 분석·스모크에서 빠짐 — GHSA-9w97-2464-8783이 바로 그 콜백
  → 스모크 ⑥ 백업 내보내기 추가
- MINOR: dev 서버 폴백(→ `VITE_DEV_SERVER_URL=http://127.0.0.1:1`), will-navigate·팝업 합격 기준, `node:https`·`window.print` 누락,
  실사용 폴더 사전 백업·바이너리 직접 실행, Windows 사전 확인 방법, 롤백 경로, EOL 후속 목표(40.10.3+), docs/ 범위 표기
- SUGGESTION: `@electron/fuses read` 실측, 표 출처(릴리스 노트 vs GHSA) 정정
- 열린 질문: 키체인 Safe Storage 공유 → `--use-mock-keychain`으로 처리

## 오케스트레이터 판단

MAJOR 3건·MINOR 8건·SUGGESTION 2건을 플랜에 모두 반영했다. EOL 후속 티켓은 발행하지 않고 권고로 보고한다(코디네이터 소관).

## 2R — APPROVE (CRITICAL 0 / MAJOR 0 / MINOR 3 / SUGGESTION 2)

리뷰어가 개정 항목을 실측했다: `VITE_DEV_SERVER_URL=http://127.0.0.1:1` → 연결 거부 → `loadFile` 폴백(메인·팝업 모두),
`--use-mock-keychain`은 39.2.6 + `EnableCookieEncryption`에서 키체인 항목을 만들지 않음(39.8.10은 추론), `@electron/fuses read` 동작(8개 출력, 설정한 6개만 대조).

- MINOR-1 검증 절 71행에 옛 audit 기준 잔존 → 정정
- MINOR-2 osascript는 손쉬운 사용 권한 벽 → 권한 있을 때만, 없으면 "앱 생존 + CDP 응답" 최소 신호, 저장 완료 미확인은 못 한 검증
- MINOR-3 Windows 사전 확인 브랜치에 릴리스 노트 1.14.18 항목 필요(`extract-whatsnew`) → 추가
- SUGGESTION: 위반 이벤트 개수를 주 기준·수백 ms 대기, 실사용 폴더 백업은 비교 후 삭제 → 반영

## 오케스트레이터 판단

2R 지적 전부 반영. 방향 일치(src/ 무변경, 같은 메이저), 롤백 가능(커밋 하나). 구현 착수.
