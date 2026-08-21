// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright E2E 테스트 설정
 * @see https://playwright.dev/docs/test-configuration
 */
/**
 * 설명서 캡처 스펙 — 기본 실행에서 **제외**한다 (SLS-1-267).
 *
 * `manual-capture.spec.js`는 실행할 때마다 `src/manual/images/`의 png 13개를 다시 쓴다.
 * 기본 E2E에 섞여 있으면 검증을 돌릴 때마다 작업과 무관한 변경이 작업트리에 쌓이고,
 * `git add -A`로 의도치 않게 커밋된다(바이너리라 diff가 크게 잡힌다).
 * 되돌리기를 잊으면 설명서 이미지가 그대로 배포된다.
 *
 * 설명서를 갱신할 때만 명시적으로 돌린다:
 *   npm test                  → 캡처 제외
 *   npm run capture:manual    → 캡처만 (playwright.manual.config.js)
 *
 * ⚠️ 기본에서 뺀 대가는 **아무도 안 돌려서 셀렉터가 썩는 것**이다. 릴리스 전에
 *    `npm run capture:manual`을 돌리는 관례를 CLAUDE.md에 적어 두었다. 캡처 스펙의
 *    조건부 통과를 단언으로 바꾼 것도 같은 이유다 — 돌리는 순간 파손이 드러난다.
 */
const MANUAL_CAPTURE_SPEC = /manual-capture\.spec\.js/;

module.exports = defineConfig({
    testDir: './tests/e2e',
    testIgnore: MANUAL_CAPTURE_SPEC,

    // 테스트 실행 설정
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,

    // 리포터 설정
    reporter: 'html',

    // 공통 설정
    use: {
        // 웹 버전 테스트용 기본 URL (docs 폴더 기준)
        baseURL: 'http://localhost:8888',

        // 스크린샷 및 트레이스
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    // 프로젝트별 설정
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // 웹 서버 자동 실행 (docs 폴더 서빙)
    webServer: {
        command: 'npx http-server docs -p 8888 -c-1',
        url: 'http://localhost:8888',
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
    },
});
