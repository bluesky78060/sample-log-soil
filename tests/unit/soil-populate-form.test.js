import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// SLS-1-166: populateFormForEdit / populateFormForGroupEdit DOM 바인딩 메서드 회귀 테스트.
//   SLS-1-164(그룹 수정 시 필지값·구분·용도·작물·면적 소실/중복등록 버그, parcels[0] 폴백)의
//   핵심 대상 메서드. 하위 순수 헬퍼(resolveParcelCategory 등)는 별도 파일에서 검증되지만
//   이 두 메서드가 헬퍼를 올바르게 엮어 this.parcels(데이터 모델)를 구성하는지는 미검증이었다.
//
//   전략: renderParcelCard(깊은 DOM 바인딩)는 스텁하고, 폴백 로직 산출물인 this.parcels와
//   레코드 단위 폼 필드(#name, #subCategory, purposeSelect 등)를 직접 검증한다.

beforeAll(async () => {
    // soil-script.js의 extends 대상이 먼저 window에 노출돼야 한다
    await import('../../src/shared/BaseSampleManager.js')
    // sanitize.js는 브라우저에서 sanitizeHTML/escapeHTML을 전역 함수 선언으로 노출하지만
    // ESM import 시 모듈 스코프에 갇히므로, soil-script.js의 bare 참조가 해석되도록 전역에 재노출
    // setup.js의 DOMPurify 목은 sanitize만 제공 → sanitizeHTML의 addHook 호출 대응
    if (window.DOMPurify && typeof window.DOMPurify.addHook !== 'function') {
        window.DOMPurify.addHook = () => {}
    }
    await import('../../src/shared/sanitize.js')
    globalThis.sanitizeHTML = window.sanitizeHTML
    globalThis.escapeHTML = window.escapeHTML
    // 폴백 헬퍼(window.SoilLogRecord)
    await import('../../src/soil/soil-log-record.js')
    await import('../../src/soil/soil-script.js')
})

// populateFormFor* 가 참조하는 최소 DOM + 매니저 인스턴스 구성
function createManager() {
    document.body.innerHTML = `
        <input id="name" />
        <input id="phoneNumber" />
        <select id="subCategory"><option value=""></option></select>
        <input id="note" />
        <div id="formView" class="view"></div>
        <button class="nav-btn" data-view="form"></button>
        <div id="parcelsContainer"></div>
    `

    const m = new window.SoilSampleManager()
    m.selectedYear = '2026'
    // 부수효과 스텁 (로그/토스트/깊은 카드 렌더 DOM 바인딩 회피)
    m.log = () => {}
    m.showToast = () => {}
    m.renderParcelCard = () => {}

    const el = (tag) => document.createElement(tag)
    // cacheElements가 셋업하는 DOM refs를 수동 주입 (생성자는 refs를 null로만 둔다)
    m.receptionNumberInput = el('input')
    m.dateInput = el('input')
    m.addressPostcode = el('input')
    m.addressRoad = el('input')
    m.addressDetail = el('input')
    m.addressHidden = el('input')
    m.purposeSelect = el('input')
    m.landClass1Select = el('input')
    m.receptionMethodInput = el('input')
    m.parcelsDataInput = el('input')
    m.parcelsContainer = document.getElementById('parcelsContainer')
    m.navSubmitBtn = el('button')
    m.form = { scrollIntoView() {} }
    return m
}

describe('populateFormForEdit — 단일 필지(비그룹) 레코드', () => {
    let m
    beforeEach(() => { m = createManager() })

    it('구분/용도/작물/면적/주소가 필지값 그대로 폼 데이터에 채워진다', () => {
        const log = {
            id: 11, receptionNumber: '503', date: '2026-07-01',
            name: '홍길동', phoneNumber: '010-1111-2222', subCategory: '논', purpose: '판매',
            lotAddress: '경북 봉화군 1', area: '300', cropsDisplay: '벼',
            parcels: [{
                lotAddress: '경북 봉화군 1', isMountain: false,
                crops: [{ name: '벼', area: '300', unit: 'm2' }],
                category: '논', purpose: '유기', subLots: []
            }]
        }
        m.populateFormForEdit(log)

        // 레코드 단위 폼 필드
        expect(m.receptionNumberInput.value).toBe('503')
        expect(document.getElementById('name').value).toBe('홍길동')
        expect(document.getElementById('phoneNumber').value).toBe('010-1111-2222')
        expect(document.getElementById('subCategory').value).toBe('논')

        // 필지 데이터 모델 (renderParcelCard가 그릴 원천)
        expect(m.parcels).toHaveLength(1)
        const p = m.parcels[0]
        expect(p.category).toBe('논')      // 구분: 필지값 우선
        expect(p.purpose).toBe('유기')     // 용도: 필지값 우선
        expect(p.lotAddress).toBe('경북 봉화군 1')
        expect(p.crops).toEqual([{ name: '벼', area: '300', unit: 'm2' }]) // 작물+면적
    })

    it('필지 crops가 비면 단일 필지에 한해 최상위 cropsDisplay/area로 폴백', () => {
        const log = {
            id: 12, receptionNumber: '504', subCategory: '밭', purpose: '자가소비',
            lotAddress: '경북 봉화군 2', area: '150', cropsDisplay: '콩',
            parcels: [{ lotAddress: '', isMountain: false, crops: [], category: '', purpose: '', subLots: [] }]
        }
        m.populateFormForEdit(log)

        const p = m.parcels[0]
        // 빈 필지값 → 최상위로 폴백 (SLS-1-164 소실 방지)
        expect(p.category).toBe('밭')
        expect(p.purpose).toBe('자가소비')
        expect(p.lotAddress).toBe('경북 봉화군 2')
        expect(p.crops).toEqual([{ name: '콩', area: '150' }])
    })

    it('parcels 없는 레거시 레코드는 빈 필지 1개 + lotAddress 채움', () => {
        const log = {
            id: 13, receptionNumber: '505', name: '김철수',
            lotAddress: '경북 봉화군 3', parcels: []
        }
        m.populateFormForEdit(log)
        expect(m.parcels).toHaveLength(1)
        expect(m.parcels[0].lotAddress).toBe('경북 봉화군 3')
    })
})

describe('populateFormForGroupEdit — 그룹(동일 baseNumber) 레코드', () => {
    let m
    beforeEach(() => { m = createManager() })

    it('필지값(commonData)이 있으면 그것을 우선 사용한다', () => {
        const groupLogs = [
            {
                id: 21, groupId: 'g1', receptionNumber: '600', parcelIndex: 1,
                name: '이영희', subCategory: '논', purpose: '판매',
                lotAddress: '상위 주소', area: '100', cropsDisplay: '벼',
                parcels: [{
                    lotAddress: '필지1 주소', isMountain: false,
                    crops: [{ name: '벼', area: '100' }], category: '논', purpose: '유기', subLots: []
                }]
            },
            {
                id: 22, groupId: 'g1', receptionNumber: '600-1', parcelIndex: 2,
                name: '이영희', subCategory: '밭', purpose: '판매',
                lotAddress: '상위 주소2', area: '200', cropsDisplay: '콩',
                parcels: [{
                    lotAddress: '필지2 주소', isMountain: false,
                    crops: [{ name: '콩', area: '200' }], category: '밭', purpose: 'GAP', subLots: []
                }]
            }
        ]
        m.populateFormForGroupEdit(groupLogs)

        expect(m.receptionNumberInput.value).toBe('600') // 서브넘버 제외 기본번호
        expect(document.getElementById('name').value).toBe('이영희')
        expect(m.parcels).toHaveLength(2)

        expect(m.parcels[0].category).toBe('논')
        expect(m.parcels[0].purpose).toBe('유기')
        expect(m.parcels[0].lotAddress).toBe('필지1 주소')
        expect(m.parcels[0].crops).toEqual([{ name: '벼', area: '100' }])

        expect(m.parcels[1].category).toBe('밭')
        expect(m.parcels[1].purpose).toBe('GAP')
        expect(m.parcels[1].lotAddress).toBe('필지2 주소')
        expect(m.parcels[1].crops).toEqual([{ name: '콩', area: '200' }])
    })

    it('SLS-1-164 회귀: parcels[0]이 빈 stub이면 최상위 레코드값으로 폴백(소실 방지)', () => {
        const groupLogs = [
            {
                id: 31, groupId: 'g2', receptionNumber: '700', parcelIndex: 1,
                name: '박민수', subCategory: '과수', purpose: '판매',
                lotAddress: '과수원 주소', area: '300', cropsDisplay: '사과',
                parcels: [{ lotAddress: '', isMountain: false, crops: [], category: '', purpose: '', subLots: [] }]
            },
            {
                id: 32, groupId: 'g2', receptionNumber: '700-1', parcelIndex: 2,
                name: '박민수', subCategory: '밭', purpose: '자가소비',
                lotAddress: '밭 주소', area: '150', cropsDisplay: '배추',
                parcels: [{ lotAddress: '', isMountain: false, crops: [], category: '', purpose: '', subLots: [] }]
            }
        ]
        m.populateFormForGroupEdit(groupLogs)

        expect(m.parcels).toHaveLength(2)

        // 빈 stub → 최상위(구분·용도·작물·면적·주소)로 폴백, 어느 값도 소실되지 않음
        const p0 = m.parcels[0]
        expect(p0.category).toBe('과수')
        expect(p0.purpose).toBe('판매')
        expect(p0.lotAddress).toBe('과수원 주소')
        expect(p0.crops).toEqual([{ name: '사과', area: '300' }])

        const p1 = m.parcels[1]
        expect(p1.category).toBe('밭')
        expect(p1.purpose).toBe('자가소비')
        expect(p1.lotAddress).toBe('밭 주소')
        expect(p1.crops).toEqual([{ name: '배추', area: '150' }])
    })

    it('parcels 필드 자체가 없는(undefined) 멤버도 stub 합성으로 카드 누락 없이 폴백', () => {
        const groupLogs = [
            {
                id: 41, groupId: 'g3', receptionNumber: 'F800', parcelIndex: 1,
                name: '최성토', subCategory: '성토', purpose: '판매',
                lotAddress: '성토 주소', area: '500', cropsDisplay: '벼'
                // parcels 없음
            }
        ]
        m.populateFormForGroupEdit(groupLogs)

        expect(m.parcels).toHaveLength(1)
        const p = m.parcels[0]
        expect(p.category).toBe('성토')
        expect(p.purpose).toBe('판매')
        expect(p.lotAddress).toBe('성토 주소')
        expect(p.crops).toEqual([{ name: '벼', area: '500' }])
    })
})
