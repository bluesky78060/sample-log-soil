// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// SLS-1-264: 고정 열 좌표 계산 규칙
//
// 🚨 왜 유닛으로도 보는가
//    E2E는 **지금 화면에 있는 열 구성**만 볼 수 있다. 그래서 두 가지 방어를
//    구별하지 못했다(변이 시험에서 살아남았다):
//      · 숨겨진 열 건너뛰기 — 지금은 첫 고정 열(체크박스)이 항상 보여서,
//        건너뛰기를 빼도 결과가 같다. 하지만 앞으로 첫 열이 숨겨지는 설정이
//        생기면 기준점이 0으로 잡혀 **전체 좌표가 어긋난다.**
//      · 오른쪽 고정 열 제외 — 관리 열은 마지막이라 빼먹어도 앞 열에 영향이 없다.
//        중간에 오른쪽 고정이 생기면 그때 깨진다.
//
//    "지금은 문제가 안 되니 괜찮다"로 두면, 정작 문제가 될 때 알려 줄 것이 없다.
//    여기서는 그 상황을 **직접 만들어** 확인한다.
//
// jsdom은 레이아웃을 계산하지 않는다(offsetLeft·offsetWidth가 늘 0).
// 그래서 각 칸에 값을 직접 심고 getComputedStyle을 대신 세운다.

const MODULE = readFileSync(
    join(process.cwd(), 'src', 'shared', 'sticky-columns.js'), 'utf8')

/** @param {Array<{cls:string,left:number,width:number,right?:string}>} cols */
function makeTable(cols, id = 'logTable') {
    const table = document.createElement('table')
    table.id = id
    const head = table.createTHead()
    const tr = head.insertRow()
    const styles = new Map()
    for (const c of cols) {
        const th = document.createElement('th')
        th.className = `${c.cls} sticky-col`
        Object.defineProperty(th, 'offsetLeft', { value: c.left })
        Object.defineProperty(th, 'offsetWidth', { value: c.width })
        styles.set(th, { right: c.right ?? 'auto' })
        tr.appendChild(th)
    }
    document.body.appendChild(table)
    return { table, styles }
}

let restore
function stubComputedStyle(styles) {
    const real = window.getComputedStyle
    restore = () => { window.getComputedStyle = real }
    window.getComputedStyle = (el) => styles.get(el) || real(el)
}

describe('고정 열 좌표 계산 (SLS-1-264)', () => {
    beforeAll(() => {
        // IIFE — 실행하면 window.buildStickyColumnRules가 붙는다
        new Function(MODULE)()
    })
    afterEach(() => { restore?.(); document.body.innerHTML = '' })

    const build = (cols, id) => {
        const { table, styles } = makeTable(cols, id)
        stubComputedStyle(styles)
        return window.buildStickyColumnRules(table)
    }

    it('첫 칸을 기준으로 상대 좌표를 만든다', () => {
        // 표가 페이지 안쪽에 있으면 offsetLeft가 0에서 시작하지 않는다
        const css = build([
            { cls: 'col-checkbox', left: 100, width: 40 },
            { cls: 'col-num', left: 140, width: 65 },
            { cls: 'col-name', left: 205, width: 70 },
        ])
        expect(css).toBe('#logTable .col-checkbox{left:0px}'
            + '#logTable .col-num{left:40px}'
            + '#logTable .col-name{left:105px}')
    })

    it('숨겨진 열은 건너뛴다 — 첫 칸이 숨겨져도 기준이 어긋나지 않는다', () => {
        // 이게 이 시험의 핵심이다. 건너뛰기를 빼면 base가 숨은 칸의 0이 되어
        // 모든 좌표가 통째로 밀린다.
        const css = build([
            { cls: 'col-hidden-first', left: 0, width: 0 },   // display:none
            { cls: 'col-checkbox', left: 100, width: 40 },
            { cls: 'col-name', left: 140, width: 70 },
        ])
        expect(css, '숨은 칸이 기준이 되어 좌표가 어긋났다')
            .toBe('#logTable .col-checkbox{left:0px}#logTable .col-name{left:40px}')
    })

    it('중간에 숨겨진 열이 있어도 그 자리를 비우지 않는다', () => {
        // 경지구분 숨김(SLS-1-261)이 이 경우다 — 숨은 열은 자리를 차지하지 않으므로
        // 뒤 열이 그 자리로 당겨져야 한다. offsetLeft가 이미 그 값이다.
        const css = build([
            { cls: 'col-checkbox', left: 0, width: 40 },
            { cls: 'col-landclass1', left: 40, width: 0 },   // 숨김
            { cls: 'col-name', left: 40, width: 70 },
        ])
        expect(css).toBe('#logTable .col-checkbox{left:0px}#logTable .col-name{left:40px}')
    })

    it('오른쪽 고정 열은 왼쪽 좌표 계산에서 뺀다', () => {
        // 관리 열(SLS-1-260)은 `right: 0`이라 left를 주면 안 된다.
        const css = build([
            { cls: 'col-checkbox', left: 0, width: 40 },
            { cls: 'col-action', left: 900, width: 140, right: '0px' },
            { cls: 'col-name', left: 40, width: 70 },
        ])
        expect(css, '오른쪽 고정 열에 left 규칙이 붙었다').not.toContain('col-action')
        expect(css).toBe('#logTable .col-checkbox{left:0px}#logTable .col-name{left:40px}')
    })

    it('오른쪽 고정이 맨 앞에 와도 기준을 가로채지 않는다', () => {
        const css = build([
            { cls: 'col-action', left: 900, width: 140, right: '0px' },
            { cls: 'col-checkbox', left: 100, width: 40 },
            { cls: 'col-name', left: 140, width: 70 },
        ])
        expect(css).toBe('#logTable .col-checkbox{left:0px}#logTable .col-name{left:40px}')
    })

    it('sticky-col이 아닌 열은 무시한다', () => {
        const { table, styles } = makeTable([
            { cls: 'col-checkbox', left: 0, width: 40 },
            { cls: 'col-name', left: 40, width: 70 },
        ])
        const plain = document.createElement('th')
        plain.className = 'col-address'          // sticky-col 없음
        Object.defineProperty(plain, 'offsetLeft', { value: 110 })
        Object.defineProperty(plain, 'offsetWidth', { value: 200 })
        table.tHead.rows[0].appendChild(plain)
        stubComputedStyle(styles)
        expect(window.buildStickyColumnRules(table)).not.toContain('col-address')
    })

    it('표 id를 선택자에 넣는다 — 페이지 CSS보다 특이도가 높아야 한다', () => {
        const css = build([{ cls: 'col-checkbox', left: 0, width: 40 }], 'otherTable')
        expect(css).toBe('#otherTable .col-checkbox{left:0px}')
    })

    it('머리글이 없으면 빈 문자열', () => {
        const t = document.createElement('table')
        t.id = 'x'
        document.body.appendChild(t)
        expect(window.buildStickyColumnRules(t)).toBe('')
    })
})
