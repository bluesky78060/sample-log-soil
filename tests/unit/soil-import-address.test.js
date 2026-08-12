import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-226: 엑셀 가져오기의 주소·우편번호 조합
//
// 앱 규약(address.js:340-344): address = `(우편번호) 도로명주소`, 우편번호가 없으면 빈 문자열.
// 개별 입력(주소검색)은 이 규약을 따르는데 가져오기만 안 따라, address가 항상 비어 있었다.
//
// ⚠️ 우편번호 출처가 둘이다(별도 열 / 주소 내 괄호). 사용자 자료 형태가 제각각이라 둘 다 받는다.
//    3번(이중 접두 금지)이 그 조합에서 생기는 유일한 함정을 막는다.
//
// ⚠️ address가 비어도 라벨은 나온다 — soil-label-address.test.js가 그걸 보장한다.
//    여기서는 "규약대로 만들어지는가"만 본다.

let fns
beforeAll(async () => {
    await import('../../src/shared/sanitize.js')
    await import('../../src/soil/soil-result-importer.js')
    fns = window.SoilResultImporter?._fns
    expect(fns, '_fns가 노출되지 않았다').toBeTruthy()
})

const build = (postcode, road) => fns.buildAddressFields(postcode, road)
const ROAD = '경상북도 봉화군 봉화읍 내성리 100'

describe('우편번호 출처 두 가지', () => {
    it('1. 우편번호 열 + 주소 → 규약대로 조합된다', () => {
        const r = build('36628', ROAD)
        expect(r.address).toBe(`(36628) ${ROAD}`)
        expect(r.addressPostcode).toBe('36628')
        expect(r.addressRoad).toBe(ROAD)
    })

    it('2. 주소에 괄호로 포함, 열 없음 → 같은 결과', () => {
        const r = build('', `(36628) ${ROAD}`)
        expect(r.address).toBe(`(36628) ${ROAD}`)
        expect(r.addressPostcode).toBe('36628')
        expect(r.addressRoad, 'addressRoad에 접두가 남았다').toBe(ROAD)
    })

    // 🚨 두 경로를 다 받기로 한 결정에서 생기는 유일한 함정
    it('3. 둘 다 있어도 이중 접두가 생기지 않는다', () => {
        const r = build('36628', `(36628) ${ROAD}`)
        expect(r.address).toBe(`(36628) ${ROAD}`)
        expect(r.address, '(36628) (36628) … 이 되었다').not.toMatch(/\(\d{5}\)\s*\(\d{5}\)/)
    })

    it('열 값이 주소 접두보다 우선한다', () => {
        const r = build('11111', `(99999) ${ROAD}`)
        expect(r.addressPostcode).toBe('11111')
        expect(r.address).toBe(`(11111) ${ROAD}`)
    })
})

describe('규약 준수', () => {
    it('4. 우편번호가 없으면 address는 빈 문자열', () => {
        const r = build('', ROAD)
        expect(r.address, 'address.js:343 규약 위반').toBe('')
        expect(r.addressRoad, '주소 자체는 보존해야 라벨이 나온다').toBe(ROAD)
    })

    it('주소가 없으면 address는 빈 문자열', () => {
        expect(build('36628', '').address).toBe('')
    })

    // 조용히 틀린 우편번호가 인쇄되는 것보다 비는 편이 낫다
    it('6. 5자리가 아닌 값은 우편번호로 쓰지 않는다', () => {
        for (const bad of ['1234', '123456', '123-456', 'abcde', '']) {
            const r = build(bad, ROAD)
            expect(r.addressPostcode, `'${bad}'를 우편번호로 받아들였다`).toBe('')
            expect(r.address).toBe('')
        }
    })

    // 🚨 codex 리뷰 MINOR — 엑셀 자료에 흔한 전각·공백 변형
    it('전각 괄호·숫자와 괄호 안 공백을 받아들인다', () => {
        const variants = [
            `（３６６２８） ${ROAD}`,
            `( 36628 ) ${ROAD}`,
            `（36628） ${ROAD}`,
        ]
        for (const v of variants) {
            const r = build('', v)
            expect(r.addressPostcode, `'${v}'에서 우편번호를 못 뽑았다`).toBe('36628')
            expect(r.addressRoad, `'${v}'의 주소 본문이 어긋났다`).toBe(ROAD)
            expect(r.address).toBe(`(36628) ${ROAD}`)
        }
    })

    it('열 값의 전각 숫자도 받아들인다', () => {
        expect(build('３６６２８', ROAD).addressPostcode).toBe('36628')
    })

    // ⚠️ 본문에도 **변환 대상 문자**(전각 숫자·괄호)를 넣어야 한다.
    //    전각 알파벳만 넣으면 toAsciiDigits가 안 건드려, 정규화본에서 잘라내도 결과가 같아
    //    이 단언이 아무것도 구분하지 못한다(변이 M4가 통과했다).
    it('주소 본문의 전각 문자는 보존된다 (정규화는 판정에만 쓴다)', () => {
        const r = build('', '（36628） 봉화읍 내성리 １２３（본관）')
        expect(r.addressRoad, '주소 본문이 정규화로 바뀌었다').toBe('봉화읍 내성리 １２３（본관）')
        expect(r.addressPostcode).toBe('36628')
    })

    it('앞뒤 공백은 정리된다', () => {
        const r = build('  36628  ', `  ${ROAD}  `)
        expect(r.address).toBe(`(36628) ${ROAD}`)
    })
})

describe('buildRecord 전체 경로', () => {
    it('7. 매핑된 행에서 주소 3종이 만들어진다', () => {
        const rec = fns.buildRecord(
            ['501', '홍길동', '36628', ROAD, '봉화읍 문단리 123-3'],
            { receptionNumber: 0, name: 1, addressPostcode: 2, addressRoad: 3, lotAddress: 4 },
            '농가의뢰'
        )
        expect(rec.address).toBe(`(36628) ${ROAD}`)
        expect(rec.addressPostcode).toBe('36628')
        expect(rec.addressRoad).toBe(ROAD)
        expect(rec.lotAddress, '지번주소는 건드리지 않는다').toBe('봉화읍 문단리 123-3')
    })

    it('우편번호 열이 매핑 안 돼도 죽지 않는다', () => {
        const rec = fns.buildRecord([ROAD], { addressRoad: 0 }, '자체')
        expect(rec.addressRoad).toBe(ROAD)
        expect(rec.address).toBe('')
    })
})

describe('서식', () => {
    const sheet = (n) => fns.buildTemplateSheets().find((s) => s.name === n)

    it('8. 농가의뢰·공익직불제에 우편번호 열이 있다', () => {
        for (const n of ['농가의뢰', '공익직불제']) {
            expect(sheet(n).headers, `${n}에 우편번호가 없다`).toContain('우편번호')
        }
    })

    it('9. 자체·대표필지에는 없다 (개인정보 없음 — 라벨 대상 아님)', () => {
        for (const n of ['자체', '대표필지']) {
            expect(sheet(n).headers, `${n}에 우편번호가 생겼다`).not.toContain('우편번호')
        }
    })

    // SLS-1-225 회귀 — 필드를 늘렸으니 매핑이 여전히 전부 맞는지 다시 본다
    it('10. 서식 헤더가 전부 의도한 필드에 매핑된다', () => {
        for (const s of fns.buildTemplateSheets()) {
            const mapping = fns.computeAutoMapping(s.headers)
            s.fields.forEach((key, i) => {
                expect(mapping[key], `'${s.name}': '${s.headers[i]}'(열 ${i})가 '${key}'에 안 붙었다`)
                    .toBe(i)
            })
        }
    })
})

describe('라벨 규약과 왕복', () => {
    // 여기서 만든 address를 라벨이 다시 읽는다. 두 정규식이 어긋나면 우편번호가 안 떨어진다.
    it('만든 address를 라벨 정규식이 그대로 분리한다', () => {
        const { address } = build('36628', ROAD)
        const m = address.match(/^\((\d{5})\)\s*/)
        expect(m, '라벨 정규식이 못 읽는 형식이다').toBeTruthy()
        expect(m[1]).toBe('36628')
        expect(address.replace(m[0], '')).toBe(ROAD)
    })
})
