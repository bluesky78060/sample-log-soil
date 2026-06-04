import { describe, it, expect, beforeAll } from 'vitest'

// soil-log-record.js → window.SoilLogRecord.buildSoilLogRecord
let build
beforeAll(async () => {
    await import('../../src/soil/soil-log-record.js')
    build = window.SoilLogRecord.buildSoilLogRecord
})

const parcel = (over = {}) => ({
    lotAddress: '봉화군 봉화읍 내성리 123',
    isMountain: false,
    subLots: [{ id: 's1' }],
    crops: [{ name: '벼', area: '1000' }, { name: '콩', area: '500' }],
    category: '논',
    purpose: '일반재배',
    note: '비고',
    ...over,
})

const commonNew = {
    date: '2026-06-04', name: '홍길동', phoneNumber: '010', address: '주소',
    subCategory: '-', purpose: '무농약', landClass1: '농가의뢰', receptionMethod: '-',
    note: '', gongikOrder: '1', gongikBaseYear: '', createdAt: 'C', updatedAt: 'U',
}
const commonGroup = {
    date: '2026-06-04', name: '홍길동', phoneNumber: '010', address: '주소',
    subCategory: '-', purpose: '무농약', landClass1: '농가의뢰', receptionMethod: '-',
    note: '', updatedAt: 'U',
}

describe('buildSoilLogRecord — 신규 단일(필지 단위)', () => {
    const r = () => build(parcel(), {
        receptionNumber: '5', commonData: commonNew, groupId: 'g1',
        index: 0, totalParcels: 2, isGroupEdit: false,
    })

    it('공통 필드 + commonData spread', () => {
        const rec = r()
        expect(rec.receptionNumber).toBe('5')
        expect(rec.groupId).toBe('g1')
        expect(rec.parcelIndex).toBe(1)
        expect(rec.totalParcels).toBe(2)
        expect(rec.name).toBe('홍길동')
        expect(rec.gongikOrder).toBe('1')   // commonData에서
        expect(rec.createdAt).toBe('C')      // commonData에서
    })
    it('parcel.category/purpose가 commonData보다 우선', () => {
        const rec = r()
        expect(rec.subCategory).toBe('논')      // parcel.category
        expect(rec.purpose).toBe('일반재배')     // parcel.purpose
    })
    it('단일 모드: 작물 전체 합산 area, join cropsDisplay, subLots 복제', () => {
        const rec = r()
        expect(rec.area).toBe('1500')                  // 1000+500
        expect(rec.cropsDisplay).toBe('벼, 콩')
        expect(rec.parcels[0].subLots).toEqual([{ id: 's1' }])
        expect(rec.parcels[0].crops).toHaveLength(2)
        expect(rec.cropIndex).toBeUndefined()          // 단일 모드는 cropIndex 없음
    })
    it('신규 모드: businessRegNo/basePnu/isComplete 필드 없음(기존 동작 보존)', () => {
        const rec = r()
        expect('businessRegNo' in rec).toBe(false)
        expect('basePnu' in rec).toBe(false)
        expect('isComplete' in rec).toBe(false)
    })
})

describe('buildSoilLogRecord — 신규 분할(작물별)', () => {
    const r = () => build(parcel(), {
        receptionNumber: '5-1', commonData: commonNew, groupId: 'g1',
        index: 0, totalParcels: 2, crop: { name: '콩', area: '500' }, cropIndex: 1, isGroupEdit: false,
    })
    it('분할 모드: 단일 작물 area/cropsDisplay, subLots 미복제, cropIndex', () => {
        const rec = r()
        expect(rec.area).toBe('500')
        expect(rec.cropsDisplay).toBe('콩')
        expect(rec.parcels[0].subLots).toEqual([])     // 분할은 subLots 미복제
        expect(rec.parcels[0].crops).toEqual([{ name: '콩', area: '500' }])
        expect(rec.cropIndex).toBe(2)                  // cropIndex+1
    })
})

describe('buildSoilLogRecord — 그룹수정(existingLog 보존)', () => {
    const existing = {
        id: 'old-id', createdAt: 'OLD-C', isComplete: true,
        businessRegNo: 'B123', gongikOrder: '2', gongikBaseYear: '2025', basePnu: 'PNU1',
    }
    it('id/createdAt/isComplete/businessRegNo/gongik/basePnu 보존', () => {
        const rec = build(parcel(), {
            receptionNumber: '5', commonData: commonGroup, groupId: 'g1',
            index: 0, totalParcels: 1, isGroupEdit: true, existingLog: existing,
        })
        expect(rec.id).toBe('old-id')
        expect(rec.createdAt).toBe('OLD-C')
        expect(rec.isComplete).toBe(true)
        expect(rec.businessRegNo).toBe('B123')
        expect(rec.gongikOrder).toBe('2')
        expect(rec.gongikBaseYear).toBe('2025')
        expect(rec.basePnu).toBe('PNU1')
    })
    it('그룹수정 + 분할 조합: 보존 필드와 cropIndex가 함께 작동', () => {
        const rec = build(parcel(), {
            receptionNumber: '5-1', commonData: commonGroup, groupId: 'g1',
            index: 0, totalParcels: 1, crop: { name: '콩', area: '500' }, cropIndex: 1,
            isGroupEdit: true, existingLog: existing,
        })
        // 분할 모드 동작
        expect(rec.cropIndex).toBe(2)
        expect(rec.area).toBe('500')
        expect(rec.cropsDisplay).toBe('콩')
        expect(rec.parcels[0].subLots).toEqual([])
        // 보존 필드 동시 적용
        expect(rec.id).toBe('old-id')
        expect(rec.createdAt).toBe('OLD-C')
        expect(rec.businessRegNo).toBe('B123')
        expect(rec.gongikOrder).toBe('2')
        expect(rec.basePnu).toBe('PNU1')
    })
    it('existingLog 없으면(인덱스 초과) 기본값으로 보존 필드 채움', () => {
        const rec = build(parcel(), {
            receptionNumber: '6', commonData: commonGroup, groupId: 'g1',
            index: 1, totalParcels: 2, isGroupEdit: true, existingLog: undefined, now: 'NOW',
        })
        expect(rec.id).toBeTruthy()           // 새 id 생성
        expect(rec.createdAt).toBe('NOW')
        expect(rec.isComplete).toBe(false)
        expect(rec.businessRegNo).toBe('')
        expect(rec.gongikOrder).toBe('1')
        expect(rec.basePnu).toBe('')
    })
})

describe('buildSoilLogRecord — 엣지', () => {
    it('빈 작물명 → cropsDisplay 하이픈', () => {
        const rec = build(parcel({ crops: [{ name: '', area: '0' }] }), {
            receptionNumber: '1', commonData: commonNew, groupId: 'g', index: 0, totalParcels: 1, isGroupEdit: false,
        })
        expect(rec.cropsDisplay).toBe('-')
    })
    it('isMountain/parcel 필드 매핑', () => {
        const rec = build(parcel({ isMountain: true }), {
            receptionNumber: '1', commonData: commonNew, groupId: 'g', index: 0, totalParcels: 1, isGroupEdit: false,
        })
        expect(rec.parcels[0].isMountain).toBe(true)
        expect(rec.lotAddress).toBe('봉화군 봉화읍 내성리 123')
    })
})
