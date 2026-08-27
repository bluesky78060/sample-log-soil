// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// SLS-1-278: 열이 늘고 줄어도 보던 열이 화면에서 같은 자리에 남는다
//
// 🚨 무엇을 지키는 시험인가
//    · 기준 열은 **가로로 고정되지 않은** 열이어야 한다. 성명(왼쪽 고정)은 전체 보기에서
//      좌표 자체가 바뀌므로(365→435) 스크롤로 되돌릴 수 없다. 관리(오른쪽 고정)는
//      언제나 제자리다. 둘 중 하나라도 기준이 되면 **보정량이 통째로 틀린다.**
//    · `position`으로 판별하면 안 된다 — `thead th`가 전부 `position: sticky`(세로 고정)다.
//    · 바뀌면서 **사라진 열**은 건너뛴다. 전체 보기를 끌 때 첫 일반 열(우편번호)이
//      바로 사라진다.
//    · 스크롤은 표가 아니라 `.table-wrapper`의 것이다.
//
// jsdom은 레이아웃을 계산하지 않는다. 각 칸의 getBoundingClientRect를 직접 세우고,
// getComputedStyle도 대신 세운다.

const MODULE = readFileSync(
    join(process.cwd(), 'src', 'shared', 'table-scroll-anchor.js'), 'utf8')

/** 감싼 칸이 차지하는 화면 구간 — 이 밖의 열은 기준이 되지 못한다 */
const VIEW = { left: 0, right: 1000 }
/** 머리글 칸 하나의 폭. rect.right 계산에만 쓴다 */
const CELL_W = 80

/**
 * @param {Array<{name:string, left:number, display?:string, stick?:'left'|'right'}>} cols
 */
function makeTable(cols) {
    document.body.innerHTML = '<div class="table-wrapper"><table id="logTable"><thead><tr></tr></thead><tbody></tbody></table></div>'
    const wrapper = document.querySelector('.table-wrapper')
    wrapper.getBoundingClientRect = () => ({
        left: VIEW.left, right: VIEW.right, top: 0, bottom: 0,
        width: VIEW.right - VIEW.left, height: 0,
    })
    const table = document.getElementById('logTable')
    const headRow = table.querySelector('thead tr')

    // jsdom에는 스크롤이 없다 — 값을 그대로 보관하는 속성으로 대신한다
    let scrollLeft = 0
    Object.defineProperty(wrapper, 'scrollLeft', {
        get: () => scrollLeft,
        set: (v) => { scrollLeft = v },
        configurable: true,
    })

    const styles = new Map()
    const lefts = new Map()
    for (const c of cols) {
        const th = document.createElement('th')
        th.dataset.name = c.name
        styles.set(th, {
            display: c.display ?? 'table-cell',
            left: c.stick === 'left' ? '100px' : 'auto',
            right: c.stick === 'right' ? '0px' : 'auto',
        })
        lefts.set(th, c.left)
        th.getBoundingClientRect = () => {
            const left = lefts.get(th)
            return { left, right: left + CELL_W, top: 0, bottom: 0, width: CELL_W, height: 0 }
        }
        headRow.appendChild(th)
    }

    const real = window.getComputedStyle
    window.getComputedStyle = (el) => styles.get(el) || real(el)
    restore = () => { window.getComputedStyle = real }

    return {
        table,
        wrapper,
        /** 열 구성이 바뀐 뒤의 상태를 흉내낸다 */
        move(name, left) { for (const [th, v] of lefts) if (th.dataset.name === name) lefts.set(th, left) },
        hide(name) { for (const [th, s] of styles) if (th.dataset.name === name) s.display = 'none' },
        show(name, left) {
            for (const [th, s] of styles) if (th.dataset.name === name) { s.display = 'table-cell'; lefts.set(th, left) }
        },
    }
}

let restore
afterEach(() => { restore?.(); document.body.innerHTML = '' })

describe('열 구성이 바뀔 때 보던 열을 제자리에 (SLS-1-278)', () => {
    beforeAll(() => {
        // IIFE — 실행하면 window.captureColumnAnchor가 붙는다
        new Function(MODULE)()
    })

    it('일반 열이 밀린 만큼 가로 스크롤을 되돌린다', () => {
        const t = makeTable([
            { name: '성명', left: 100, stick: 'left' },
            { name: '주소', left: 300 },
            { name: '작물', left: 500 },
        ])

        t.wrapper.scrollLeft = 250            // 이미 오른쪽으로 민 상태
        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('주소', 451)      // 전체 보기로 +151px 밀렸다
        t.move('작물', 651)

        expect(restoreAnchor()).toBe(151)
        expect(t.wrapper.scrollLeft).toBe(401)
    })

    it('맨 왼쪽에 있었으면 되돌리지 않는다', () => {
        // 🚨 E2E가 잡아낸 것. '전체 보기'를 켜는 사람은 숨어 있던 열을 보려는 것인데,
        //    맨 왼쪽에서 150px를 밀어 "보던 자리를 지켜" 주면 **보려던 그 열이
        //    화면 밖으로 밀려난다.**
        const t = makeTable([
            { name: '성명', left: 100, stick: 'left' },
            { name: '주소', left: 300 },
        ])
        t.wrapper.scrollLeft = 0

        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('주소', 451)

        expect(restoreAnchor()).toBe(0)
        expect(t.wrapper.scrollLeft).toBe(0)
    })

    it('새로 나타난 열의 폭보다 덜 밀어 놓았으면 되돌리지 않는다', () => {
        // 🚨 `=== 0`만 예외로 두면 **1px 민 상태에서도 150px 튄다**
        //    (codex 코드 리뷰 지적). 경계는 새 열이 차지한 폭(shift)이다.
        const t = makeTable([{ name: '주소', left: 300 }])
        t.wrapper.scrollLeft = 100            // 151보다 적게 밀어 둔 상태

        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('주소', 451)                   // 151px 밀렸다

        expect(restoreAnchor()).toBe(0)
        expect(t.wrapper.scrollLeft).toBe(100)
    })

    it('1px만 밀어 놓았어도 되돌리지 않는다', () => {
        const t = makeTable([{ name: '주소', left: 300 }])
        t.wrapper.scrollLeft = 1

        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('주소', 451)

        expect(restoreAnchor()).toBe(0)
        expect(t.wrapper.scrollLeft).toBe(1)
    })

    it('열이 줄 때는 조금만 밀어 놓았어도 되돌린다', () => {
        // 보던 것이 왼쪽으로 밀리므로 언제나 따라가는 것이 옳다.
        // 넘치면 브라우저가 0으로 잘라 준다.
        const t = makeTable([{ name: '주소', left: 400 }])
        t.wrapper.scrollLeft = 30

        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('주소', 249)                   // 151px 왼쪽으로

        expect(restoreAnchor()).toBe(-151)
    })

    it('흡수 열 앞뒤의 이동량이 다르면 화면에 보이는 쪽을 기준으로 삼는다', () => {
        // 🚨 SLS-1-279가 이 전제를 깨뜨렸다. 남는 폭을 흡수하는 열이 생기면
        //    **그 앞 열과 뒤 열의 이동량이 서로 다르다.** 표의 첫 일반 열을 그냥
        //    쓰면, 뒤쪽을 보고 있던 사용자의 화면이 그 차이만큼 어긋난다.
        //    E2E 실측에서 128px 벌어졌다.
        const t = makeTable([
            { name: '성명', left: 100, stick: 'left' },   // 고정 → covered = 180
            { name: '주소', left: 120 },                  // 고정 열에 온전히 가려짐(right 200 > 181이라 후보)
            { name: '작물', left: 500 },                  // 화면에 보이는 열
        ])
        t.wrapper.scrollLeft = 300

        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('주소', 20)      // 흡수 열 앞 — 왼쪽으로 100
        t.move('작물', 460)     // 흡수 열 뒤 — 왼쪽으로 40

        // 첫 후보('주소', right 200 > covered 181)가 잡히므로 그 열의 이동량을 쓴다
        expect(restoreAnchor()).toBe(-100)
    })

    it('고정 열에 온전히 가려진 열은 기준이 되지 않는다', () => {
        const t = makeTable([
            { name: '성명', left: 100, stick: 'left' },   // 고정 → covered = 180
            { name: '가림', left: 50 },                   // right 130 ≤ 181 → 가려짐
            { name: '작물', left: 500 },
        ])
        t.wrapper.scrollLeft = 300

        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('가림', -100)    // 가려진 열은 150 움직였지만 쓰이면 안 된다
        t.move('작물', 460)     // 보이는 열은 40

        expect(restoreAnchor()).toBe(-40)
    })

    it('화면 오른쪽 바깥의 열은 기준이 되지 않는다', () => {
        const t = makeTable([
            { name: '성명', left: 100, stick: 'left' },
            { name: '바깥', left: 1200 },                 // VIEW.right(1000) 밖
            { name: '작물', left: 500 },
        ])
        t.wrapper.scrollLeft = 300

        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('바깥', 900)     // 300 움직였지만 화면 밖이라 쓰이면 안 된다
        t.move('작물', 460)

        expect(restoreAnchor()).toBe(-40)
    })

    it('왼쪽 고정 열은 기준이 되지 않는다', () => {
        // 🚨 성명은 sticky-col이라 전체 보기에서 좌표 자체가 바뀐다(실측 +76px).
        //    그걸 기준으로 삼으면 76px만 보정해 일반 열이 75px 어긋난 채 남는다.
        const t = makeTable([
            { name: '성명', left: 100, stick: 'left' },
            { name: '주소', left: 300 },
        ])

        t.wrapper.scrollLeft = 250
        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('성명', 176)      // 고정 좌표가 바뀌어 76px 이동
        t.move('주소', 451)      // 일반 열은 151px 이동

        expect(restoreAnchor()).toBe(151)   // 76이 아니다
    })

    it('오른쪽 고정 열도 기준이 되지 않는다', () => {
        const t = makeTable([
            { name: '관리', left: 900, stick: 'right' },
            { name: '주소', left: 300 },
        ])

        t.wrapper.scrollLeft = 250
        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('주소', 451)
        // 관리는 right:0이라 제자리 — 그걸 기준 삼으면 0이 되어 아무것도 안 한다

        expect(restoreAnchor()).toBe(151)
    })

    it('숨긴 열은 기준이 되지 않는다', () => {
        const t = makeTable([
            { name: '우편번호', left: 250, display: 'none' },
            { name: '주소', left: 300 },
        ])

        t.wrapper.scrollLeft = 250
        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('주소', 451)

        expect(restoreAnchor()).toBe(151)
    })

    it('바뀌면서 사라진 열은 건너뛰고 다음 후보를 쓴다', () => {
        // 🚨 전체 보기를 **끌 때** 첫 일반 열(우편번호)이 바로 사라진다.
        //    후보를 하나만 잡았다면 여기서 보정이 통째로 어긋난다.
        const t = makeTable([
            { name: '우편번호', left: 300 },
            { name: '주소', left: 400 },
        ])

        t.wrapper.scrollLeft = 400
        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.hide('우편번호')          // 기본 보기로 돌아가며 사라졌다
        t.move('주소', 249)         // 남은 열은 151px 왼쪽으로

        expect(restoreAnchor()).toBe(-151)
        expect(t.wrapper.scrollLeft).toBe(249)
    })

    it('움직이지 않았으면 스크롤을 건드리지 않는다', () => {
        const t = makeTable([{ name: '주소', left: 300 }])

        t.wrapper.scrollLeft = 250
        const restoreAnchor = window.captureColumnAnchor(t.table)

        expect(restoreAnchor()).toBe(0)
        expect(t.wrapper.scrollLeft).toBe(250)   // 그대로다
    })

    it('기준이 될 열이 하나도 없으면 아무것도 하지 않는다', () => {
        const t = makeTable([
            { name: '성명', left: 100, stick: 'left' },
            { name: '관리', left: 900, stick: 'right' },
        ])

        t.wrapper.scrollLeft = 250
        const restoreAnchor = window.captureColumnAnchor(t.table)

        expect(restoreAnchor()).toBe(0)
        expect(t.wrapper.scrollLeft).toBe(250)
    })

    it('후보가 전부 사라져도 죽지 않는다', () => {
        const t = makeTable([{ name: '주소', left: 300 }])

        t.wrapper.scrollLeft = 250
        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.hide('주소')

        expect(restoreAnchor()).toBe(0)
    })

    it('표가 없거나 감싼 칸이 없어도 죽지 않는다', () => {
        expect(window.captureColumnAnchor(null)()).toBe(0)

        // 감싼 칸 밖에 있는 표
        const orphan = document.createElement('table')
        orphan.appendChild(document.createElement('thead')).insertRow()
        document.body.appendChild(orphan)
        expect(window.captureColumnAnchor(orphan)()).toBe(0)

        // 머리글이 아예 없는 표
        document.body.innerHTML = '<div class="table-wrapper"><table id="t2"></table></div>'
        expect(window.captureColumnAnchor(document.getElementById('t2'))()).toBe(0)
    })

    it('스크롤을 표가 아니라 감싼 칸에 준다', () => {
        // 🚨 `table.scrollLeft`를 건드리면 아무 일도 일어나지 않는다
        //    (codex 플랜 리뷰 지적).
        const t = makeTable([{ name: '주소', left: 300 }])
        t.wrapper.scrollLeft = 250
        let tableScroll = 0
        Object.defineProperty(t.table, 'scrollLeft', {
            get: () => tableScroll, set: (v) => { tableScroll = v }, configurable: true,
        })

        const restoreAnchor = window.captureColumnAnchor(t.table)
        t.move('주소', 451)
        restoreAnchor()

        expect(t.wrapper.scrollLeft).toBe(401)
        expect(tableScroll).toBe(0)
    })
})
