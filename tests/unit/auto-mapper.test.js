import { describe, it, expect, beforeAll } from 'vitest'

// soil-result-importer.js를 jsdom에서 import → window.SoilResultImporter._fns 로
// 순수 매핑 로직(normalizeHeader/scoreFieldHeader/computeAutoMapping/auditDuplicateKeywords) 노출됨
let fns
beforeAll(async () => {
    await import('../../src/soil/soil-result-importer.js')
    fns = window.SoilResultImporter._fns
})

describe('normalizeHeader', () => {
    it('공백·개행·구분기호 제거 + 소문자화', () => {
        expect(fns.normalizeHeader('전화 번호')).toBe('전화번호')
        expect(fns.normalizeHeader('전화-번호')).toBe('전화번호')
        expect(fns.normalizeHeader('주소(도로명)')).toBe('주소도로명')
        expect(fns.normalizeHeader('연 락_처')).toBe('연락처')
        expect(fns.normalizeHeader('Phone/No.')).toBe('phoneno')
    })
    it('면적(㎡)·㎥ 단위기호 제거', () => {
        expect(fns.normalizeHeader('면적(㎡)')).toBe('면적')
        expect(fns.normalizeHeader('부피㎥')).toBe('부피')
    })
    it('null/undefined → 빈 문자열', () => {
        expect(fns.normalizeHeader(null)).toBe('')
        expect(fns.normalizeHeader(undefined)).toBe('')
    })
})

describe('computeAutoMapping — 기본 동의어', () => {
    const map = (h) => fns.computeAutoMapping(h)

    it('대표 헤더 8종을 각 필드로 매핑', () => {
        const m = map(['이름', '휴대폰', '소재지', '품목', '면적', '지목', '용도', '비고'])
        expect(m).toMatchObject({
            name: 0, phoneNumber: 1, lotAddress: 2, cropsDisplay: 3,
            area: 4, subCategory: 5, purpose: 6, note: 7,
        })
    })

    it('센터별 변형 명칭 인식(농가명/연락처/재배작물/경작면적/전답구분/분석목적/메모)', () => {
        const m = map(['농가명', '연락처', '재배작물', '경작면적', '전답구분', '분석목적', '메모'])
        expect(m.name).toBe(0)
        expect(m.phoneNumber).toBe(1)
        expect(m.cropsDisplay).toBe(2)
        expect(m.area).toBe(3)
        expect(m.subCategory).toBe(4)
        expect(m.purpose).toBe(5)
        expect(m.note).toBe(6)
    })
})

describe('computeAutoMapping — 오매칭 방지(핵심)', () => {
    const map = (h) => fns.computeAutoMapping(h)

    it('지번주소·농가주소 동시 → 각각 lotAddress·addressRoad로 분리', () => {
        const m = map(['지번주소', '농가주소'])
        expect(m.lotAddress).toBe(0)
        expect(m.addressRoad).toBe(1)
    })

    it('3중 경영체 충돌(명/등록번호/주소) 정확 분리', () => {
        const m = map(['경영체명', '경영체등록번호', '경영체주소', '지번주소'])
        expect(m.name).toBe(0)
        expect(m.businessRegNo).toBe(1)
        expect(m.addressRoad).toBe(2)
        expect(m.lotAddress).toBe(3)
    })

    it("'농가' 단독은 성명(name)으로 — 농가주소(addressRoad) 아님", () => {
        const m = map(['농가', '전화', '지번'])
        expect(m.name).toBe(0)
        expect(m.addressRoad).toBeUndefined()
        expect(m.lotAddress).toBe(2)
    })

    it('완전일치가 접두/접미보다 우선(농가주소→addressRoad 불변)', () => {
        // '농가주소'(완전일치) > '주소'(접미) 이므로 lotAddress로 새지 않는다
        expect(map(['농가주소']).addressRoad).toBe(0)
        expect(map(['농가주소']).lotAddress).toBeUndefined()
    })
})

describe('computeAutoMapping — 동의어 확장(영문/조사일자)', () => {
    const map = (h) => fns.computeAutoMapping(h)

    it('영문 address 단독 → 지번주소', () => {
        expect(map(['address']).lotAddress).toBe(0)
    })

    it('영문 헤더 일괄 매핑', () => {
        const m = map(['No', 'farmer', 'phone', 'crop', 'area', 'category', 'note'])
        expect(m.receptionNumber).toBe(0)
        expect(m.name).toBe(1)
        expect(m.phoneNumber).toBe(2)
        expect(m.cropsDisplay).toBe(3)
        expect(m.area).toBe(4)
        expect(m.subCategory).toBe(5)
        expect(m.note).toBe(6)
    })

    it('조사일자/조사일 → 접수일자(date)', () => {
        expect(map(['조사일자']).date).toBe(0)
        expect(map(['조사일']).date).toBe(0)
    })
})

describe('computeAutoMapping — 영문 2글자 과매칭 방지(MINOR-2)', () => {
    const map = (h) => fns.computeAutoMapping(h)

    it("'idx'는 영문 2글자 'id' 부분포함으로 receptionNumber에 잡히지 않음", () => {
        // 과거(>=2 부분포함)에는 receptionNumber로 오매칭되던 케이스
        expect(map(['idx']).receptionNumber).toBeUndefined()
    })

    it("'sharp'은 'hp' 부분포함으로 연락처에 잡히지 않음", () => {
        expect(map(['sharp']).phoneNumber).toBeUndefined()
    })

    it("완전일치 'no'·'id'는 여전히 인식", () => {
        expect(map(['id']).receptionNumber).toBe(0)
        expect(map(['no']).receptionNumber).toBe(0)
    })
})

describe('computeAutoMapping — 엣지 케이스', () => {
    const map = (h) => fns.computeAutoMapping(h)

    it('중복 헤더는 낮은 colIdx를 결정적으로 선택', () => {
        const m = map(['주소', '작물', '주소'])
        expect(m.lotAddress).toBe(0)
    })

    it('빈 헤더는 무시', () => {
        const m = map(['', '성명', ''])
        expect(m.name).toBe(1)
    })

    it('헤더없음 모드 컬럼명(열 1..)은 매칭되지 않음', () => {
        expect(fns.computeAutoMapping(['열 1', '열 2', '열 3'])).toEqual({})
    })

    it('매칭 없는 헤더 → 빈 객체', () => {
        expect(map(['zzz', 'qwerty'])).toEqual({})
    })

    it('빈 배열/누락 인자 안전 처리', () => {
        expect(map([])).toEqual({})
        expect(fns.computeAutoMapping()).toEqual({})
    })
})

describe('scoreFieldHeader — 점수 구간 불변식(길이 비의존)', () => {
    // autoNorms = [{nk, ascii}] 형태를 직접 구성해 점수 경계를 정조준 검증
    const norm = (nk) => [{ nk, ascii: /^[a-z0-9]+$/.test(nk) }]
    const S = (nk, nh) => fns.scoreFieldHeader(norm(nk), nh)

    it('완전일치 > 접두/접미 > 부분포함 > 역포함 (키워드 길이와 무관)', () => {
        const exact = S('가나', '가나')                         // 완전일치 1000+2 = 1002 (짧은 키워드)
        const affixLong = S('가나다라마바사', '가나다라마바사자')     // 접두   500+7 = 507  (긴 키워드)
        const includeLong = S('가나다라마바사', '자가나다라마바사자') // 부분포함 300+7 = 307 (중간 포함, 긴 키워드)
        const rincl = S('가나다라마', '가나다라')                 // 역포함  100+4 = 104

        // 긴 하위구간이 짧은 상위구간을 절대 역전하지 못함 → 길이 비의존 불변식
        expect(exact).toBe(1002)
        expect(affixLong).toBe(507)
        expect(includeLong).toBe(307)
        expect(rincl).toBe(104)
        expect(exact).toBeGreaterThan(affixLong)
        expect(affixLong).toBeGreaterThan(includeLong)
        expect(includeLong).toBeGreaterThan(rincl)
    })

    it('접두/접미가 부분포함을 항상 이긴다(긴 부분포함 키워드여도)', () => {
        // 짧은 접미(키워드 2글자=502)가 긴 부분포함(키워드 7글자=307)보다 높다
        const affixShort = S('면적', '논면적')          // 접미 500+2 = 502
        const includeLong = S('가나다라마바사', '자가나다라마바사자') // 부분포함 300+7 = 307
        expect(affixShort).toBeGreaterThan(includeLong)
    })

    it('ascii 2글자 키워드는 부분포함 0점(완전일치만 인정)', () => {
        expect(S('id', 'idx')).toBe(0)        // 부분포함 제외
        expect(S('id', 'id')).toBe(1002)      // 완전일치만 점수
        expect(S('hp', 'sharp')).toBe(0)      // 부분포함 제외
    })

    it('한글 2글자 키워드는 부분포함 허용', () => {
        // '논면적계': starts'논'·ends'계' 아님, 중간 '면적' 포함 → 부분포함
        expect(S('면적', '논면적계')).toBe(302) // SCORE_INCLUDE(300) + len(2)
    })

    it('빈 헤더는 0점', () => {
        expect(S('성명', '')).toBe(0)
    })
})

describe('auditDuplicateKeywords', () => {
    it('교차 필드 중복 키워드가 없어야 한다(의도된 분리 설계)', () => {
        expect(fns.auditDuplicateKeywords()).toEqual([])
    })
})
