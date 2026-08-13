import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-228: 작물 검색 (조회 전용)
//
// 엑셀 서식에 작물명을 적을 때 정확한 이름을 찾기 위한 기능.
// CROP_DATA에는 벼(일반답)/벼(염해답-숙답), 보리(중북부)/보리(남부)처럼
// 미리 보지 않으면 무엇을 골라야 할지 모르는 이름이 많다.
//
// ⚠️ 7번이 이 파일의 핵심이다. 작물 데이터는 3계층(번들→로컬→Firestore)으로
//    런타임에 교체된다. 모듈이 window.CROP_DATA를 캡처하면 사용자가 업로드한
//    최신 목록이 조용히 반영되지 않는다 — 화면은 멀쩡해 보인다.

let CS
beforeAll(async () => {
    await import('../../src/soil/crop-search.js')
    CS = window.CropSearch
    expect(CS, 'CropSearch가 전역에 없다').toBeTruthy()
})

const CROPS = [
    { code: '00000', name: '벼(일반답)', category: '곡류' },
    { code: '00305', name: '벼(염해답-숙답)', category: '곡류' },
    { code: '00001', name: '보리(중북부)', category: '곡류' },
    { code: '00307', name: '보리(남부)', category: '곡류' },
    { code: '00021', name: '고추(노지)', category: '채소류' },
    { code: '00022', name: '고추(시설)', category: '채소류' },
    { code: '00040', name: '사과', category: '과수류' },
]

const f = (opts) => CS.filterCrops(CROPS, opts)

describe('검색', () => {
    it('1. 이름 부분 일치', () => {
        const r = f({ keyword: '고추' })
        expect(r.total).toBe(2)
        expect(r.items.map((c) => c.name)).toEqual(['고추(노지)', '고추(시설)'])
    })

    it('1-b. 대소문자·앞뒤 공백·연속 공백을 무시한다', () => {
        expect(f({ keyword: '  고추  ' }).total).toBe(2)
        expect(CS.normalize('가  나   다')).toBe('가 나 다')
    })

    // 공백을 전부 지우면 서로 다른 작물이 같은 문자열로 뭉친다
    it('1-c. 공백을 전부 없애지는 않는다', () => {
        expect(CS.normalize('벼 일반답')).not.toBe('벼일반답')
    })

    // 🚨 코드를 아는 사람이 있다
    it('2. 작물코드로도 찾는다', () => {
        const r = f({ keyword: '00021' })
        expect(r.total, '코드로 검색이 안 된다').toBe(1)
        expect(r.items[0].name).toBe('고추(노지)')
    })

    it('3. 분류와 검색어가 함께 적용된다', () => {
        expect(f({ keyword: '벼', category: '곡류' }).total).toBe(2)
        expect(f({ keyword: '벼', category: '채소류' }).total, '분류를 무시했다').toBe(0)
    })

    it('4. "전체"는 거르지 않는다', () => {
        expect(f({ category: '전체' }).total).toBe(CROPS.length)
        expect(f({}).total).toBe(CROPS.length)
    })

    it('5. 결과가 없으면 빈 배열', () => {
        const r = f({ keyword: '존재하지않는작물' })
        expect(r.items).toEqual([])
        expect(r.total).toBe(0)
        expect(r.truncated).toBe(false)
    })
})

describe('표시 상한', () => {
    // 🚨 자른 뒤 길이를 total로 쓰면 "전체가 200개"로 읽혀
    //    사용자가 자기 작물이 없다고 오해한다
    it('6. total은 자르기 전 수다', () => {
        const r = f({ limit: 2 })
        expect(r.items).toHaveLength(2)
        expect(r.total, '자른 뒤 길이를 total로 보고했다').toBe(CROPS.length)
        expect(r.truncated).toBe(true)
    })

    it('상한에 딱 맞으면 잘리지 않았다고 본다', () => {
        const r = f({ limit: CROPS.length })
        expect(r.truncated).toBe(false)
    })
})

describe('런타임 교체 대응', () => {
    // 🚨 작물 데이터는 3계층으로 런타임에 교체된다(crop-data-loader.js:175-180).
    //    모듈이 window.CROP_DATA를 캡처하면 업로드한 목록이 반영되지 않는다.
    it('7. 인자로 받은 목록을 쓴다 — window를 캡처하지 않는다', () => {
        window.CROP_DATA = CROPS                       // 모듈이 캡처했다면 이걸 볼 것이다
        const 갱신됨 = [{ code: '99999', name: '새작물', category: '신규' }]
        const r = CS.filterCrops(갱신됨, {})
        expect(r.total, 'window.CROP_DATA를 캡처해 인자를 무시했다').toBe(1)
        expect(r.items[0].name).toBe('새작물')
    })

    it('손상된 입력에도 죽지 않는다', () => {
        expect(CS.filterCrops(null, {}).total).toBe(0)
        expect(CS.filterCrops([null, undefined, ...CROPS], { keyword: '사과' }).total).toBe(1)
    })
})

describe('분류 목록', () => {
    it('넘어온 분류를 그대로 쓴다', () => {
        expect(CS.categoriesOf(CROPS, ['가', '나'])).toEqual(['가', '나'])
    })

    // 로더가 CROP_CATEGORIES를 교체하기 전이거나 비어 있을 수 있다
    it('분류가 없으면 작물에서 뽑는다', () => {
        expect(CS.categoriesOf(CROPS, undefined)).toEqual(['곡류', '채소류', '과수류'])
        expect(CS.categoriesOf(CROPS, [])).toEqual(['곡류', '채소류', '과수류'])
    })

    it('원본 배열을 돌려주지 않는다 (호출부가 바꿔도 안전)', () => {
        const src = ['가']
        const out = CS.categoriesOf(CROPS, src)
        out.push('나')
        expect(src).toEqual(['가'])
    })
})
