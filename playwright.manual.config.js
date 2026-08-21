// @ts-check

/**
 * 설명서 캡처 전용 Playwright 설정 (SLS-1-267)
 *
 * 기본 `playwright.config.js`는 `manual-capture.spec.js`를 `testIgnore`로 제외한다 —
 * 캡처가 매 실행마다 `src/manual/images/`의 png 13개를 다시 써서 작업트리를 오염시키기
 * 때문이다. 이 설정은 그 제외를 걷어내고 **캡처만** 실행한다.
 *
 *   npm run capture:manual
 *
 * ⚠️ **환경변수(`CAPTURE_MANUAL=1 npx playwright test`) 방식을 쓰지 않은 이유**:
 *    `VAR=1 cmd` 형식은 POSIX 쉘 문법이라 Windows `cmd`에서 동작하지 않는다.
 *    이 저장소는 전국 기관에 **Windows 설치본**으로 배포되므로 개발·검증 환경도
 *    Windows일 수 있다. 별도 config 파일은 `cross-env` 같은 의존성 추가 없이
 *    두 플랫폼에서 똑같이 동작한다.
 *
 * ⚠️ 캡처 전에 `npm run build`가 선행되어야 최신 화면이 찍힌다 — 테스트는 빌드 산출물
 *    (`docs/`)을 서빙해 대상으로 삼는다. 빌드를 이 스크립트에 넣지 않은 것은 의도적이다:
 *    이미지만 다시 찍고 싶을 때 매번 빌드를 기다리게 되기 때문이다.
 */

const base = require('./playwright.config.js');

// 기본 설정의 `testIgnore`(캡처 제외)를 걷어내고 캡처만 매칭한다.
// spread 후 `undefined`를 할당하는 대신 키 자체를 빼야 확실하다.
const { testIgnore, ...rest } = base;

module.exports = {
    ...rest,
    testMatch: /manual-capture\.spec\.js/,
};
