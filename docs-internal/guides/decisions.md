# 결정 기록·수용된 리스크 (CLAUDE.md 에서 분리, SLS-1-294)

> 원문은 CLAUDE.md 「알려진 함정」 절 끝이었다. 재검토 조건이 생기면 읽는다.

### 문의게시판 알림 자격증명 클라이언트 동봉 (수용된 리스크, SLS-1-170)

`feedback-auth.json`의 `notify` 블록(Telegram 봇 토큰, EmailJS 키)은 `forge.config.js`의
`extraResource`로 **Electron 설치본에 그대로 동봉**된다(`src/feedback/feedback-notify.js`가
런타임에 읽어 Telegram/EmailJS REST API를 직접 호출). asar/resources는 난독화가 아니라 단순
아카이브라, 전국에 배포되는 설치 파일을 받은 사람은 누구나 자격증명을 추출할 수 있다.

- **영향 범위**: 봇 토큰 탈취 시 해당 봇으로 메시지 전송/삭제, EmailJS 키 탈취 시 스팸 발송·쿼터
  소진 정도. **시료 데이터는 영향 없음**(문의게시판은 별도 Firebase 프로젝트로 격리, `firestore.rules`가
  서버측으로 쓰기 스키마·소유자를 강제함 — 이 자격증명과는 무관한 방어선).
- **정석 해법**: 알림 발송을 Firebase Cloud Functions(Firestore `feedbackInquiries` onCreate 트리거)
  등 서버측으로 이전해 클라이언트에 시크릿을 두지 않는 것. 2026-07-02 보안 분석에서 이 방안이
  제시됐으나, 배포·운영 부담(Blaze 요금제 활성화, `firebase deploy` 등은 Firebase 콘솔/CLI 접근 권한이
  있는 사람이 별도로 수행해야 함) 대비 실이익이 낮다고 판단해 **의도적으로 보류**했다(SLS-1-170).
- **완화책(현재 적용됨)**: 알림용 Telegram 봇/EmailJS 계정은 반드시 **전용·최소 권한**으로 발급한다
  (다른 용도로 겸용하지 않는 별도 봇, 발신 전용 EmailJS 서비스). 자격증명이 유출되어도 피해가 해당
  알림 채널 하나로 국한되도록 하는 것이 핵심.
- **재검토 시점**: 문의게시판 알림 채널이 늘어나거나(예: Slack/카카오 등 추가), 자격증명이 실제로
  악용된 정황이 있으면 서버 이전을 재검토한다.

## `@grpc/grpc-js` 알림은 도달 불가로 판단해 코드를 바꾸지 않았다 (SLS-1-296, 2026-10-01)

Dependabot·`npm audit --omit=dev` 가 `@grpc/grpc-js` 1.9.16(firebase 12.7.0 → `@firebase/firestore` 4.9.3 전이)에 high 권고(GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4, 범위 <1.13.6)를 낸다. **프로덕션 경로에서 이 패키지가 로드되지 않아** 고치지 않는다 — 근거와 증거는 `docs-internal/ai-pm/SLS-1-296/`.

- 로드하는 파일은 `@firebase/firestore` 의 Node 진입점(`index.node.cjs.js`·`index.node.mjs`)뿐이다.
- 렌더러는 `firebase/compat/*` 의 브라우저 빌드를 번들한다(`docs/assets` 에 `grpc-js`·`@grpc`·`proto-loader`·`http2` 0건, `WebChannel` 존재). 메인 프로세스는 firebase 를 require 하지 않는다.
- override 도 하지 않는다: `@firebase/firestore` 최신(4.17.2)도 `~1.9.0` 으로 고정이고, npm audit 이 제안하는 「firebase 9.14.0」은 다운그레이드다.

**재검토 조건 — 하나라도 해당하면 판단을 다시 한다**
1. `@grpc/grpc-js` 1.9.x 백포트(1.9.17 등)가 나오면 `~1.9.0` 범위 안이라 override 없이 lock 갱신만으로 해소된다 — 올린다.
2. `@firebase/firestore` 가 grpc 고정을 풀면 올린다.
3. 「도달 불가」가 기대는 **불변식이 깨지면**: (a) 모든 BrowserWindow 가 `sandbox:true`·`nodeIntegration:false`(`src/index.js`), (b) vite 클라이언트 조건에 `node` 가 없다(`vite.config.js` 에 `resolve.conditions`·`ssr` 오버라이드 없음), (c) 메인 프로세스가 firebase 를 쓰지 않는다.
