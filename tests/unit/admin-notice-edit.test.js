import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// SLS-1-245: 공지 수정
//
// 🚨 관리자 화면은 Firestore를 직접 쓰고 로컬 폴백이 없어 E2E를 만들 수 없다.
//    그래서 **저장할 문서를 만드는 순수 함수**로 분리해 여기서 검증한다.
//    이 파일이 지키지 못하면 확인할 곳이 없다.
//
// ⚠️ 수정은 update()가 아니라 **set()으로 문서를 교체**한다.
//    `until`을 지우려면 FieldValue.delete() sentinel이 필요한데 `firebase` 전역이 없다
//    (window.feedbackFirebase는 getDb 등만 노출 — 계획 리뷰에서 잡혔다).
//    set이면 그 키를 안 넣는 것만으로 삭제가 되지만, **원본 필드를 함께 넘겨야 한다.**

let build
let api
beforeAll(async () => {
    // admin-script.js는 모듈 최상단에서 DOM/Firebase를 건드리지 않는다 —
    // init()은 DOMContentLoaded에서만 돈다.
    await import('../../src/shared/sanitize.js')
    await import('../../src/shared/notice-date.js')
    await import('../../src/feedback-admin/admin-script.js')
    api = window.__adminNotice
    build = api?.buildNoticePayload
    expect(build, 'window.__adminNotice가 노출되지 않았다').toBeTypeOf('function')
})

const FORM = { title: '공지 제목', body: '공지 내용', popup: false, until: '' }

describe('등록', () => {
    it('1. createdAt이 찍힌다', () => {
        const p = build(FORM, null)
        expect(p.createdAt, '등록인데 createdAt이 없다').toBeTruthy()
        expect(new Date(p.createdAt).toString()).not.toBe('Invalid Date')
    })

    it('2. 종료일이 비면 until 키가 아예 없다', () => {
        expect('until' in build(FORM, null), '빈 until이 저장된다').toBe(false)
    })

    it('3. 종료일이 있으면 들어간다', () => {
        expect(build({ ...FORM, until: '2026-09-30' }, null).until).toBe('2026-09-30')
    })
})

describe('수정', () => {
    const ORIGINAL = {
        id: 'doc-1',
        title: '옛 제목',
        body: '옛 내용',
        createdAt: '2026-08-01T09:00:00.000Z',
        popup: true,
        until: '2026-08-31',
    }

    // ══════════════════════════════════════════════════════════════
    // 🚨 이 파일에서 가장 중요한 단언
    //    createdAt을 새로 찍으면 수정할 때마다 목록 맨 위로 올라가
    //    사용자에게 새 공지처럼 보인다 — 지금 삭제 후 재등록을 강요당하는 이유다.
    // ══════════════════════════════════════════════════════════════
    it('4. createdAt이 원본 그대로 보존된다', () => {
        const p = build({ ...FORM, title: '새 제목' }, ORIGINAL)
        expect(p.createdAt, '등록 시각이 바뀌었다 — 목록 순서가 흐트러진다')
            .toBe(ORIGINAL.createdAt)
    })

    it('5. 바꾼 값이 반영된다', () => {
        const p = build({ title: '새 제목', body: '새 내용', popup: true, until: '2026-12-31' }, ORIGINAL)
        expect(p.title).toBe('새 제목')
        expect(p.body).toBe('새 내용')
        expect(p.popup).toBe(true)
        expect(p.until).toBe('2026-12-31')
    })

    // 🚨 set()이라 키가 없으면 그대로 사라진다 — 그것이 "종료일 비우기"의 구현이다
    it('6. 종료일을 비우면 until 키가 사라진다', () => {
        const p = build({ ...FORM, until: '' }, ORIGINAL)
        expect('until' in p, '빈 종료일인데 필드가 남았다 — 계속 만료 상태가 된다').toBe(false)
    })

    it('6-b. 공백만 있어도 비운 것으로 본다', () => {
        expect('until' in build({ ...FORM, until: '   ' }, ORIGINAL)).toBe(false)
    })

    // 🚨 set()은 문서를 통째로 갈아끼운다. 원본을 안 펼치면 모르는 필드가 조용히 사라진다.
    it('7. 원본의 다른 필드가 보존된다', () => {
        const withExtra = { ...ORIGINAL, authorUid: 'admin-9', pinned: true }
        const p = build(FORM, withExtra)
        expect(p.authorUid, 'set으로 교체하며 필드를 잃었다').toBe('admin-9')
        expect(p.pinned).toBe(true)
    })

    it('8. id는 문서 필드로 저장하지 않는다', () => {
        expect('id' in build(FORM, ORIGINAL), 'id가 문서 안에 들어갔다').toBe(false)
    })
})

describe('값 정리', () => {
    // notice-popup.js가 `popup === true`로 엄격 비교한다 — truthy로 두면 안 된다
    it('9. popup은 항상 boolean이다', () => {
        for (const v of [undefined, null, '', 'true', 1, 0]) {
            const p = build({ ...FORM, popup: v }, null)
            expect(typeof p.popup, `popup=${JSON.stringify(v)}가 boolean이 아니다`).toBe('boolean')
        }
        expect(build({ ...FORM, popup: 'true' }, null).popup, '문자열 truthy를 참으로 봤다').toBe(false)
        expect(build({ ...FORM, popup: true }, null).popup).toBe(true)
    })

    it('10. 제목·내용의 앞뒤 공백은 지운다', () => {
        const p = build({ ...FORM, title: '  제목  ', body: '  내용  ' }, null)
        expect(p.title).toBe('제목')
        expect(p.body).toBe('내용')
    })

    it('11. 빠진 값에 죽지 않는다', () => {
        const p = build({}, null)
        expect(p.title).toBe('')
        expect(p.body).toBe('')
        expect(p.popup).toBe(false)
        // 등록 경로이므로 createdAt은 있어야 하고, 빈 until은 없어야 한다
        expect(p.createdAt, '등록인데 createdAt이 빠졌다').toBeTruthy()
        expect('until' in p, '빈 until이 들어갔다').toBe(false)
    })
})

// ══════════════════════════════════════════════════════════════
// 🚨 payload만 보면 구현을 update()로 되돌려도 대부분 통과한다 (코드리뷰 지적).
//    여기서는 **저장 경로 자체**를 본다 — Firestore를 가짜로 세워 호출을 기록한다.
// ══════════════════════════════════════════════════════════════
describe('저장 경로', () => {
    let calls
    let existing

    const stubDom = () => {
        document.body.innerHTML = `
            <form id="noticeForm">
                <input id="noticeTitle"><textarea id="noticeBody"></textarea>
                <input type="checkbox" id="noticePopup"><input id="noticeUntil">
                <span id="noticeFormTitle"></span>
                <button id="noticeSubmitBtn"></button>
                <button id="noticeCancelBtn" hidden></button>
                <small id="noticeEditHint" hidden></small>
            </form>
            <div id="noticeList"></div>`
        document.getElementById('noticeTitle').value = '새 제목'
        document.getElementById('noticeBody').value = '새 내용'
    }

    beforeEach(() => {
        calls = []
        existing = { title: '옛 제목', body: '옛 내용', createdAt: '2026-08-01T00:00:00.000Z', popup: true, until: '2026-08-31' }
        stubDom()
        // 목록 새로고침은 이 테스트의 관심사가 아니다 — 조회는 빈 결과로 둔다
        const collection = () => ({
            add: (payload) => { calls.push(['add', null, payload]); return Promise.resolve({ id: 'new' }) },
            get: () => Promise.resolve({ forEach: () => {} }),
            doc: (id) => ({
                get: () => Promise.resolve(
                    existing ? { exists: true, id, data: () => existing } : { exists: false }
                ),
                set: (payload) => { calls.push(['set', id, payload]); return Promise.resolve() },
                update: (payload) => { calls.push(['update', id, payload]); return Promise.resolve() },
                delete: () => { calls.push(['delete', id]); return Promise.resolve() },
            }),
        })
        window.feedbackFirebase = { getDb: () => ({ collection }) }
        window.showToast = vi.fn()
        // jsdom에는 scrollIntoView가 없다 — startEditNotice가 부른다
        Element.prototype.scrollIntoView = vi.fn()
        // ⚠️ 폼 값을 넣기 **전에** 초기화한다. 순서가 뒤바뀌면 방금 넣은 값을 지워
        //    "제목이 비어 저장 안 됨"이 되고, 테스트가 엉뚱한 이유로 실패한다.
        api.resetNoticeForm()
        document.getElementById('noticeTitle').value = '새 제목'
        document.getElementById('noticeBody').value = '새 내용'
    })

    const submit = () => api.addNotice({ preventDefault() {} })

    /** 편집 모드로 들어간 뒤 폼에 새 값을 넣는다 (startEditNotice가 원본값으로 채우므로) */
    const startEditWithNewValues = (doc) => {
        api.startEditNotice(doc)
        document.getElementById('noticeTitle').value = '새 제목'
        document.getElementById('noticeBody').value = '새 내용'
    }

    it('12. 편집 중이 아니면 add로 새로 만든다', async () => {
        await submit()
        expect(calls.map((c) => c[0]), 'add가 아니다').toEqual(['add'])
    })

    it('13. 편집 중이면 그 문서에 set 한다', async () => {
        startEditWithNewValues({ id: 'doc-1', ...existing })
        await submit()
        const write = calls.find((c) => c[0] !== 'get')
        expect(write?.[0], 'set으로 저장하지 않았다').toBe('set')
        expect(write?.[1], '다른 문서에 썼다').toBe('doc-1')
        expect(write?.[2].createdAt, '등록 시각이 바뀌었다').toBe(existing.createdAt)
    })

    // 🚨 코드리뷰 MAJOR — set()은 없는 문서를 **새로 만든다.**
    //    편집하는 동안 그 공지가 지워졌다면 되살아난다.
    it('14. 편집 중 그 공지가 삭제됐으면 되살리지 않는다', async () => {
        startEditWithNewValues({ id: 'doc-1', ...existing })
        existing = null                       // 그 사이 다른 곳에서 삭제됨

        await submit()
        expect(calls.some((c) => c[0] === 'set'), '삭제된 공지를 set으로 되살렸다').toBe(false)
        expect(window.showToast).toHaveBeenCalledWith(
            expect.stringContaining('삭제'), 'warning')
    })

    // 편집 시작 시점의 낡은 값이 아니라, 저장 직전에 다시 읽은 값을 원본으로 삼는다
    it('15. 그 사이 바뀐 다른 필드를 낡은 값으로 덮지 않는다', async () => {
        startEditWithNewValues({ id: 'doc-1', ...existing })
        existing = { ...existing, pinned: true }   // 다른 관리자가 추가한 필드

        await submit()
        const write = calls.find((c) => c[0] === 'set')
        expect(write?.[2].pinned, '편집 시작 시점의 낡은 문서로 덮었다').toBe(true)
    })

    it('16. 제목이나 내용이 비면 저장하지 않는다', async () => {
        document.getElementById('noticeTitle').value = ''
        await submit()
        expect(calls.filter((c) => c[0] === 'add' || c[0] === 'set'), '빈 제목인데 저장됐다')
            .toEqual([])
    })
})
