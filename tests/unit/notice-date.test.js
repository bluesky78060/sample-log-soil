import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SLS-1-219 코드리뷰 MAJOR: 공지 만료 날짜 계산이 두 곳에서 갈라졌다.
//   팝업(notice-popup.js)  — getFullYear/getMonth/getDate (로컬)
//   관리자(admin-script.js) — new Date().toISOString().slice(0,10) (UTC)
// KST(UTC+9)에서는 매일 00:00~08:59에 두 값이 하루 차이 난다. 그 구간에 사용자 팝업은
// 이미 만료 처리했는데 관리자 화면은 "아직 활성"으로 보여 오판을 유발한다.
//
// 이 파일은 (1) 유틸 자체의 계약과 (2) **두 소비자가 직접 날짜를 만들지 않는다**를 고정한다.
// (2)가 없으면 나중에 누가 다시 toISOString()을 쓰면서 같은 결함이 재발한다.

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

beforeEach(async () => {
    vi.resetModules()
    await import('../../src/shared/notice-date.js')
})

afterEach(() => {
    vi.useRealTimers()
})

describe('noticeTodayStr — 로컬 기준', () => {
    it('로컬 달력 날짜를 준다 (UTC로 넘어가도 흔들리지 않는다)', () => {
        // KST 09:00 = UTC 00:00 — UTC 기준이면 같은 날이지만,
        // KST 00:30 = 전날 UTC 15:30 — 여기서 UTC/로컬이 갈린다.
        const kstEarlyMorning = new Date(2026, 6, 31, 0, 30, 0) // 2026-07-31 00:30 로컬
        expect(window.noticeTodayStr(kstEarlyMorning)).toBe('2026-07-31')
    })

    it('한 자리 월·일을 0으로 채운다', () => {
        expect(window.noticeTodayStr(new Date(2026, 0, 5))).toBe('2026-01-05')
    })

    it('인자를 주지 않으면 현재 시각을 쓴다', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 6, 30, 23, 59))
        expect(window.noticeTodayStr()).toBe('2026-07-30')
    })
})

describe('isNoticeExpired', () => {
    it('until이 없으면 절대 만료되지 않는다', () => {
        expect(window.isNoticeExpired(undefined, '2099-12-31')).toBe(false)
        expect(window.isNoticeExpired('', '2099-12-31')).toBe(false)
        expect(window.isNoticeExpired(null, '2099-12-31')).toBe(false)
    })

    it('until 당일은 아직 유효하다', () => {
        expect(window.isNoticeExpired('2026-07-30', '2026-07-30')).toBe(false)
    })

    it('다음 날부터 만료된다', () => {
        expect(window.isNoticeExpired('2026-07-30', '2026-07-31')).toBe(true)
    })
})

// 🚨 재발 방지 — 두 소비자가 각자 날짜를 만들면 다시 갈라진다
describe('소비자가 직접 날짜를 만들지 않는다', () => {
    const consumers = [
        ['src/notice-popup.js', '팝업 게이팅'],
        ['src/feedback-admin/admin-script.js', '관리자 목록 배지'],
    ]

    it.each(consumers)('%s — toISOString으로 날짜를 만들지 않는다', (file, why) => {
        const src = read(file)
        expect(src, `${why}이 toISOString().slice로 UTC 날짜를 만든다 — 로컬 기준과 어긋난다`)
            .not.toMatch(/toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/)
    })

    it.each(consumers)('%s — 공통 유틸을 쓴다', (file) => {
        expect(read(file)).toMatch(/window\.(noticeTodayStr|isNoticeExpired)/)
    })

    it('관리자 페이지가 유틸을 로드한다', () => {
        expect(read('src/feedback-admin/admin-entry.js'),
            'notice-date.js를 import하지 않으면 window.isNoticeExpired가 undefined다')
            .toContain('notice-date.js')
    })

    it('메인 페이지가 팝업보다 먼저 유틸을 로드한다', () => {
        const src = read('src/main-entry.js')
        const util = src.indexOf('notice-date.js')
        const popup = src.indexOf('notice-popup.js')
        expect(util, 'main-entry.js가 notice-date.js를 import하지 않는다').toBeGreaterThan(-1)
        expect(util, '유틸이 팝업보다 늦게 로드되면 호출 시점에 undefined다').toBeLessThan(popup)
    })
})
