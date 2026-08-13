import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// SLS-1-227: 엑셀 가져오기 우편번호 자동조회
//
// 🚨 이 파일이 지키는 것은 "채우는 것"이 아니라 **"함부로 채우지 않는 것"**이다.
//    JUSO는 부분 일치로도 후보를 준다. 첫 후보를 그냥 쓰면 옆 동네 우편번호가
//    라벨에 찍히고 아무도 모른다. 조용히 틀린 값보다 빈 값이 낫다.
//
// ⚠️ 7번(total)과 8번(zip 검증)이 이 파일의 핵심이다.
//    둘 다 "테스트가 전부 통과하는 상태로 틀려 있을" 수 있던 항목이라
//    codex 계획 리뷰가 CRITICAL/MAJOR로 잡아냈다.

let L
beforeAll(async () => {
    await import('../../src/soil/soil-address-lookup.js')
    L = window.SoilAddressLookup
    expect(L, 'SoilAddressLookup이 전역에 없다').toBeTruthy()
})

const ROAD = '경상북도 봉화군 봉화읍 내성리 100'
const item = (road, zip = '36628') => ({ roadAddr: road, zipNo: zip })
const res = (items, total) => ({ ok: true, items, total: total ?? items.length })

describe('판정 — 확신할 때만 채운다', () => {
    it('1. 단일 결과 + 유효 필드 → ok', () => {
        const r = L.classifyResult(ROAD, res([item(ROAD)]))
        expect(r.status).toBe('ok')
        expect(r.zip).toBe('36628')
        expect(r.road).toBe(ROAD)
    })

    it('2. 여러 건이어도 완전일치가 딱 1건이면 채운다', () => {
        const r = L.classifyResult(ROAD, res([
            item(ROAD + ' 2층', '36629'),
            item(ROAD, '36628'),
            item(ROAD + '-1', '36630'),
        ]))
        expect(r.status).toBe('ok')
        expect(r.zip, '완전일치 건이 아닌 다른 후보를 골랐다').toBe('36628')
    })

    // 🚨 첫 후보를 그냥 쓰면 여기서 통과해 버린다
    it('3. 여러 건 + 완전일치 0건 → ambiguous, 우편번호 안 채움', () => {
        const r = L.classifyResult(ROAD, res([
            item(ROAD + ' 2층', '11111'),
            item(ROAD + '-1', '22222'),
        ]))
        expect(r.status).toBe('ambiguous')
        expect(r.zip, '확신 없이 우편번호를 채웠다').toBe('')
    })

    it('4. 완전일치가 2건이면 고르지 않는다', () => {
        const r = L.classifyResult(ROAD, res([item(ROAD, '11111'), item(ROAD, '22222')]))
        expect(r.status).toBe('ambiguous')
        expect(r.zip).toBe('')
    })

    it('5. 0건 → notfound', () => {
        expect(L.classifyResult(ROAD, res([])).status).toBe('notfound')
    })

    it('6. ok:false → error, 사유를 보존한다', () => {
        const r = L.classifyResult(ROAD, { ok: false, error: '검색어가 너무 깁니다 (최대 80자).' })
        expect(r.status).toBe('error')
        expect(r.reason, '사유가 사라지면 작업자가 뭘 고쳐야 할지 모른다').toContain('80자')
    })

    // 🚨 codex 계획 리뷰 CRITICAL — items만 보면 여기서 틀린 값을 확정한다
    it('7. items 1건이어도 total이 더 크면 확정하지 않는다', () => {
        const r = L.classifyResult(ROAD, { ok: true, items: [item(ROAD)], total: 3 })
        expect(r.status, 'total을 무시하고 첫 후보를 확정했다').toBe('ambiguous')
        expect(r.zip).toBe('')
    })

    // 🚨 codex 계획 리뷰 MAJOR — JusoService는 빈 값도 그대로 넘긴다
    it('8. 우편번호가 5자리가 아니면 채우지 않는다', () => {
        for (const bad of ['', '1234', '123456', '3662a', null]) {
            const r = L.classifyResult(ROAD, res([item(ROAD, bad)]))
            expect(r.status, `'${bad}'를 우편번호로 받아들였다`).toBe('error')
            expect(r.zip).toBe('')
        }
    })

    it('8-b. 도로명이 비면 채우지 않는다', () => {
        expect(L.classifyResult(ROAD, res([item('', '36628')])).status).toBe('error')
    })

    it('정규화는 공백만 접는다 — 하이픈·번지는 구분을 유지한다', () => {
        expect(L.normalizeRoad('  가  나   다 ')).toBe('가 나 다')
        // 과하게 정규화하면 서로 다른 주소가 "완전일치"로 뭉쳐 3·4번 방어가 무너진다
        expect(L.normalizeRoad('내성리 100-1')).not.toBe(L.normalizeRoad('내성리 100'))
    })
})

describe('일괄 조회', () => {
    let calls
    const okSearch = (road = ROAD) => vi.fn(async () => res([item(road)]))

    beforeEach(() => {
        calls = []
        window.electronAPI = { jusoSearch: () => {} }
        window.JusoService = { search: async () => res([item(ROAD)]) }
    })

    const run = (queries, opts = {}) =>
        L.lookupBatch(queries, { sleep: async () => {}, ...opts })

    it('10. 같은 주소는 한 번만 조회한다 (캐시)', async () => {
        const search = okSearch()
        await run([ROAD, ROAD, '  ' + ROAD + ' '], { search })
        expect(search, '같은 주소를 여러 번 두드렸다').toHaveBeenCalledTimes(1)
    })

    // 🚨 codex 코드리뷰 MAJOR — 실패까지 캐시로 막으면 버튼엔 "N건"이 뜨는데
    //    눌러도 조회가 안 일어나 먹통으로 보인다. 일시적 오류를 재시도할 길이 없어진다.
    it('실패한 건은 다시 누르면 재조회한다', async () => {
        for (const st of ['notfound', 'ambiguous', 'error']) {
            const cache = new Map([[L.normalizeRoad(ROAD), { status: st, zip: '', road: '', reason: '' }]])
            const search = okSearch()
            await run([ROAD], { search, cache })
            expect(search, `${st} 상태가 캐시에 있다고 재조회를 건너뛰었다`).toHaveBeenCalledTimes(1)
            expect(cache.get(L.normalizeRoad(ROAD)).status, '재조회 결과가 반영되지 않았다').toBe('ok')
        }
    })

    it('성공한 건은 다시 눌러도 조회하지 않는다', async () => {
        const search = okSearch()
        const cache = new Map([[L.normalizeRoad(ROAD), { status: 'ok', zip: '36628', road: ROAD, reason: '' }]])
        await run([ROAD], { search, cache })
        expect(search).not.toHaveBeenCalled()
    })

    it('11. 호출 사이에 간격을 둔다', async () => {
        const waits = []
        const search = vi.fn(async () => res([item(ROAD)]))
        await run(['가 1', '나 2', '다 3'], { search, sleep: async (ms) => { waits.push(ms) } })
        // 3건이면 사이 간격이 2번
        const gaps = waits.filter((w) => w === L.INTERVAL_MS)
        expect(gaps.length, '호출 간격 없이 연달아 두드렸다').toBe(2)
        // 250ms는 고정 1초 창에 정확히 5회가 들어가 여유가 없다
        expect(L.INTERVAL_MS, '간격이 좁아 rate limit에 걸린다').toBeGreaterThanOrEqual(300)
    })

    // 🚨 codex 계획 리뷰 MAJOR — 거절은 오류가 아니다.
    //    limiter 카운터는 채널 단위로 앱 전체가 공유하므로, 사용자가 동시에
    //    주소 자동완성을 쓰면 아무 잘못 없는 행이 붉게 된다.
    it('12. rate limit 거절은 기다렸다 다시 시도한다', async () => {
        let n = 0
        const search = vi.fn(async () => {
            n++
            return n === 1
                ? { ok: false, error: '요청이 너무 빈번합니다. 잠시 후 다시 시도하세요.' }
                : res([item(ROAD)])
        })
        const waits = []
        const out = await run([ROAD], { search, sleep: async (ms) => { waits.push(ms) } })
        const hit = out.cache.get(L.normalizeRoad(ROAD))
        expect(hit.status, '거절을 오류로 확정해 버렸다').toBe('ok')
        expect(search).toHaveBeenCalledTimes(2)
        expect(waits, '기다리지 않고 바로 다시 두드렸다 — 거절도 카운트를 올린다')
            .toContain(L.RETRY_WAIT_MS)
    })

    it('13. 재시도를 다 써도 안 되면 error', async () => {
        const search = vi.fn(async () => ({ ok: false, error: '요청이 너무 빈번합니다.' }))
        const out = await run([ROAD], { search })
        expect(out.cache.get(L.normalizeRoad(ROAD)).status).toBe('error')
        expect(search).toHaveBeenCalledTimes(L.MAX_RETRY + 1)
    })

    // 🚨 200번 두드려 봐야 결과가 같다
    it('9. 환경 문제(키 없음)면 첫 건에서 멈추고 나머지에 같은 사유를 붙인다', async () => {
        const search = vi.fn(async () => ({
            ok: false, error: 'JUSO_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.',
        }))
        const out = await run(['가 1', '나 2', '다 3'], { search })
        expect(search, '결과가 같은 걸 알면서 계속 두드렸다').toHaveBeenCalledTimes(1)
        expect(out.fatal).toContain('JUSO_API_KEY')
        for (const q of ['가 1', '나 2', '다 3']) {
            expect(out.cache.get(L.normalizeRoad(q)).status).toBe('error')
        }
    })

    it('웹 환경이면 아예 두드리지 않는다', async () => {
        delete window.electronAPI
        const search = vi.fn()
        const out = await run([ROAD], { search })
        expect(search).not.toHaveBeenCalled()
        expect(out.fatal).toContain('데스크톱')
        expect(out.cache.get(L.normalizeRoad(ROAD)).status).toBe('error')
    })

    it('14. 취소하면 이후로 두드리지 않고, 이미 채운 건 남는다', async () => {
        const ac = new AbortController()
        let n = 0
        const search = vi.fn(async () => { n++; return res([item(`도로 ${n}`)]) })
        const out = await run(['도로 1', '도로 2', '도로 3'], {
            search,
            signal: ac.signal,
            sleep: async () => { ac.abort() },   // 첫 간격에서 취소
        })
        expect(out.aborted).toBe(true)
        expect(search, '취소 후에도 계속 두드렸다').toHaveBeenCalledTimes(1)
        expect(out.cache.get(L.normalizeRoad('도로 1')), '취소 전 결과까지 버렸다').toBeTruthy()
    })

    // 🚨 성공 시 rec의 도로명이 JUSO 표기로 바뀌므로, 재계산 후 렌더는 **바뀐 표기로** 찾는다.
    //    한쪽 키만 걸어 두면 못 찾는다 — 지금은 "못 찾음 = 붉지 않음"이라 화면이 우연히 맞지만,
    //    성공 행에 표시를 하나 붙이는 순간 조용히 동작하지 않게 된다.
    it('성공한 건은 사용자 표기와 JUSO 표기 양쪽으로 찾을 수 있다', async () => {
        const TYPED = '봉화군  물야면 오전리 55'
        const OFFICIAL = '경상북도 봉화군 물야면 오전리 55'
        const search = vi.fn(async () => res([item(OFFICIAL, '36100')]))
        const out = await run([TYPED], { search })
        expect(out.cache.get(L.normalizeRoad(TYPED))?.status).toBe('ok')
        expect(out.cache.get(L.normalizeRoad(OFFICIAL))?.status,
            'JUSO 표기로는 못 찾는다 — 재계산 후 렌더가 상태를 잃는다').toBe('ok')
    })

    it('조회 중 예외가 나도 그 행만 error로 남고 나머지는 계속된다', async () => {
        let n = 0
        const search = vi.fn(async () => {
            n++
            if (n === 1) throw new Error('네트워크 끊김')
            return res([item(ROAD)])
        })
        const out = await run(['가 1', ROAD], { search })
        expect(out.cache.get(L.normalizeRoad('가 1')).status).toBe('error')
        expect(out.cache.get(L.normalizeRoad('가 1')).reason).toContain('네트워크')
        expect(out.cache.get(L.normalizeRoad(ROAD)).status, '한 건 실패로 전체가 멈췄다').toBe('ok')
    })
})
