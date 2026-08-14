import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SLS-1-219: 게시판 공지를 앱 시작 시 팝업으로
//
// SLS-1-218 팝업은 릴리스 노트가 출처라 배포해야 내용이 바뀐다. 이 모듈은 Firestore를
// 읽어 배포 없이 공지를 낸다. Electron 전용(게시판 Firebase 설정이 설치본에만 동봉).
//
// ⚠️ 14번이 이 파일의 핵심이다. 13번("버전 팝업이 뜨면 기다린다")만 있으면
//    "항상 기다림" 회귀 시 **평상시에 공지가 영원히 안 뜬다** — 대다수 실행 경로다.
// ⚠️ 15번은 개행 보존. 관리자 입력은 textarea라 여러 줄을 전제하고, 기존 표시처 두 곳은
//    개행을 <br>로 바꾼다. textContent만 쓰면 팝업에서만 한 줄로 뭉개진다.

const SRC = readFileSync(resolve(process.cwd(), 'src/notice-popup.js'), 'utf8')
const INDEX_HTML = readFileSync(resolve(process.cwd(), 'src/index.html'), 'utf8')

async function loadModule() {
    vi.resetModules()
    // 의존 모듈을 먼저 올린다 — 실제 main-entry.js도 이 순서다
    // (notice-date → notice-seen → notice-popup).
    // 날짜 유틸이 없으면 window.isNoticeExpired가 undefined여서 만료 필터가 던지고,
    // seen 저장소가 없으면 본 공지 기록이 통째로 동작하지 않는다 (SLS-1-243).
    await import('../../src/shared/notice-date.js')
    await import('../../src/shared/notice-seen.js')
    await import('../../src/notice-popup.js')
    return window.__noticePopup
}

function setupDom() {
    document.body.innerHTML = `
        <div class="sync-modal" id="noticeModal">
            <button class="notice-close"></button>
            <div id="noticeBody"></div>
            <button id="noticeOk"></button>
        </div>`
    return {
        modal: document.getElementById('noticeModal'),
        body: document.getElementById('noticeBody'),
        ok: document.getElementById('noticeOk'),
    }
}

const NOTICES = [
    { id: 'n3', title: '최신', body: '첫 줄\n둘째 줄', createdAt: '2026-07-30T00:00:00Z', popup: true },
    { id: 'n2', title: '만료됨', body: 'b', createdAt: '2026-07-20T00:00:00Z', popup: true, until: '2026-07-25' },
    { id: 'n1', title: '팝업 아님', body: 'b', createdAt: '2026-07-10T00:00:00Z' },
    // truthy이지만 boolean true가 아닌 값 — 콘솔에서 직접 만든 문서에 이런 값이 들어올 수 있다.
    // 엄격 비교(=== true)의 존재 이유이며, truthy 검사로 바꾸면 이 항목이 새어 들어온다.
    { id: 'n0', title: '문자열 popup', body: 'b', createdAt: '2026-07-05T00:00:00Z', popup: 'yes' },
]

/** Electron + 게시판 Firebase를 흉내낸다 */
function stubEnv({ notices = NOTICES, initOk = true, listThrows = false, initHangs = false } = {}) {
    window.electronAPI = { isElectron: true }
    window.feedbackFirebase = {
        initialize: initHangs
            ? () => new Promise(() => {})           // 영원히 pending (blackhole 방화벽)
            : () => Promise.resolve(initOk),
    }
    window.createFeedbackStore = () => ({
        listNotices: listThrows
            ? () => Promise.reject(new Error('firestore 차단'))
            : () => Promise.resolve(notices),
    })
    window.whatsNewPopup = { whenClosed: () => Promise.resolve() }
}

beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-30T09:00:00'))
    delete window.electronAPI
    delete window.feedbackFirebase
    delete window.createFeedbackStore
    delete window.whatsNewPopup
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
})

describe('공지 선별', () => {
    it('1. popup이 true가 아닌 공지는 제외된다', async () => {
        const { pickNotices } = await loadModule()
        const got = pickNotices(NOTICES, [], '2026-07-30').map(n => n.id)
        expect(got, 'popup 필드가 없는 n1이 포함됐다').not.toContain('n1')
        // 🚨 truthy 검사로 바꾸면 이 단언이 죽는다 (뮤테이션 M1)
        expect(got, "popup: 'yes'가 새어 들어왔다 — === true 엄격 비교여야 한다").not.toContain('n0')
    })

    it('2. until이 지난 공지는 제외된다', async () => {
        const { pickNotices } = await loadModule()
        expect(pickNotices(NOTICES, [], '2026-07-30').map(n => n.id)).not.toContain('n2')
    })

    it('3. until이 없으면 무기한 표시된다', async () => {
        const { pickNotices } = await loadModule()
        const got = pickNotices(NOTICES, [], '2099-01-01').map(n => n.id)
        expect(got, 'until 없는 n3이 먼 미래에 제외됐다').toContain('n3')
    })

    it('4. 이미 본 id는 제외된다', async () => {
        const { pickNotices } = await loadModule()
        expect(pickNotices(NOTICES, ['n3'], '2026-07-30')).toEqual([])
    })

    it('until 당일은 아직 표시된다', async () => {
        const { pickNotices } = await loadModule()
        const got = pickNotices(NOTICES, [], '2026-07-25').map(n => n.id)
        expect(got, '종료일 당일에 이미 사라졌다').toContain('n2')
    })
})

describe('환경 가드', () => {
    it('6. 웹(electronAPI 없음)에서는 아무것도 안 한다', async () => {
        // ⚠️ Firebase 스텁은 남겨두고 electronAPI만 없앤다.
        //    둘 다 없애면 뒤따르는 가드가 잡아버려 Electron 가드 제거 뮤테이션이 살아남는다.
        stubEnv()
        delete window.electronAPI
        const { modal } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        expect(modal.classList.contains('show'), 'Electron이 아닌데 팝업이 떴다').toBe(false)
    })

    it('7. initialize()가 false면 조용히 종료한다', async () => {
        stubEnv({ initOk: false })
        const warn = vi.spyOn(window.logger, 'warn').mockImplementation(() => {})
        const { modal } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        expect(modal.classList.contains('show')).toBe(false)
        expect(warn, '정상 경로인데 경고가 남았다').not.toHaveBeenCalled()
    })

    it('8. 공지 조회가 던져도 예외가 새지 않는다', async () => {
        stubEnv({ listThrows: true })
        const warn = vi.spyOn(window.logger, 'warn').mockImplementation(() => {})
        const { modal } = setupDom()
        await expect(loadModule()).resolves.toBeDefined()
        await vi.runAllTimersAsync()
        expect(modal.classList.contains('show')).toBe(false)
        expect(warn, '실패는 콘솔에만 남아야 한다').toHaveBeenCalled()
    })

    // ⚠️ 아래 16번은 "안 뜬다"만 보므로 타임아웃이 없어 무기한 매달려도 통과한다
    //    (뮤테이션 M15가 실제로 살아남았다). 타임아웃이 **resolve하는지**를 직접 본다.
    it('16-b. 타임아웃이 실제로 false로 resolve된다', async () => {
        stubEnv({ initHangs: true })
        const { initWithTimeout } = await loadModule()
        const p = initWithTimeout(5000)
        await vi.advanceTimersByTimeAsync(6000)
        // 이미 settle된 프라미스가 있으면 race는 배열 순서상 앞의 것을 준다.
        // p가 pending이면 'PENDING'이 나온다.
        const settled = await Promise.race([p, Promise.resolve('PENDING')])
        expect(settled, '타임아웃이 없어 응답 없는 인증에 무기한 매달린다').toBe(false)
    })

    it('16. initialize()가 응답하지 않으면 타임아웃으로 종료한다', async () => {
        stubEnv({ initHangs: true })
        const { modal } = setupDom()
        await loadModule()
        await vi.advanceTimersByTimeAsync(6000)
        expect(modal.classList.contains('show'), '무기한 매달려 팝업이 떴다').toBe(false)
    })
})

describe('표시와 닫기', () => {
    it('5. 팝업 대상 공지가 있으면 표시된다', async () => {
        stubEnv()
        const { modal, body } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        expect(modal.classList.contains('show')).toBe(true)
        expect(body.textContent).toContain('최신')
        expect(body.textContent, '만료된 공지가 함께 떴다').not.toContain('만료됨')
    })

    it('9. 닫으면 모달이 먼저 닫히고 id가 기록된다', async () => {
        stubEnv()
        const { modal, ok } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        ok.click()
        expect(modal.classList.contains('show')).toBe(false)
        expect(JSON.parse(localStorage.getItem('seenNoticeIds'))).toContain('n3')
    })

    // 🚨 플랜 리뷰가 SLS-1-218에서 잡은 것과 같은 결함 — 순서가 뒤바뀌면 앱을 못 쓴다
    it('10. setItem이 던져도 모달은 닫힌다', async () => {
        stubEnv()
        const { modal, ok } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()

        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e
        })
        vi.spyOn(window.logger, 'warn').mockImplementation(() => {})

        expect(() => ok.click()).not.toThrow()
        expect(modal.classList.contains('show'), '기록 실패가 닫기를 막았다').toBe(false)
    })

    it('배경을 누르면 닫히고, 카드 안을 누르면 유지된다', async () => {
        stubEnv()
        const { modal, body } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        expect(modal.classList.contains('show'), '본문 클릭에 닫혔다').toBe(true)
        modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        expect(modal.classList.contains('show'), '배경 클릭이 무반응이다').toBe(false)
    })
})

describe('기록 정리', () => {
    // 🚨 플랜 리뷰 MINOR 1 — FIFO 캡은 무기한 공지에서 재출현을 못 막는다.
    //    조회에 존재하는 id만 남기는 방식이라야 한다.
    it('11. 조회에 없는 id는 기록에서 정리된다', async () => {
        const { writeSeen } = await loadModule()
        writeSeen(['살아있음', '삭제됨'], ['살아있음'])
        expect(JSON.parse(localStorage.getItem('seenNoticeIds'))).toEqual(['살아있음'])
    })

    it('손상된 기록은 빈 목록으로 취급한다', async () => {
        localStorage.setItem('seenNoticeIds', '{망가진 JSON')
        const { readSeen } = await loadModule()
        expect(readSeen()).toEqual([])
    })

    it('띄울 것이 없어도 삭제된 공지 id를 정리한다', async () => {
        localStorage.setItem('seenNoticeIds', JSON.stringify(['n3', '오래전삭제됨']))
        stubEnv()
        setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        const seen = JSON.parse(localStorage.getItem('seenNoticeIds'))
        expect(seen, '삭제된 공지 id가 남아 무한 증가한다').not.toContain('오래전삭제됨')
    })
})

describe('SLS-1-218 팝업과의 순서', () => {
    it('13. 버전 팝업이 떠 있으면 기다린다', async () => {
        stubEnv()
        let release
        window.whatsNewPopup = { whenClosed: () => new Promise((r) => { release = r }) }
        const { modal } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        expect(modal.classList.contains('show'), '버전 팝업이 떠 있는데 겹쳐 떴다').toBe(false)
        release()
        await vi.runAllTimersAsync()
        expect(modal.classList.contains('show'), '버전 팝업이 닫혔는데 안 뜬다').toBe(true)
    })

    // 🚨 플랜 리뷰 MAJOR 3 — 대다수 실행 경로다. 13번만 있으면 "항상 기다림"
    //    회귀 시 평상시에 공지가 영원히 안 뜬다.
    it('14. 버전 팝업이 없으면 즉시 표시된다', async () => {
        stubEnv()
        window.whatsNewPopup = { whenClosed: () => Promise.resolve() }
        const { modal } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        expect(modal.classList.contains('show')).toBe(true)
    })

    it('17. whatsNewPopup이 아예 없어도 진행한다', async () => {
        stubEnv()
        delete window.whatsNewPopup
        const { modal } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        expect(modal.classList.contains('show'), 'whatsNewPopup 부재에 멈췄다').toBe(true)
    })
})

describe('렌더링 안전성', () => {
    // 🚨 플랜 리뷰 MAJOR 1 — 개행이 사라지면 긴급 공지가 한 줄로 뭉개진다
    it('15. 개행을 보존하는 CSS가 있다', () => {
        const rule = INDEX_HTML.match(/\.notice-popup-body\s*\{([^}]*)\}/)
        expect(rule, '.notice-popup-body 규칙이 없다').toBeTruthy()
        expect(rule[1], 'white-space: pre-wrap이 없어 개행이 사라진다')
            .toMatch(/white-space:\s*pre-wrap/)
    })

    it('본문이 원문 그대로(개행 포함) 들어간다', async () => {
        stubEnv()
        const { body } = setupDom()
        await loadModule()
        await vi.runAllTimersAsync()
        const rendered = body.querySelector('.notice-popup-body')
        expect(rendered, '.notice-popup-body 요소가 없다').toBeTruthy()
        expect(rendered.textContent, '개행이 소실됐다').toBe('첫 줄\n둘째 줄')
    })

    it('12. 렌더링에 innerHTML을 쓰지 않는다', () => {
        expect(SRC, 'innerHTML은 XSS 경로가 된다 — textContent만 쓸 것')
            .not.toMatch(/\.innerHTML\s*=(?!\s*'')/)
    })
})
