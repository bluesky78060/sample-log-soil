import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 설치본은 dev server 를 찾지 않는다 (SLS-1-289)
 *
 * 예전 설치본은 localhost:3000 에 응답하는 아무 페이지나 메인 창·팝업에 로드했고,
 * 그 페이지에 window.electronAPI(파일 I/O IPC)가 붙었다(재현: docs-internal/ai-pm/SLS-1-289/).
 * E2E 는 docs/ 를 http 로만 돌아 이 경로를 밟지 않으므로 여기서 지킨다.
 */

const ROOT = process.cwd()
const { isDevServerReachable, isDevNavigationAllowed } =
    createRequire(import.meta.url)(path.join(ROOT, 'src/dev-server-probe.js'))

/** http.get 흉내 — outcome 대로 응답·오류·타임아웃을 내거나('silent') 아무것도 안 낸다 */
function fakeGet(outcome) {
    const get = vi.fn((url, opts, onResponse) => {
        const req = new EventEmitter()
        req.destroy = vi.fn()
        queueMicrotask(() => {
            if (outcome === 'response') onResponse(get.res)
            else if (outcome === 'timeout') req.emit('timeout')
            else if (outcome === 'error') req.emit('error', new Error('ECONNREFUSED'))
        })
        return req
    })
    get.res = { destroy: vi.fn() }
    return get
}

const URL3000 = 'http://localhost:3000'

describe('isDevServerReachable', () => {
    it('설치본은 탐색하지 않는다 — 서버가 떠 있어도 false', async () => {
        const get = fakeGet('response')
        expect(await isDevServerReachable({ isPackaged: true, url: URL3000, httpGet: get })).toBe(false)
        expect(get).not.toHaveBeenCalled()
    })

    it('isPackaged 를 빠뜨리면 설치본으로 본다(fail-closed)', async () => {
        const get = fakeGet('response')
        expect(await isDevServerReachable({ url: URL3000, httpGet: get })).toBe(false)
        expect(await isDevServerReachable({ isPackaged: 0, url: URL3000, httpGet: get })).toBe(false)
        expect(get).not.toHaveBeenCalled()
    })

    it('개발 모드: 응답하면 true', async () => {
        const get = fakeGet('response')
        expect(await isDevServerReachable({ isPackaged: false, url: URL3000, httpGet: get })).toBe(true)
        expect(get).toHaveBeenCalledWith(URL3000, { timeout: 1000 }, expect.any(Function))
        expect(get.res.destroy).toHaveBeenCalled()
    })

    it('개발 모드: 오류면 false', async () => {
        expect(await isDevServerReachable({ isPackaged: false, url: URL3000, httpGet: fakeGet('error') })).toBe(false)
    })

    it('개발 모드: 타임아웃이면 요청을 끊고 false', async () => {
        const get = fakeGet('timeout')
        expect(await isDevServerReachable({ isPackaged: false, url: URL3000, httpGet: get })).toBe(false)
        expect(get.mock.results[0].value.destroy).toHaveBeenCalled()
    })

    it('이벤트를 하나도 안 내는 요청도 timeoutMs 뒤에 끊고 false', async () => {
        const get = fakeGet('silent')
        expect(await isDevServerReachable({ isPackaged: false, url: URL3000, httpGet: get, timeoutMs: 20 })).toBe(false)
        expect(get.mock.results[0].value.destroy).toHaveBeenCalled()
    })

    it('잘못된 URL 로 http.get 이 동기로 던져도 false', async () => {
        const get = vi.fn(() => { throw new TypeError('Invalid URL') })
        expect(await isDevServerReachable({ isPackaged: false, url: 'foo', httpGet: get })).toBe(false)
    })
})

describe('isDevNavigationAllowed', () => {
    it.each([
        ['설치본은 dev server 로도 못 간다', true, 'http://localhost:3000/soil/', URL3000, false],
        ['isPackaged 누락도 거부', undefined, 'http://localhost:3000/soil/', URL3000, false],
        ['개발 모드: 같은 origin 허용', false, 'http://localhost:3000/soil/', URL3000, true],
        ['개발 모드: 다른 포트 거부', false, 'http://localhost:30001/', URL3000, false],
        ['개발 모드: userinfo 우회 거부', false, 'http://localhost:3000@evil.example/', URL3000, false],
        ['개발 모드: localhost: userinfo 우회 거부', false, 'http://localhost:@evil.example/', URL3000, false],
        ['개발 모드: dev server 를 못 찾았으면 거부', false, 'http://localhost:3000/', null, false],
        ['개발 모드: 잘못된 URL 거부', false, 'not a url', URL3000, false],
        ['개발 모드: dev server 가 file: 이면 거부(null origin)', false, 'data:text/html,x', 'file:///tmp/x', false],
        ['개발 모드: dev server 가 data: 이면 거부', false, 'data:text/html,y', 'data:text/html,x', false],
    ])('%s', (_label, isPackaged, url, devServerUrl, expected) => {
        expect(isDevNavigationAllowed({ isPackaged, url, devServerUrl })).toBe(expected)
    })
})

/**
 * 정적 가드 — src/index.js 가 헬퍼를 우회하는 회귀를 막는다.
 * index.js 는 require 시점에 app.whenReady 등 부작용이 있어 실행해서 검사할 수 없다.
 * 주석을 벗기지 않는다: 'file:///*' 같은 문자열의 '/*' 를 주석으로 오인해 코드 수백 행을 지웠다.
 */
describe('src/index.js 배선', () => {
    const MAIN = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8')

    /** 여는 괄호부터 짝이 맞는 닫는 괄호까지 — 인자 안의 `}`·`${}` 에 끊기지 않게 */
    function callArgs(src, openIdx) {
        let depth = 0
        for (let i = openIdx; i < src.length; i++) {
            if (src[i] === '(') depth++
            else if (src[i] === ')' && --depth === 0) return src.slice(openIdx, i + 1)
        }
        throw new Error('괄호가 닫히지 않는다')
    }
    const helperCalls = [...MAIN.matchAll(/isDev(?:ServerReachable|NavigationAllowed)\(/g)]
        .map((m) => callArgs(MAIN, m.index + m[0].length - 1))

    /** will-navigate 핸들러 본문들 — 등록 줄과 같은 들여쓰기의 `});` 까지 */
    const navHandlers = [...MAIN.matchAll(/^([ \t]*)\S.*\.on\('will-navigate'/gm)].map((m) => {
        const end = MAIN.indexOf(`\n${m[1]}});`, m.index)
        if (end < 0) throw new Error('will-navigate 핸들러 끝을 못 찾았다 — 들여쓰기가 바뀌었으면 추출을 고쳐라')
        return MAIN.slice(m.index, end)
    })

    it('dev server 를 직접 찌르지 않는다', () => {
        expect(MAIN).not.toMatch(/http\.get\(\s*VITE_DEV_SERVER_URL/)
        expect(MAIN).not.toMatch(/startsWith\(\s*['"`]https?:/)
        expect(MAIN).not.toMatch(/startsWith\(\s*activeDevServerUrl/)
    })

    it('헬퍼 호출마다 isPackaged 를 한 번, app.isPackaged 그대로 넘긴다', () => {
        expect(helperCalls).toHaveLength(4)
        for (const c of helperCalls) {
            expect(c.match(/isPackaged\s*:/g)).toHaveLength(1)
            // `app.isPackaged && false` 같은 식이 붙으면 안 된다
            expect(c).toMatch(/isPackaged:\s*app\.isPackaged\s*[,}]/)
        }
    })

    it('dev server URL 을 여는 곳마다 탐색을 거친다', () => {
        const loads = MAIN.match(/loadURL\(\s*`?\$?\{?VITE_DEV_SERVER_URL/g) || []
        const probes = MAIN.match(/isDevServerReachable\(/g) || []
        expect(loads.length).toBe(2)
        expect(probes.length).toBe(loads.length)
    })

    // ⚠️ 정규식이라 `startsWith` 형태의 우회만 잡는다. `/^https?:/.test(url)` 같은 다른 표현은
    //    못 잡는다 — 실제 차단은 패키징 재현(docs-internal/ai-pm/SLS-1-289/smoke/)이 증명한다.
    it('will-navigate 는 file:// 검사와 헬퍼 말고는 startsWith 로 URL 을 허용하지 않는다', () => {
        expect(navHandlers).toHaveLength(2)
        for (const h of navHandlers) {
            expect(h).toContain('isDevNavigationAllowed(')
            // 상수를 넘기면 dev server 가 없어 file:// 로 뜬 창도 그리로 이동할 수 있다 — 탐색 결과를 넘긴다
            expect(h).not.toMatch(/devServerUrl:\s*VITE_DEV_SERVER_URL/)
            const starts = h.match(/[\w.]+\.startsWith\([^)]*\)/g) || []
            for (const s of starts) {
                expect(s).toMatch(/^(url\.startsWith\('file:\/\/'\)|realFilePath\.startsWith\(DOCS_DIR)/)
            }
        }
    })
})
