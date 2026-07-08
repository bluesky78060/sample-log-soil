import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// SLS-1-180: 흙토람 검정결과 표 가로 방향키(←/→) 셀 이동의 가장자리 판정 헬퍼 검증.
//   _caretAtCellStart/_caretAtCellEnd 는 window.getSelection() + Range 로 선택 경계 앞/뒤
//   텍스트 길이를 재어, "커서가 셀 맨앞/맨뒤인지"(전체선택 포함)를 판정한다.
//   두 헬퍼는 this 상태를 쓰지 않으므로 prototype 메서드를 직접 호출해 검증한다.

let caretAtStart
let caretAtEnd

beforeAll(async () => {
    // heuktoram-script.js는 top-level에서 window.HeuktoramManager 를 노출(클래스는 DOMContentLoaded 때만 인스턴스화)
    await import('../../src/heuktoram/heuktoram-script.js')
    const proto = window.HeuktoramManager.prototype
    caretAtStart = (el) => proto._caretAtCellStart.call(null, el)
    caretAtEnd = (el) => proto._caretAtCellEnd.call(null, el)
})

// contentEditable 셀 하나를 만들고, 커서/선택을 세팅하는 헬퍼
function makeCell(text) {
    document.body.innerHTML = ''
    const el = document.createElement('td')
    el.className = 'editable-cell'
    el.contentEditable = 'true'
    el.textContent = text
    document.body.appendChild(el)
    return el
}

// collapsed 커서를 offset 위치에 놓는다
function placeCaret(el, offset) {
    const sel = window.getSelection()
    const r = document.createRange()
    if (el.firstChild) {
        r.setStart(el.firstChild, offset)
    } else {
        r.setStart(el, 0) // 빈 셀
    }
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
}

// 셀 전체를 선택한다(moveFocus 진입 시 상태 재현)
function selectAll(el) {
    const sel = window.getSelection()
    const r = document.createRange()
    r.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(r)
}

describe('SLS-1-180 _caretAtCellStart/_caretAtCellEnd — 가장자리 판정', () => {
    beforeEach(() => { document.body.innerHTML = '' })

    it('커서가 값 맨 앞(offset 0): start=true, end=false', () => {
        const el = makeCell('1234')
        placeCaret(el, 0)
        expect(caretAtStart(el)).toBe(true)
        expect(caretAtEnd(el)).toBe(false)
    })

    it('커서가 값 맨 뒤(offset length): start=false, end=true', () => {
        const el = makeCell('1234')
        placeCaret(el, 4)
        expect(caretAtStart(el)).toBe(false)
        expect(caretAtEnd(el)).toBe(true)
    })

    it('커서가 값 중간(offset 2): start=false, end=false → 텍스트 커서 이동 유지', () => {
        const el = makeCell('1234')
        placeCaret(el, 2)
        expect(caretAtStart(el)).toBe(false)
        expect(caretAtEnd(el)).toBe(false)
    })

    it('빈 셀: start=true, end=true → ←/→ 모두 즉시 이동', () => {
        const el = makeCell('')
        placeCaret(el, 0)
        expect(caretAtStart(el)).toBe(true)
        expect(caretAtEnd(el)).toBe(true)
    })

    it('전체 선택(moveFocus 진입 상태): start=true, end=true → 좌우 한 번에 이동 (critic MAJOR-1)', () => {
        const el = makeCell('1234')
        selectAll(el)
        expect(caretAtStart(el)).toBe(true)
        expect(caretAtEnd(el)).toBe(true)
    })

    it('선택 없음(rangeCount 0): 둘 다 false (방어)', () => {
        const el = makeCell('1234')
        window.getSelection().removeAllRanges()
        expect(caretAtStart(el)).toBe(false)
        expect(caretAtEnd(el)).toBe(false)
    })
})
