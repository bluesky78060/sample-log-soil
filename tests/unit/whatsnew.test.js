import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SLS-1-218: 새 버전 첫 실행 시 주요 수정사항 팝업
//
// 이 기능이 필요한 이유: 버전이 올라가도 사용자는 무엇이 바뀌었는지 모른다. 릴리스 노트
// 페이지는 따로 들어가야 보이므로, SLS-1-217처럼 데이터 유실을 막은 중요한 수정도 지나친다.
//
// ⚠️ 초안은 "자동 업데이트가 무음으로 동작하지 않는다"를 근거로 들었으나 사실이 아니다
//    (2026-07-30 사용자 확인). setup.exe 다운로드 수를 수동 설치로 오해한 것이며,
//    latest.yml의 path가 setup.exe이므로 그 숫자가 곧 업데이터가 받아간 것이었다.
//
// ⚠️ 5번이 이 파일의 핵심이다. localStorage 기록을 모달 닫기보다 먼저 하면 용량 초과 시
//    예외가 닫기를 막아 **모달이 안 닫히고**, 기록도 안 됐으니 새로고침해도 또 뜬다.
//    이 저장소는 SLS-1-198에서 이미 quota 도미노를 겪었다.

const SRC = readFileSync(resolve(process.cwd(), 'src/whatsnew.js'), 'utf8')

/** 모듈을 깨끗한 상태로 다시 올린다 (IIFE가 아니라 import 시 즉시 실행되므로) */
async function loadModule() {
    vi.resetModules()
    await import('../../src/whatsnew.js')
    return window.__whatsnew
}

/** 팝업 마크업을 최소한으로 세운다 */
function setupDom() {
    document.body.innerHTML = `
        <div class="sync-modal" id="whatsnewModal">
            <button class="whatsnew-close"></button>
            <div id="whatsnewBody"></div>
            <button id="whatsnewOk"></button>
        </div>`
    return {
        modal: document.getElementById('whatsnewModal'),
        body: document.getElementById('whatsnewBody'),
        ok: document.getElementById('whatsnewOk'),
    }
}

const ENTRIES = [
    { version: '1.14.3', date: '2026-07-29', title: '중요 — 데이터 유실 수정', items: ['금요일에 …', '백업 확인 …'] },
    { version: '1.12.0', date: '2026-07-10', title: '퇴비 판정 추가', items: ['부숙도 판정 …'] },
    { version: '1.9.0', date: '2026-06-20', title: '옛 버전', items: ['옛 항목 …'] },
]

beforeEach(() => {
    localStorage.clear()
    delete window.APP_VERSION
    window.WHATS_NEW = { generatedFor: '1.14.3', entries: ENTRIES }
})

afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
})

describe('표시 여부 판단', () => {
    it('1. 첫 설치(기록 없음)는 띄우지 않고 기준점만 잡는다', async () => {
        const { modal } = setupDom()
        await loadModule()
        expect(modal.classList.contains('show'), '첫 설치인데 팝업이 떴다').toBe(false)
        expect(localStorage.getItem('lastSeenVersion')).toBe('1.14.3')
    })

    it('2. 낡은 버전이 기록돼 있으면 띄운다', async () => {
        localStorage.setItem('lastSeenVersion', '1.10.9')
        const { modal, body } = setupDom()
        await loadModule()
        expect(modal.classList.contains('show')).toBe(true)
        expect(body.textContent).toContain('데이터 유실')
    })

    it('3. 같은 버전이면 띄우지 않는다', async () => {
        localStorage.setItem('lastSeenVersion', '1.14.3')
        const { modal } = setupDom()
        await loadModule()
        expect(modal.classList.contains('show')).toBe(false)
    })

    it('6. WHATS_NEW가 없으면 예외 없이 넘어간다', async () => {
        localStorage.setItem('lastSeenVersion', '1.10.9')
        delete window.WHATS_NEW
        // ⚠️ APP_VERSION을 반드시 세워야 한다. WHATS_NEW만 지우면 버전 출처도 함께 사라져
        //    더 앞의 `if (!current) return`에서 빠져나가고 이 분기에 도달하지 않는다.
        //    (그 상태로는 "throw로 바꾸기" 뮤테이션이 살아남았다)
        window.APP_VERSION = '1.14.3'
        const { modal } = setupDom()
        // ⚠️ 바깥 try/catch가 예외를 삼키므로 "안 던졌다"만 보면 부족하다.
        //    예외가 나면 경고를 남기게 되어 있으니, 경고가 없어야 정상 경로다.
        //    (이 단언이 없으면 "throw로 바꾸기" 뮤테이션이 살아남는다 — 실제로 살았다)
        // 코드는 (window.logger?.warn || console.warn)을 쓴다. setup.js:9가 logger를
        // 정의하므로 console.warn을 감시하면 아무것도 못 잡는다 — 실제로 못 잡았다.
        const warn = vi.spyOn(window.logger, 'warn').mockImplementation(() => {})
        await expect(loadModule()).resolves.toBeDefined()
        expect(modal.classList.contains('show')).toBe(false)
        expect(warn, '정상 경로여야 하는데 예외가 포착됐다').not.toHaveBeenCalled()
    })

    it('8. 구간에 지정된 항목이 없으면 안 띄우고 기준점만 옮긴다', async () => {
        localStorage.setItem('lastSeenVersion', '1.14.3')
        window.WHATS_NEW = { generatedFor: '1.14.4', entries: ENTRIES }
        const { modal } = setupDom()
        await loadModule()
        expect(modal.classList.contains('show')).toBe(false)
        expect(localStorage.getItem('lastSeenVersion')).toBe('1.14.4')
    })
})

describe('닫기 동작', () => {
    it('4. 닫으면 모달이 닫히고 기록이 갱신된다', async () => {
        localStorage.setItem('lastSeenVersion', '1.10.9')
        const { modal, ok } = setupDom()
        await loadModule()
        ok.click()
        expect(modal.classList.contains('show')).toBe(false)
        expect(localStorage.getItem('lastSeenVersion')).toBe('1.14.3')
    })

    // 코드리뷰 LOW-1 — syncModal(main-init.js:96-98)과 같은 동작이어야 한다
    it('배경을 누르면 닫힌다', async () => {
        localStorage.setItem('lastSeenVersion', '1.10.9')
        const { modal } = setupDom()
        await loadModule()
        modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        expect(modal.classList.contains('show'), '배경 클릭이 무반응이다').toBe(false)
        expect(localStorage.getItem('lastSeenVersion')).toBe('1.14.3')
    })

    it('카드 안을 누르면 닫히지 않는다', async () => {
        localStorage.setItem('lastSeenVersion', '1.10.9')
        const { modal, body } = setupDom()
        await loadModule()
        // e.target 검사가 없으면 읽는 중에 사라진다
        body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        expect(modal.classList.contains('show'), '본문 클릭에 닫혔다').toBe(true)
    })

    // 🚨 이 티켓 플랜 리뷰 MAJOR 2 — 순서가 뒤바뀌면 앱을 못 쓴다
    it('5. setItem이 던져도 모달은 닫힌다', async () => {
        localStorage.setItem('lastSeenVersion', '1.10.9')
        const { modal, ok } = setupDom()
        await loadModule()

        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            const e = new Error('quota')
            e.name = 'QuotaExceededError'
            throw e
        })
        vi.spyOn(window.logger, 'warn').mockImplementation(() => {})

        expect(() => ok.click()).not.toThrow()
        expect(modal.classList.contains('show'), '기록 실패가 닫기를 막았다').toBe(false)
    })
})

describe('버전 비교와 구간 추출', () => {
    it('7. 여러 버전을 건너뛰면 구간의 모든 항목이 최신순으로 담긴다', async () => {
        const { pickEntries } = await loadModule()
        const picked = pickEntries(ENTRIES, '1.9.0', '1.14.3')
        expect(picked.map(e => e.version)).toEqual(['1.14.3', '1.12.0'])
    })

    it('9. 버전 비교가 자리수에 속지 않는다', async () => {
        const { compareVersions } = await loadModule()
        // 문자열 비교라면 '1.9.0' > '1.14.0'이 되어 틀린다
        expect(compareVersions('1.9.0', '1.14.0')).toBe(-1)
        expect(compareVersions('1.14.3', '1.14.3')).toBe(0)
        expect(compareVersions('1.14.10', '1.14.9')).toBe(1)
    })

    // 코드리뷰 LOW-2 — 낮은 버전 재설치로 기준점이 내려가면 이미 본 항목이 또 뜬다
    it('기록을 뒤로 밀지 않는다 (다운그레이드)', async () => {
        localStorage.setItem('lastSeenVersion', '1.14.3')
        window.WHATS_NEW = { generatedFor: '1.12.0', entries: ENTRIES }
        const { modal } = setupDom()
        await loadModule()
        expect(modal.classList.contains('show')).toBe(false)
        expect(localStorage.getItem('lastSeenVersion'), '기준점이 내려갔다').toBe('1.14.3')
    })

    it('현재 버전보다 높은 항목은 제외한다', async () => {
        const { pickEntries } = await loadModule()
        const withFuture = [{ version: '2.0.0', items: ['미래'] }, ...ENTRIES]
        expect(pickEntries(withFuture, '1.12.0', '1.14.3').map(e => e.version)).toEqual(['1.14.3'])
    })
})

describe('안전성', () => {
    // 메인 페이지는 window.APP_VERSION이 없다 (main-entry.js가 constants.js를 import하지 않음)
    it('APP_VERSION이 없으면 생성물의 generatedFor를 쓴다', async () => {
        const { resolveCurrentVersion } = await loadModule()
        expect(resolveCurrentVersion()).toBe('1.14.3')
        window.APP_VERSION = '9.9.9'
        expect(resolveCurrentVersion(), 'APP_VERSION이 있으면 그쪽 우선').toBe('9.9.9')
    })

    it('11. 렌더링에 innerHTML을 쓰지 않는다', () => {
        expect(SRC, 'innerHTML은 XSS 경로가 된다 — textContent만 쓸 것').not.toMatch(/\.innerHTML\s*=/)
    })

    it('10. 생성물의 generatedFor가 APP_VERSION과 일치한다 (빌드 드리프트)', () => {
        const gen = readFileSync(resolve(process.cwd(), 'src/shared/whatsnew-data.js'), 'utf8')
        const constants = readFileSync(resolve(process.cwd(), 'src/shared/constants.js'), 'utf8')
        const genFor = gen.match(/"generatedFor":\s*"([^"]+)"/)?.[1]
        const appVer = constants.match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1]
        expect(genFor, 'whatsnew-data.js를 읽지 못했다').toBeTruthy()
        expect(genFor, `생성물이 낡았다 — npm run build 필요 (생성물 ${genFor} vs 앱 ${appVer})`).toBe(appVer)
    })
})
