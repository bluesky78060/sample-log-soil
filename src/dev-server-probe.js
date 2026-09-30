/**
 * @fileoverview 개발용 Vite 서버 탐색 — 메인 프로세스 전용 (SLS-1-289)
 *
 * 두 함수 모두 `isPackaged !== false` 면 거부한다(fail-closed) — 호출부가 인자를 빠뜨려도
 * 설치본이 dev server 를 찾거나 그리로 이동하지 않게.
 */

/**
 * @param {{ isPackaged: boolean, url: string, httpGet: Function, timeoutMs?: number }} opts
 * @returns {Promise<boolean>}
 */
function isDevServerReachable({ isPackaged, url, httpGet, timeoutMs = 1000 }) {
    if (isPackaged !== false) return Promise.resolve(false);
    return new Promise((resolve) => {
        let req = null;
        let done = false;
        // 소켓 timeout 은 유휴 시간만 잰다 — 이벤트를 하나도 안 내는 요청도 끝나게 따로 잰다
        const timer = setTimeout(() => finish(false), timeoutMs);
        function finish(ok) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (!ok && req) req.destroy();
            resolve(ok);
        }
        try {
            req = httpGet(url, { timeout: timeoutMs }, (res) => {
                res.destroy();
                finish(true);
            });
            req.on('error', () => finish(false));
            req.on('timeout', () => finish(false));
        } catch {
            // 잘못된 URL 이면 http.get 이 동기로 던진다
            finish(false);
        }
    });
}

/**
 * 개발 모드에서 dev server 와 같은 origin 으로의 이동만 허용한다.
 * `startsWith` 비교는 `http://localhost:3000@evil/` 같은 userinfo URL 에 뚫린다.
 *
 * @param {{ isPackaged: boolean, url: string, devServerUrl: string | null }} opts
 * @returns {boolean}
 */
function isDevNavigationAllowed({ isPackaged, url, devServerUrl }) {
    if (isPackaged !== false || !devServerUrl) return false;
    try {
        const dev = new URL(devServerUrl);
        // file:·data: 는 origin 이 'null' 이라 서로 같다고 나온다
        if (dev.protocol !== 'http:' && dev.protocol !== 'https:') return false;
        return new URL(url).origin === dev.origin;
    } catch {
        return false;
    }
}

module.exports = { isDevServerReachable, isDevNavigationAllowed };
