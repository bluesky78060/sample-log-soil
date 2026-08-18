import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-250: 릴리스 배포 현황 집계
//
// 🚨 결함은 fetch가 아니라 **집계식**에 산다. 그래서 순수 함수로 떼어 여기서 검증한다.
//    실제 저장소 자산은 네 종류뿐이다 (실측):
//        soil-sample-log-setup.exe · latest.yml · RELEASES · <ver>-full.nupkg
//    이 중 setup.exe만 세야 한다. 다 더하면 숫자가 2.5배로 부푼다.

let S
beforeAll(async () => {
    await import('../../src/shared/sanitize.js')
    await import('../../src/feedback-admin/admin-script.js')
    S = window.__adminStats
    expect(S?.computeReleaseStats, 'window.__adminStats가 노출되지 않았다').toBeTypeOf('function')
})

/** 실제 응답 모양을 그대로 흉내낸다 */
const rel = (tag, pub, setup, extra = {}) => ({
    tag_name: tag,
    published_at: pub,
    prerelease: false,
    draft: false,
    assets: [
        { name: 'latest.yml', download_count: 99 },
        { name: 'RELEASES', download_count: 99 },
        { name: `soil-sample-log-${tag.replace(/^v/, '')}-full.nupkg`, download_count: 99 },
        { name: 'soil-sample-log-setup.exe', download_count: setup },
    ],
    ...extra,
})

describe('setup.exe만 합산한다', () => {
    // 🚨 이 테스트가 이 파일의 이유다. 필터를 빼면 latest.yml·RELEASES·nupkg가 섞인다.
    it('1. 다른 자산은 세지 않는다', () => {
        const s = S.computeReleaseStats([rel('v1.0.0', '2026-05-08T00:00:00Z', 7)])
        expect(s.totalSetup, '다른 자산이 섞였다').toBe(7)
    })

    it('2. 여러 릴리스를 더한다', () => {
        const s = S.computeReleaseStats([
            rel('v1.0.0', '2026-05-08T00:00:00Z', 7),
            rel('v1.1.0', '2026-06-08T00:00:00Z', 3),
        ])
        expect(s.totalSetup).toBe(10)
    })

    it('3. setup.exe가 없으면 0이다', () => {
        const s = S.computeReleaseStats([{
            tag_name: 'v1.0.0', published_at: '2026-05-08T00:00:00Z',
            assets: [{ name: 'latest.yml', download_count: 42 }],
        }])
        expect(s.totalSetup).toBe(0)
    })
})

describe('현재 최신', () => {
    // 🚨 배열 순서에 기대면 안 된다. GitHub이 순서를 바꿔도 맞아야 한다.
    it('4. published_at이 가장 큰 것 (배열 순서 무관)', () => {
        const s = S.computeReleaseStats([
            rel('v1.0.0', '2026-05-08T00:00:00Z', 1),
            rel('v9.9.9', '2026-08-14T00:00:00Z', 1),   // 가운데에 최신을 둔다
            rel('v1.5.0', '2026-06-01T00:00:00Z', 1),
        ])
        expect(s.latestTag, '배열 첫 원소를 최신으로 봤다').toBe('v9.9.9')
    })

    // ⚠️ 업데이터가 allowPrerelease 기본 false라, 화면의 "현재 최신"은
    //    사용자가 실제로 받는 버전이어야 한다.
    it('5. prerelease는 최신에서 제외한다', () => {
        const s = S.computeReleaseStats([
            rel('v1.0.0', '2026-05-08T00:00:00Z', 1),
            rel('v2.0.0-beta', '2026-08-14T00:00:00Z', 5, { prerelease: true }),
        ])
        expect(s.latestTag, 'prerelease를 최신으로 표시했다').toBe('v1.0.0')
    })

    it('6. 그래도 prerelease 다운로드는 총합에 넣는다', () => {
        const s = S.computeReleaseStats([
            rel('v1.0.0', '2026-05-08T00:00:00Z', 1),
            rel('v2.0.0-beta', '2026-08-14T00:00:00Z', 5, { prerelease: true }),
        ])
        expect(s.totalSetup, '실제로 나간 다운로드가 빠졌다').toBe(6)
    })

    it('7. published_at이 없으면 최신 후보가 아니다', () => {
        const s = S.computeReleaseStats([
            rel('v1.0.0', '2026-05-08T00:00:00Z', 1),
            rel('v9.9.9', null, 1),
        ])
        expect(s.latestTag).toBe('v1.0.0')
    })
})

describe('버전별·최다', () => {
    it('8. 내림차순으로 정렬된다', () => {
        const s = S.computeReleaseStats([
            rel('v1.0.0', '2026-05-08T00:00:00Z', 2),
            rel('v1.1.0', '2026-06-08T00:00:00Z', 9),
            rel('v1.2.0', '2026-07-08T00:00:00Z', 5),
        ])
        expect(s.byVersion.map((v) => v.count)).toEqual([9, 5, 2])
        expect(s.topVersion).toBe('v1.1.0')
    })

    // ══════════════════════════════════════════════════════════════
    // 🚨 배열을 **일부러 최신순이 아니게** 준다.
    //    처음 이 테스트는 최신순 배열을 썼는데, JS의 sort가 안정 정렬이라
    //    동률 처리를 통째로 지워도 통과했다 — 구분하지 못하는 단언이었다.
    //    게다가 구현도 배열 순서에 기대고 있어서, 순서가 뒤집히면 실제로 틀렸다.
    // ══════════════════════════════════════════════════════════════
    it('9. 동률이면 배열 순서와 무관하게 더 최신 것이 앞에 온다', () => {
        const s = S.computeReleaseStats([
            rel('v1.0.0', '2026-05-01T00:00:00Z', 4),   // 오래된 것을 먼저
            rel('v2.0.0', '2026-08-01T00:00:00Z', 4),
        ])
        expect(s.topVersion, '배열 순서에 기댔다 — 옛 버전을 최다로 골랐다').toBe('v2.0.0')
        expect(s.byVersion.map((v) => v.tag)).toEqual(['v2.0.0', 'v1.0.0'])
    })

    it('9-b. published_at이 없는 동률은 뒤로 밀린다', () => {
        const s = S.computeReleaseStats([
            rel('v-nodate', null, 4),
            rel('v1.0.0', '2026-05-01T00:00:00Z', 4),
        ])
        expect(s.byVersion[0].tag).toBe('v1.0.0')
    })

    it('10. 다운로드가 하나도 없으면 최다 버전은 빈 값', () => {
        const s = S.computeReleaseStats([rel('v1.0.0', '2026-05-08T00:00:00Z', 0)])
        expect(s.topVersion, '0회인데 최다로 표시했다').toBe('')
    })
})

describe('월별', () => {
    // 🚨 태그명이 아니라 published_at 기준이어야 한다
    it('11. 공개 월로 묶고 오름차순으로 준다', () => {
        const s = S.computeReleaseStats([
            rel('v1.0.0', '2026-07-30T00:00:00Z', 20),
            rel('v1.1.0', '2026-05-08T00:00:00Z', 1),
            rel('v1.2.0', '2026-07-02T00:00:00Z', 3),
        ])
        expect(s.byMonth).toEqual([
            { month: '2026-05', count: 1 },
            { month: '2026-07', count: 23 },
        ])
    })
})

describe('망가진 입력에 죽지 않는다', () => {
    it('12. 빈 배열·비배열', () => {
        for (const bad of [[], null, undefined, 'nope', 42, {}]) {
            const s = S.computeReleaseStats(bad)
            expect(s.totalSetup).toBe(0)
            expect(s.releaseCount).toBe(0)
            expect(s.latestTag).toBe('')
        }
    })

    // 🚨 하나만 섞여도 합계 전체가 NaN이 되어 화면이 물든다.
    //    ⚠️ 자산명은 **실제 이름**을 쓴다. 처음엔 a-setup.exe·c-setup.exe 같은 가짜 이름을
    //       여러 개 뒀는데, 그러면 "suffix 매칭"이라는 우연한 동작을 정답으로 굳힌다.
    it('13. download_count가 숫자가 아니면 무시한다', () => {
        const bad = (dc) => ({ name: 'soil-sample-log-setup.exe', download_count: dc })
        for (const dc of ['many', null, undefined, NaN, -5, {}]) {
            const s = S.computeReleaseStats([{
                tag_name: 'v1', published_at: '2026-05-08T00:00:00Z', assets: [bad(dc)],
            }])
            expect(Number.isNaN(s.totalSetup), `download_count=${String(dc)}에서 NaN이 됐다`).toBe(false)
            expect(s.totalSetup, `download_count=${String(dc)}를 세면 안 된다`).toBe(0)
        }
    })

    it('13-b. 정상 값과 망가진 값이 섞여도 정상분만 센다', () => {
        const s = S.computeReleaseStats([
            { tag_name: 'v1', published_at: '2026-05-08T00:00:00Z', assets: [{ name: 'soil-sample-log-setup.exe', download_count: 'x' }] },
            { tag_name: 'v2', published_at: '2026-06-08T00:00:00Z', assets: [{ name: 'soil-sample-log-setup.exe', download_count: 6 }] },
        ])
        expect(s.totalSetup).toBe(6)
    })

    it('14. assets가 없거나 배열이 아니어도 된다', () => {
        const s = S.computeReleaseStats([
            { tag_name: 'v1', published_at: '2026-05-08T00:00:00Z' },
            { tag_name: 'v2', published_at: '2026-05-09T00:00:00Z', assets: 'nope' },
            null,
        ])
        expect(s.totalSetup).toBe(0)
        expect(s.releaseCount).toBe(3)
    })

    it('15. published_at이 쓰레기여도 월별이 오염되지 않는다', () => {
        const s = S.computeReleaseStats([rel('v1', 'not-a-date', 3)])
        expect(s.byMonth).toEqual([])
        expect(s.totalSetup, '총합은 그대로여야 한다').toBe(3)
    })
})

describe('Link 헤더 (페이지네이션)', () => {
    // 실측한 실제 헤더 모양
    const REAL = '<https://api.github.com/repositories/1232929419/releases?per_page=1&page=2>; rel="next", '
        + '<https://api.github.com/repositories/1232929419/releases?per_page=1&page=52>; rel="last"'

    it('16. next를 뽑는다', () => {
        expect(S.parseNextLink(REAL)).toBe('https://api.github.com/repositories/1232929419/releases?per_page=1&page=2')
    })

    it('17. next가 없으면 빈 문자열 (마지막 페이지)', () => {
        expect(S.parseNextLink('<https://api.github.com/x?page=1>; rel="prev"')).toBe('')
        expect(S.parseNextLink('')).toBe('')
        expect(S.parseNextLink(null)).toBe('')
    })
})

describe('실패 판정', () => {
    const res = (status, headers = {}) => ({ status, headers: { get: (k) => headers[k.toLowerCase()] ?? null } })

    // 🚨 403만 보고 한도라 하면 오진한다 — 403은 다른 사유로도 온다
    it('18. 403 + remaining 0 → 한도', () => {
        const m = S.describeGhFailure(res(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1787012917' }))
        expect(m).toContain('한도')
    })

    it('19. 429 + remaining 0 → 한도 (429도 온다)', () => {
        expect(S.describeGhFailure(res(429, { 'x-ratelimit-remaining': '0' }))).toContain('한도')
    })

    it('20. 403인데 한도가 남아 있으면 한도라 하지 않는다', () => {
        const m = S.describeGhFailure(res(403, { 'x-ratelimit-remaining': '55' }))
        expect(m, '다른 사유의 403을 한도로 오진했다').not.toContain('한도')
        expect(m).toContain('403')
    })

    it('21. 404는 저장소 문제로 안내', () => {
        expect(S.describeGhFailure(res(404))).toContain('저장소')
    })

    it('22. 그 밖의 상태는 코드를 보여준다', () => {
        expect(S.describeGhFailure(res(500))).toContain('500')
    })
})
