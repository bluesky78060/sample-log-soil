import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

// SLS-1-217: 캐시 정리가 토양 접수 자료를 지우던 결함의 회귀 가드
//
// v1.0.0 ~ v1.14.2 동안 SAMPLE_DATA_PATTERNS에 'soilSampleLogs'가 있었다.
// main-init.js가 앱 시작 시 checkAndAutoClean()을 부르므로 **금요일에 앱을 켜기만 하면**
// 접수 자료가 삭제됐다. 자동 경로는 clearCache(false)로 alert를 끄고 메인 페이지에는
// toast.js가 없어 사용자에게 아무 신호도 가지 않는 무음 삭제였다.
// 토양은 Firebase를 쓰지 않으므로 복구 경로가 없었다.
//
// 이 파일이 고정하는 계약:
//   보호 대상(토양·퇴비)은 남고, 레거시 3종(통합본 잔재)은 계속 지워진다.
//
// ⚠️ 5번(수동)과 6번(금요일 자동)을 **모두** 두는 이유:
//    둘은 지금 isSampleData()를 공유하지만, 누가 자동 경로에만 게이트를 되살리면
//    수동 경로 테스트는 전부 통과한다. 실제로 12주간 데이터를 지운 쪽은 자동 경로다.

beforeAll(async () => {
    await import('../../src/shared/cache-manager.js')
})

const CM = () => window.CacheManager

/** 보호돼야 할 키 — 이 저장소의 정식 지원 시료 2종 */
const PROTECTED = {
    'soilSampleLogs_2026': '[{"receptionNumber":"501"}]',
    'compostSampleLogs_2026': '[{"receptionNumber":"C-1"}]',
    'compostTestResults_2026': '{"C-1":{"judgment":"부숙완료"}}',
}

/** 지워져야 할 키 — 5종 통합본에서 넘어온 잔재 (SLS-1-134) */
const LEGACY = {
    'waterSampleLogs_2026': '[1]',
    'pesticideSampleLogs_2025': '[2]',
    'heavyMetalSampleLogs': '[3]',
}

/** 설정류 — KEYS_TO_PRESERVE */
const SETTINGS = {
    'firebase_config': '{"projectId":"x"}',
    'theme': 'dark',
    'autoSavePath': '/tmp/x',
}

function seedAll() {
    Object.entries({ ...PROTECTED, ...LEGACY, ...SETTINGS })
        .forEach(([k, v]) => localStorage.setItem(k, v))
}

beforeEach(() => {
    localStorage.clear()
    seedAll()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('수동 정리 — clearCache()', () => {
    // 🚨 이 티켓의 핵심
    it('1. 토양 접수 자료를 남긴다', () => {
        CM().clearCache(false)
        expect(localStorage.getItem('soilSampleLogs_2026'))
            .toBe(PROTECTED['soilSampleLogs_2026'])
    })

    it('2. 레거시 3종은 여전히 지운다 (기능 보존)', () => {
        CM().clearCache(false)
        Object.keys(LEGACY).forEach(k => {
            expect(localStorage.getItem(k), `${k}가 남았다 — 레거시 청소가 죽었다`).toBeNull()
        })
    })

    it('3. 퇴비 자료·검정결과를 남긴다 (SLS-1-192 회귀 방지)', () => {
        CM().clearCache(false)
        expect(localStorage.getItem('compostSampleLogs_2026')).not.toBeNull()
        expect(localStorage.getItem('compostTestResults_2026')).not.toBeNull()
    })

    it('4. 설정을 남긴다', () => {
        CM().clearCache(false)
        Object.entries(SETTINGS).forEach(([k, v]) => {
            expect(localStorage.getItem(k), `${k}가 사라졌다`).toBe(v)
        })
    })

    it('5. 삭제 건수가 실제 지운 개수와 같다', () => {
        const result = CM().clearCache(false)
        expect(result.clearedCount).toBe(Object.keys(LEGACY).length)
        expect(result.clearedKeys.sort()).toEqual(Object.keys(LEGACY).sort())
    })
})

describe('금요일 자동 정리 — checkAndAutoClean()', () => {
    /** 2026-07-31은 금요일. isFriday()를 참으로 만든다 */
    const asFriday = () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-07-31T09:00:00'))
        expect(CM().isFriday(), '기준일이 금요일이 아니다 — 테스트 전제가 깨졌다').toBe(true)
        // lastCacheClear가 없어야 wasAlreadyClearedThisWeek()가 false
        expect(CM().wasAlreadyClearedThisWeek()).toBe(false)
    }

    // 🚨 실제로 12주간 데이터를 지워온 경로
    it('6. 앱 시작 시 자동 실행돼도 토양 자료를 남기고 레거시만 지운다', () => {
        asFriday()

        CM().checkAndAutoClean()

        expect(localStorage.getItem('soilSampleLogs_2026'),
            '금요일 자동 정리가 토양 접수 자료를 지웠다')
            .toBe(PROTECTED['soilSampleLogs_2026'])
        expect(localStorage.getItem('compostSampleLogs_2026')).not.toBeNull()
        // 레거시 청소는 계속 동작해야 한다 — 안 그러면 이 경로가 통째로 죽은 것
        Object.keys(LEGACY).forEach(k => {
            expect(localStorage.getItem(k), `${k}가 남았다 — 자동 경로가 아무것도 안 했다`).toBeNull()
        })
    })

    it('7. 금요일이 아니면 아무것도 지우지 않는다', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-07-29T09:00:00')) // 수요일
        expect(CM().isFriday()).toBe(false)

        CM().checkAndAutoClean()

        Object.keys(LEGACY).forEach(k => {
            expect(localStorage.getItem(k), `${k}가 지워졌다 — 요일 가드가 무력하다`).not.toBeNull()
        })
    })
})
