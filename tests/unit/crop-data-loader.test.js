import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-179: 작물 데이터 업로드 파서(crop-data-loader.js) 유닛 테스트.
//   순수 로직(parseCropRows / mapGroupToCategory)만 검증 — XLSX/electronAPI I/O는 유닛 제외.
//   fixture는 파서가 기대하는 형태가 아니라 "실제 농진청 파일 구조"를 반영한다
//   (제목행 + 접두어 헤더 + 빈행 + 데이터). 메인 SAMPL-1-128 교훈 반영.

let Loader

beforeAll(async () => {
    await import('../../src/shared/crop-data-loader.js')
    Loader = window.CropDataLoader
})

// header:1 형태(2차원 배열) fixture — 제목 1행 + 실제 접두어 헤더 1행 + 데이터.
// '작물목록 표시여부'/'비료사용추천 발급여부'를 부분포함 매칭으로 해석해야 통과한다.
function makeRows(dataRows) {
    return [
        ['작물정보', '', '', '', '', ''],
        ['작물코드', '작물구분', '작물명', '비료사용추천 발급여부', '작물목록 표시여부', '비고'],
        ...dataRows,
    ]
}

describe('CropDataLoader.mapGroupToCategory — 그룹→카테고리 축약', () => {
    it('곡류(벼) → 곡류', () => {
        expect(Loader.mapGroupToCategory('곡류(벼)')).toBe('곡류')
    })
    it('곡류(기타) → 곡류', () => {
        expect(Loader.mapGroupToCategory('곡류(기타)')).toBe('곡류')
    })
    it('유지류 → 유지작물', () => {
        expect(Loader.mapGroupToCategory('유지류')).toBe('유지작물')
    })
    it('인경채류 → 양념채소', () => {
        expect(Loader.mapGroupToCategory('인경채류')).toBe('양념채소')
    })
    it('경엽채류 → 엽경채류', () => {
        expect(Loader.mapGroupToCategory('경엽채류')).toBe('엽경채류')
    })
    it('기타 → 기타', () => {
        expect(Loader.mapGroupToCategory('기타')).toBe('기타')
    })
    it('미분류 → 기타', () => {
        expect(Loader.mapGroupToCategory('미분류')).toBe('기타')
    })
    it('매핑에 없는 그룹은 그대로 통과(pass through)', () => {
        expect(Loader.mapGroupToCategory('과수')).toBe('과수')
        expect(Loader.mapGroupToCategory('서류')).toBe('서류')
    })
    it('공백/빈 값은 기타로 폴백', () => {
        expect(Loader.mapGroupToCategory('')).toBe('기타')
        expect(Loader.mapGroupToCategory('  ')).toBe('기타')
        expect(Loader.mapGroupToCategory(null)).toBe('기타')
    })
})

describe('CropDataLoader.parseCropRows — happy path', () => {
    it('표시 대상만 파싱하고 그룹→카테고리 매핑 적용', () => {
        const rows = makeRows([
            ['00000', '곡류(벼)', '벼(일반답)', '발급', '표시', ''],
            ['00011', '유지류', '땅콩', '발급', '표시', ''],
            ['00060', '서류', '감자', '발급', '표시', ''],
        ])
        const result = Loader.parseCropRows(rows)
        expect(result).toEqual([
            { code: '00000', name: '벼(일반답)', category: '곡류' },
            { code: '00011', name: '땅콩', category: '유지작물' },
            { code: '00060', name: '감자', category: '서류' },
        ])
    })

    it('헤더가 몇 행 아래에 있어도 내용으로 탐지', () => {
        const rows = [
            ['보고서 제목', ''],
            ['생성일: 2026-07-07', ''],
            ['작물코드', '작물구분', '작물명', '비료사용추천 발급여부', '작물목록 표시여부'],
            ['00000', '곡류(벼)', '벼(일반답)', '발급', '표시'],
        ]
        const result = Loader.parseCropRows(rows)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ code: '00000', name: '벼(일반답)', category: '곡류' })
    })

    // 실제 파일 레이아웃(제목행 + 접두어 헤더 + 빈행 + 데이터) 회귀.
    // 파서가 '작물목록 표시여부'를 '표시여부' 부분포함으로 매칭해야 통과.
    it('실제 파일 헤더(작물목록 표시여부/비료사용추천 발급여부)를 부분포함으로 매칭', () => {
        const rows = [
            ['작물정보(2026.07.01기준)', null, null, null, null, null],
            ['작물코드', '작물구분', '작물명', '비료사용추천 발급여부', '작물목록 표시여부', '비고'],
            [null, null, null, null, null, null],
            ['00165', '곡류(벼)', '밭벼(비화산회토)', '발급', '표시', null],
            ['01054', '미분류', '부지갱이 나물', '미발급', '미표시', null],
        ]
        const result = Loader.parseCropRows(rows)
        expect(result).toEqual([
            { code: '00165', name: '밭벼(비화산회토)', category: '곡류' },
        ])
    })
})

describe('CropDataLoader.parseCropRows — 표시여부 필터링', () => {
    it('표시여부 !== "표시" 인 행은 제외', () => {
        const rows = makeRows([
            ['00000', '곡류(벼)', '벼(일반답)', '발급', '표시', ''],
            ['99998', '기타', '숨김작물', '발급', '미표시', ''],
            ['99999', '기타', '빈값작물', '발급', '', ''],
        ])
        const result = Loader.parseCropRows(rows)
        expect(result).toHaveLength(1)
        expect(result[0].code).toBe('00000')
    })

    it('작물코드/작물명이 비면 표시여부가 표시여도 제외', () => {
        const rows = makeRows([
            ['', '곡류(벼)', '이름있음', '발급', '표시', ''],
            ['00000', '곡류(벼)', '', '발급', '표시', ''],
            ['00001', '곡류(벼)', '정상', '발급', '표시', ''],
        ])
        const result = Loader.parseCropRows(rows)
        expect(result).toHaveLength(1)
        expect(result[0].code).toBe('00001')
    })
})

describe('CropDataLoader.parseCropRows — 에러 케이스', () => {
    it('빈 배열이면 throw', () => {
        expect(() => Loader.parseCropRows([])).toThrow(/비어/)
    })

    it('배열이 아니면 throw', () => {
        expect(() => Loader.parseCropRows(null)).toThrow(/비어/)
    })

    it('필수 컬럼(표시여부) 누락 시 throw', () => {
        const rows = [
            ['작물코드', '작물구분', '작물명', '비료사용추천 발급여부'],
            ['00000', '곡류(벼)', '벼(일반답)', '발급'],
        ]
        expect(() => Loader.parseCropRows(rows)).toThrow(/필수 컬럼/)
    })

    it('표시 대상이 하나도 없으면 throw', () => {
        const rows = makeRows([
            ['00000', '곡류(벼)', '벼(일반답)', '발급', '미표시', ''],
        ])
        expect(() => Loader.parseCropRows(rows)).toThrow(/표시 대상/)
    })
})
