import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-205 S1: 검정 항목 규칙 단일 진실원
//
// 검정결과 페이지(src/compost-analysis/)는 compost-script.js를 로드하지 않는다.
// 규칙이 두 벌이 되면 격자의 "비해당 셀 건너뛰기"가 어긋나 돼지 행에 염분이 기록되는
// 식의 조용한 오염이 생긴다. 이 파일은 (1) appliesTo가 getFieldsForSample에서 실제로
// 파생되는지, (2) 위임 후 compost-script.js 동작이 불변인지를 고정한다.

beforeAll(async () => {
    await import('../../src/shared/compost-fields.js')
    await import('../../src/shared/BaseSampleManager.js')
    await import('../../src/compost/compost-script.js')
})

const F = () => window.CompostFields

// 실제 폼이 제공하는 값 (compost/index.html의 select)
const SAMPLE_TYPES = ['가축분퇴비', '가축분뇨발효액']
const ANIMAL_TYPES = ['돼지', '소', '닭·오리 등', '기타']

describe('appliesTo — getFieldsForSample에서 파생된다 (규칙 이중화 방지)', () => {
    it('1. 전수 일치: 축종 4종 × 시료 2종 × 결과 8열', () => {
        for (const st of SAMPLE_TYPES) {
            for (const at of ANIMAL_TYPES) {
                const expected = new Set(F().getFieldsForSample(st, at).map(f => f.key))
                for (const key of F().RESULT_FIELDS) {
                    expect(F().appliesTo(key, st, at), `${st}/${at}/${key}`)
                        .toBe(expected.has(key))
                }
            }
        }
    })

    it('2. 퇴비+돼지는 구리·아연, 염분은 아니다', () => {
        expect(F().appliesTo('copper', '가축분퇴비', '돼지')).toBe(true)
        expect(F().appliesTo('zinc', '가축분퇴비', '돼지')).toBe(true)
        expect(F().appliesTo('salinity', '가축분퇴비', '돼지')).toBe(false)
    })

    it('3. 퇴비+소는 염분, 구리·아연은 아니다', () => {
        expect(F().appliesTo('salinity', '가축분퇴비', '소')).toBe(true)
        expect(F().appliesTo('copper', '가축분퇴비', '소')).toBe(false)
        expect(F().appliesTo('zinc', '가축분퇴비', '소')).toBe(false)
    })

    it('4. 액비+소는 구리·아연·염분 모두 아니다 (액비는 돼지만 구리·아연)', () => {
        expect(F().appliesTo('copper', '가축분뇨발효액', '소')).toBe(false)
        expect(F().appliesTo('salinity', '가축분뇨발효액', '소')).toBe(false)
    })

    it('5. 함수율·부숙도는 모든 조합에 적용된다', () => {
        for (const st of SAMPLE_TYPES) {
            for (const at of ANIMAL_TYPES) {
                expect(F().appliesTo('moisture', st, at), `${st}/${at}`).toBe(true)
                expect(F().appliesTo('maturity', st, at), `${st}/${at}`).toBe(true)
            }
        }
    })

    it('6. 질소·인산·칼리는 아직 어느 조합에도 적용되지 않는다 (S3에서 추가)', () => {
        // RESULT_FIELDS에는 열로 있지만 COMPOST_FIELDS에 없다.
        // S3에서 checkCompostFieldStatus의 "기준 없는 항목" 가드와 함께 넣는다 —
        // 지금 넣으면 standard가 비어 무조건 초록 ✓(허위 적합)가 표시된다.
        for (const k of ['nitrogen', 'phosphorus', 'potassium']) {
            expect(F().appliesTo(k, '가축분퇴비', '돼지'), k).toBe(false)
        }
    })

    it('7. 메모이즈가 결과를 오염시키지 않는다 (조합별 캐시 키)', () => {
        expect(F().appliesTo('salinity', '가축분퇴비', '소')).toBe(true)
        expect(F().appliesTo('salinity', '가축분퇴비', '돼지')).toBe(false)
        expect(F().appliesTo('salinity', '가축분퇴비', '소')).toBe(true)
    })
})

describe('위임 — compost-script.js 동작 불변 (S1 검증 기준)', () => {
    const mgr = () => {
        const m = Object.create(window.CompostSampleManager.prototype)
        return m
    }

    it('8. static COMPOST_FIELDS가 공유 모듈을 가리킨다', () => {
        expect(window.CompostSampleManager.COMPOST_FIELDS)
            .toBe(F().COMPOST_FIELDS)
    })

    it('9. static MATURITY_ORDER가 공유 모듈을 가리킨다', () => {
        expect(window.CompostSampleManager.MATURITY_ORDER)
            .toBe(F().MATURITY_ORDER)
    })

    it('10. getFieldsForSample 결과가 공유 모듈과 동일하다', () => {
        for (const st of SAMPLE_TYPES) {
            for (const at of ANIMAL_TYPES) {
                expect(mgr().getFieldsForSample(st, at))
                    .toEqual(F().getFieldsForSample(st, at))
            }
        }
    })

    it('11. getAreaInSqm 환산이 불변이다 (1,500㎡ 경계 포함)', () => {
        const m = mgr()
        expect(m.getAreaInSqm('1500', 'm2')).toBe(1500)
        expect(m.getAreaInSqm('1500', 'sqm')).toBe(1500)
        expect(m.getAreaInSqm('454', 'pyeong')).toBe(1501)   // 454 × 3.3058 = 1500.8
        expect(m.getAreaInSqm('', 'm2')).toBe(0)
        expect(m.getAreaInSqm('abc', 'm2')).toBe(0)
    })

    it('12. 모달 필드 수가 변하지 않았다 (N/P/K 미추가 확인)', () => {
        // 퇴비+돼지: 함수율·부숙도·구리·아연 = 4
        expect(mgr().getFieldsForSample('가축분퇴비', '돼지')).toHaveLength(4)
        // 퇴비+소: 함수율·부숙도·염분 = 3
        expect(mgr().getFieldsForSample('가축분퇴비', '소')).toHaveLength(3)
        // 액비+닭: 함수율·부숙도 = 2
        expect(mgr().getFieldsForSample('가축분뇨발효액', '닭·오리 등')).toHaveLength(2)
    })
})
