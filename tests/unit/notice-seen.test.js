import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

// SLS-1-243: 본 공지 기록을 팝업과 게시판이 공유한다
//
// 🚨 두 화면이 같은 기록을 봐야 한다. 안 그러면
//    - 팝업에서 읽은 공지가 게시판에서 "안 읽음"으로 남고
//    - 게시판에서 읽은 공지가 팝업으로 또 뜬다
//
// ⚠️ 이 파일의 핵심은 **markSeen과 writeSeen의 차이**다.
//    writeSeen은 정리(존재하지 않는 id 제거)를 하고 markSeen은 추가만 한다.
//    게시판이 writeSeen을 쓰면 팝업의 50건 조회 상한에 걸려 기록이 잘려 나간다.

let api
beforeAll(async () => {
    await import('../../src/shared/notice-seen.js')
    api = window.noticeSeen
    expect(api, 'window.noticeSeen이 노출되지 않았다').toBeTruthy()
})

beforeEach(() => { localStorage.clear() })

describe('읽고 쓰기', () => {
    it('1. 빈 저장소는 빈 목록', () => {
        expect(api.readSeen()).toEqual([])
    })

    it('2. writeSeen으로 쓴 것을 readSeen이 읽는다', () => {
        api.writeSeen(['a', 'b'], ['a', 'b', 'c'])
        expect(api.readSeen().sort()).toEqual(['a', 'b'])
    })

    // 손상된 값에 죽으면 게시판·팝업이 함께 멈춘다
    it('3. 손상된 값은 빈 목록으로 (기존 동작)', () => {
        localStorage.setItem(api.SEEN_KEY, '{{ 깨진 JSON')
        expect(api.readSeen()).toEqual([])
        localStorage.setItem(api.SEEN_KEY, '"배열이 아님"')
        expect(api.readSeen()).toEqual([])
    })
})

describe('writeSeen은 정리한다 (팝업 동작 — 바뀌면 안 된다)', () => {
    // 🚨 FIFO 캡으로 밀어내면 무기한 공지가 다시 "안 본 것"이 되어 재출현한다.
    //    그래서 조회 결과에 존재하는 id만 남긴다.
    it('4. 지금 없는 공지 id는 버린다', () => {
        api.writeSeen(['a', 'b', 'deleted'], ['a', 'b'])
        expect(api.readSeen().sort(), '삭제된 공지 id가 남았다').toEqual(['a', 'b'])
    })

    it('5. 중복은 하나로', () => {
        api.writeSeen(['a', 'a', 'b'], ['a', 'b'])
        expect(api.readSeen().sort()).toEqual(['a', 'b'])
    })
})

describe('markSeen은 추가만 한다 (게시판 동작)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 이 파일에서 가장 중요한 단언
    //    게시판이 writeSeen을 쓰면, 팝업이 50건만 조회하므로 그 밖의 기록이
    //    "존재하지 않는 공지"로 잘려 나간다. markSeen은 정리하지 않는다.
    // ══════════════════════════════════════════════════════════════
    it('6. 기존 기록을 지우지 않는다 — 정리가 끼어들면 안 된다', () => {
        api.writeSeen(['old-1', 'old-2'], ['old-1', 'old-2'])
        api.markSeen('new-1')
        expect(api.readSeen().sort(), '기존 기록이 사라졌다 — writeSeen을 쓴 것 아닌가')
            .toEqual(['new-1', 'old-1', 'old-2'])
    })

    it('7. 이미 본 공지는 다시 넣지 않고 false를 준다', () => {
        api.markSeen('a')
        expect(api.markSeen('a'), '중복 추가됐다').toBe(false)
        expect(api.readSeen()).toEqual(['a'])
    })

    it('8. 새로 추가하면 true', () => {
        expect(api.markSeen('a')).toBe(true)
    })

    it('9. 빈 id는 무시한다', () => {
        expect(api.markSeen('')).toBe(false)
        expect(api.markSeen(undefined)).toBe(false)
        expect(api.readSeen()).toEqual([])
    })
})

describe('안 본 공지 골라내기', () => {
    const notices = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    it('10. 기록에 없는 것만 남는다', () => {
        api.writeSeen(['a'], ['a', 'b', 'c'])
        expect(api.unseenOf(notices).map((n) => n.id)).toEqual(['b', 'c'])
    })

    it('11. 전부 봤으면 빈 배열', () => {
        api.writeSeen(['a', 'b', 'c'], ['a', 'b', 'c'])
        expect(api.unseenOf(notices)).toEqual([])
    })

    it('12. seenIds를 직접 넘기면 그것을 쓴다', () => {
        expect(api.unseenOf(notices, ['b']).map((n) => n.id)).toEqual(['a', 'c'])
    })

    it('13. 빈 입력에 죽지 않는다', () => {
        expect(api.unseenOf(null)).toEqual([])
        expect(api.unseenOf([{ }, { id: '' }])).toEqual([])
    })
})

describe('저장 실패에 죽지 않는다', () => {
    // 용량 초과는 실제로 겪은 문제다 (SLS-1-198). 공지가 다시 뜨는 정도로 끝나야 한다.
    it('14. localStorage가 던져도 예외가 새어 나가지 않는다', () => {
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError')
        })
        expect(() => api.markSeen('a')).not.toThrow()
        expect(() => api.writeSeen(['a'], ['a'])).not.toThrow()
        spy.mockRestore()
    })
})
