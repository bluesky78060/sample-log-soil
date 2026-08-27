import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// SLS-1-276: 페이지를 넘길 때 표 크기가 흔들리지 않게 한다
//
// 🚨 무엇을 지키는 시험인가
//    · 마지막 페이지가 짧아도 표 높이가 유지된다 (채움 행)
//    · 채움 행이 **처리 대상에 섞이지 않는다** — 선택·삭제·내보내기는
//      `.row-checkbox`와 `tr[data-id]`로 행을 찾는다. 둘 중 하나라도 붙으면
//      빈 줄이 함께 지워지거나 함께 내보내진다.
//    · 구분선과 채움 행이 **같은 열 수 계산을 쓴다** (codex 플랜 리뷰 지적).
//      따로 세면 열이 하나 늘 때 폭이 갈라진다.
//    · 같은 방향을 연달아 눌러도 애니메이션이 다시 재생된다.
//
// 보이는 열은 폭이 아니라 **계산된 display**로 센다. 목록을 다시 그리는 도중에는
// tbody가 비어 표가 통째로 폭 0으로 접히기 때문이다(실측). jsdom도 인라인 style의
// display는 getComputedStyle에 그대로 반영하므로 그대로 시험할 수 있다.

beforeAll(async () => {
    await import('../../src/shared/BaseSampleManager.js')
    if (window.DOMPurify && typeof window.DOMPurify.addHook !== 'function') {
        window.DOMPurify.addHook = () => {}
    }
    await import('../../src/shared/sanitize.js')
    globalThis.sanitizeHTML = window.sanitizeHTML
    globalThis.escapeHTML = window.escapeHTML
    await import('../../src/soil/soil-log-record.js')
    await import('../../src/soil/soil-script.js')
})

/** @param {boolean[]} shown 머리글 칸이 보이는지 — false면 display:none인 열이다 */
function makeSoilManager(shown = [true, true, true, true, true]) {
    document.body.innerHTML = `
        <div class="table-wrapper">
            <table id="logTable" class="data-table">
                <thead><tr></tr></thead>
                <tbody id="logTableBody"></tbody>
            </table>
        </div>
        <div id="pagination"></div>`

    const headRow = document.querySelector('#logTable thead tr')
    for (const visible of shown) {
        const th = document.createElement('th')
        if (!visible) th.style.display = 'none'
        headRow.appendChild(th)
    }

    const m = new window.SoilSampleManager()
    m.log = () => {}
    m.showToast = () => {}
    m.logTable = document.getElementById('logTable')
    m.tableBody = document.getElementById('logTableBody')
    m.currentSearchFilter = { landClass1: '농가의뢰' }
    m.updatePaginationUI = () => {}
    // 행 빌더는 이 시험의 관심사가 아니다 — 데이터 행임을 알아볼 표시만 남긴다
    m._buildLogTableRow = (row) => {
        const tr = document.createElement('tr')
        tr.dataset.id = row.id
        const td = document.createElement('td')
        td.innerHTML = '<input type="checkbox" class="row-checkbox">'
        tr.appendChild(td)
        return tr
    }
    return m
}

const rows = (n, name = '홍길동') =>
    Array.from({ length: n }, (_, i) => ({ id: 'r' + i, name }))

describe('보이는 열 수 (SLS-1-276)', () => {
    it('숨겨진 열은 빼고 센다', () => {
        const m = makeSoilManager([true, false, true, false, true])
        expect(m._visibleColumnCount()).toBe(3)
    })

    it('모든 열이 숨겨져 있으면 기본 모드 열 수로 떨어진다', () => {
        const m = makeSoilManager([false, false, false])
        expect(m._visibleColumnCount()).toBe(19)
    })

    it('목록을 다시 그리는 도중(tbody가 빈 상태)에도 옳게 센다', () => {
        // 🚨 폭으로 재던 초안은 여기서 무너졌다. tbody를 비우면 표가 통째로
        //    폭 0으로 접혀 "보이는 열 0개"가 되고 폴백 19로 떨어졌다.
        //    실기에서 채움 행 colSpan이 17이어야 할 자리에 19가 찍혔다.
        const m = makeSoilManager([true, false, true, true])
        m.tableBody.innerHTML = ''
        expect(m._visibleColumnCount()).toBe(3)
    })

    it('표가 아예 없으면 기본 모드 열 수로 떨어진다', () => {
        const m = makeSoilManager()
        m.logTable = null
        expect(m._visibleColumnCount()).toBe(19)
    })

    it('구분선과 채움 행이 같은 값을 쓴다', () => {
        // 🚨 예전에는 구분선만 `gongikOn ? 18 : 19`를 손으로 적었다.
        //    열이 하나 늘면 한쪽만 고쳐져 폭이 갈라진다.
        const m = makeSoilManager([true, true, true, true, true])
        const count = m._visibleColumnCount()
        expect(m._buildFarmSeparatorRow(count).cells[0].colSpan).toBe(count)
        expect(m._buildPageFillerRow(count).cells[0].colSpan).toBe(count)
    })
})

describe('채움 행 (SLS-1-276)', () => {
    let m
    beforeEach(() => { m = makeSoilManager() })

    it('마지막 페이지가 짧으면 페이지당 항목 수만큼 채운다', () => {
        m.itemsPerPage = 10
        m.currentFlatRows = rows(25)
        m.totalPages = 3
        m.currentPage = 3            // 마지막 페이지에 5건만 남는다

        m.renderCurrentPage()

        expect(m.tableBody.querySelectorAll('tr[data-id]')).toHaveLength(5)
        expect(m.tableBody.querySelectorAll('tr.page-filler')).toHaveLength(5)
    })

    it('페이지가 하나뿐이면 채우지 않는다', () => {
        // 5건인데 페이지당 100건이면 빈 줄 95개가 생긴다 — 그게 더 이상하다
        m.itemsPerPage = 100
        m.currentFlatRows = rows(5)
        m.totalPages = 1
        m.currentPage = 1

        m.renderCurrentPage()

        expect(m.tableBody.querySelectorAll('tr.page-filler')).toHaveLength(0)
    })

    it('가득 찬 페이지에는 채움 행이 없다', () => {
        m.itemsPerPage = 10
        m.currentFlatRows = rows(25)
        m.totalPages = 3
        m.currentPage = 1

        m.renderCurrentPage()

        expect(m.tableBody.querySelectorAll('tr[data-id]')).toHaveLength(10)
        expect(m.tableBody.querySelectorAll('tr.page-filler')).toHaveLength(0)
    })

    it('채움 행은 선택·삭제·내보내기 대상에 섞이지 않는다', () => {
        // 🚨 이 시험이 이 티켓의 핵심 안전장치다.
        //    체크박스나 data-id가 붙으면 빈 줄이 함께 지워지거나 함께 내보내진다.
        m.itemsPerPage = 10
        m.currentFlatRows = rows(25)
        m.totalPages = 3
        m.currentPage = 3

        m.renderCurrentPage()

        const fillers = m.tableBody.querySelectorAll('tr.page-filler')
        expect(fillers.length).toBeGreaterThan(0)
        for (const tr of fillers) {
            expect(tr.querySelector('.row-checkbox')).toBeNull()
            expect(tr.dataset.id).toBeUndefined()
            expect(tr.getAttribute('aria-hidden')).toBe('true')
        }
        // 데이터 행만 세어야 개수가 맞는다
        expect(m.tableBody.querySelectorAll('.row-checkbox')).toHaveLength(5)
    })
})

describe('넘긴 방향 표시 (SLS-1-276)', () => {
    let m
    beforeEach(() => {
        m = makeSoilManager()
        m.itemsPerPage = 10
        m.currentFlatRows = rows(25)
        m.totalPages = 3
        m.currentPage = 1
    })

    it('다음/이전에 따라 다른 클래스가 붙는다', () => {
        m.renderCurrentPage(1)
        expect(m.tableBody.classList.contains('page-in-next')).toBe(true)
        m.renderCurrentPage(-1)
        expect(m.tableBody.classList.contains('page-in-prev')).toBe(true)
        expect(m.tableBody.classList.contains('page-in-next')).toBe(false)
    })

    it('같은 방향을 연달아 눌러도 클래스가 다시 붙는다', () => {
        // 🚨 클래스에 변화가 없으면 CSS 애니메이션이 두 번째부터 재생되지 않는다.
        //    지웠다가 리플로우를 한 번 강제한 뒤 다시 붙여야 한다.
        let removed = 0
        const realRemove = m.tableBody.classList.remove.bind(m.tableBody.classList)
        m.tableBody.classList.remove = (...args) => {
            if (args.includes('page-in-next')) removed++
            return realRemove(...args)
        }

        m.renderCurrentPage(1)
        m.renderCurrentPage(1)

        expect(removed).toBe(2)
        expect(m.tableBody.classList.contains('page-in-next')).toBe(true)
    })

    it('방향이 없으면(목록 새로 그리기) 클래스를 붙이지 않는다', () => {
        m.renderCurrentPage()
        expect(m.tableBody.classList.contains('page-in-next')).toBe(false)
        expect(m.tableBody.classList.contains('page-in-prev')).toBe(false)
    })
})

describe('페이지 이동 시 표를 맨 위로 (SLS-1-276)', () => {
    it('.table-wrapper의 스크롤을 되돌린다', () => {
        // 🚨 예전에는 존재하지 않는 `.table-container`를 찾아, 오류도 없이
        //    **아무 일도 하지 않았다.** 아래쪽을 보다가 다음 페이지를 누르면
        //    새 페이지의 한가운데부터 보였다.
        const m = makeSoilManager()
        m.itemsPerPage = 10
        m.currentFlatRows = rows(25)
        m.totalPages = 3
        m.currentPage = 1

        const wrapper = document.querySelector('.table-wrapper')
        wrapper.scrollTop = 300
        expect(wrapper.scrollTop).toBe(300)   // jsdom도 값을 그대로 보관한다

        m.goToPage(2)

        expect(wrapper.scrollTop).toBe(0)
    })
})

// ── 퇴비가 쓰는 공용 페이지네이션 ──────────────────────────────

const PAGINATION_SRC = readFileSync(
    join(process.cwd(), 'src', 'shared', 'pagination.js'), 'utf8')

function makePaginationManager(shown = [true, true, true]) {
    document.body.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead><tr></tr></thead>
                <tbody id="logTableBody"></tbody>
            </table>
        </div>
        <div id="pagination"></div>
        <span id="paginationInfo"></span>
        <div id="pageNumbers"></div>`

    const headRow = document.querySelector('thead tr')
    for (const visible of shown) {
        const th = document.createElement('th')
        if (!visible) th.style.display = 'none'
        headRow.appendChild(th)
    }

    const pm = new window.PaginationManager({
        storageKey: 'testItemsPerPage',
        defaultItemsPerPage: 10,
        renderRow: (item) => {
            const tr = document.createElement('tr')
            tr.dataset.id = item.id
            const td = document.createElement('td')
            td.innerHTML = '<input type="checkbox" class="row-checkbox">'
            tr.appendChild(td)
            return tr
        },
    })
    pm.setTableElements(document.getElementById('logTableBody'), null)
    return pm
}

describe('공용 페이지네이션 — 퇴비 (SLS-1-276)', () => {
    beforeAll(() => {
        // IIFE — 실행하면 window.PaginationManager가 붙는다
        new Function(PAGINATION_SRC)()
    })

    it('마지막 페이지를 빈 줄로 채운다', () => {
        const pm = makePaginationManager()
        pm.itemsPerPage = 10
        pm.setData(rows(25))
        pm.goToPage(3)

        expect(pm.elements.tableBody.querySelectorAll('tr[data-id]')).toHaveLength(5)
        expect(pm.elements.tableBody.querySelectorAll('tr.page-filler')).toHaveLength(5)
    })

    it('채움 행은 선택·삭제 대상에 섞이지 않는다', () => {
        const pm = makePaginationManager()
        pm.itemsPerPage = 10
        pm.setData(rows(25))
        pm.goToPage(3)

        for (const tr of pm.elements.tableBody.querySelectorAll('tr.page-filler')) {
            expect(tr.querySelector('.row-checkbox')).toBeNull()
            expect(tr.dataset.id).toBeUndefined()
            expect(tr.getAttribute('aria-hidden')).toBe('true')
        }
        expect(pm.elements.tableBody.querySelectorAll('.row-checkbox')).toHaveLength(5)
    })

    it('페이지당 항목 수를 늘려 한 페이지가 되면 채우지 않는다', () => {
        // 🚨 `totalPages`를 다시 세지 않으면 옛 값(2)이 남아
        //    한 페이지뿐인데 빈 줄 75개를 넣는다.
        const pm = makePaginationManager()
        pm.itemsPerPage = 10
        pm.setData(rows(25))
        expect(pm.totalPages).toBe(3)

        pm.itemsPerPage = 100
        pm.currentPage = 1
        pm.renderCurrentPage()

        expect(pm.totalPages).toBe(1)
        expect(pm.elements.tableBody.querySelectorAll('tr.page-filler')).toHaveLength(0)
    })

    it('페이지당 항목 수를 줄여 여러 페이지가 되면 채운다', () => {
        const pm = makePaginationManager()
        pm.itemsPerPage = 100
        pm.setData(rows(25))
        expect(pm.totalPages).toBe(1)

        pm.itemsPerPage = 10
        pm.currentPage = 3
        pm.renderCurrentPage()

        expect(pm.totalPages).toBe(3)
        expect(pm.elements.tableBody.querySelectorAll('tr.page-filler')).toHaveLength(5)
    })

    it('넘긴 방향에 따라 클래스가 붙는다', () => {
        const pm = makePaginationManager()
        pm.itemsPerPage = 10
        pm.setData(rows(25))

        pm.goToPage(2)
        expect(pm.elements.tableBody.classList.contains('page-in-next')).toBe(true)
        pm.goToPage(1)
        expect(pm.elements.tableBody.classList.contains('page-in-prev')).toBe(true)
    })

    it('행이 되지 못한 항목까지 세어 채운다', () => {
        // 🚨 `renderRow`는 null을 돌려줄 수 있다. 그 항목은 행이 되지 않으므로
        //    `pageData.length`로 채우면 빠진 만큼 표가 짧아진다
        //    (codex 코드 리뷰 지적).
        const pm = makePaginationManager()
        pm.renderRow = (item) => {
            if (item.id === 'r20' || item.id === 'r21') return null   // 두 건은 행이 안 된다
            const tr = document.createElement('tr')
            tr.dataset.id = item.id
            return tr
        }
        pm.itemsPerPage = 10
        pm.setData(rows(25))
        pm.goToPage(3)

        const body = pm.elements.tableBody
        expect(body.querySelectorAll('tr[data-id]')).toHaveLength(3)     // 5건 중 2건이 빠졌다
        expect(body.querySelectorAll('tr.page-filler')).toHaveLength(7)  // 그만큼 더 채운다
        expect(body.querySelectorAll('tr')).toHaveLength(10)             // 합은 언제나 페이지당 항목 수
    })

    it('마지막 페이지가 정확히 가득 차면 채우지 않는다', () => {
        const pm = makePaginationManager()
        pm.itemsPerPage = 10
        pm.setData(rows(20))          // 10 / 10 — 딱 떨어진다
        pm.goToPage(2)

        expect(pm.elements.tableBody.querySelectorAll('tr[data-id]')).toHaveLength(10)
        expect(pm.elements.tableBody.querySelectorAll('tr.page-filler')).toHaveLength(0)
    })

    it('데이터가 하나도 없으면 빈 줄도 만들지 않는다', () => {
        const pm = makePaginationManager()
        pm.itemsPerPage = 10
        pm.setData(rows(25))
        pm.goToPage(3)
        expect(pm.elements.tableBody.querySelectorAll('tr.page-filler').length).toBeGreaterThan(0)

        pm.setData([])                // 필터로 전부 걸러진 상황

        expect(pm.elements.tableBody.querySelectorAll('tr')).toHaveLength(0)
    })

    it('채움 행의 colSpan이 보이는 열 수와 같다', () => {
        const pm = makePaginationManager([true, false, true])   // 가운데 열은 숨김
        pm.itemsPerPage = 10
        pm.setData(rows(25))
        pm.goToPage(3)

        const filler = pm.elements.tableBody.querySelector('tr.page-filler')
        expect(filler.cells[0].colSpan).toBe(2)
    })
})
