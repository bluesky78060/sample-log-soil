import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-164: flattenLogsForTable는 this 미참조 순수 메서드 →
// prototype.call(null, logs)로 직접 검증 (soil-cloud-sync.test.js가 import 안전성 입증)
let flatten

beforeAll(async () => {
    // soil-script.js의 extends 대상이 먼저 window에 노출돼야 한다
    await import('../../src/shared/BaseSampleManager.js')
    // 폴백 헬퍼(window.SoilLogRecord) — 프로덕션은 submitForm에서 이미 로드 보장
    await import('../../src/soil/soil-log-record.js')
    await import('../../src/soil/soil-script.js')
    const fn = window.SoilSampleManager.prototype.flattenLogsForTable
    flatten = (logs) => fn.call(null, logs)
})

describe('flattenLogsForTable 폴백 (SLS-1-164)', () => {
    it('정상 레코드는 parcels[0] 값 그대로 (무변경)', () => {
        const log = {
            id: 1, receptionNumber: '503', subCategory: '논', purpose: '판매',
            lotAddress: '경북 봉화군 1', area: '300', cropsDisplay: '벼',
            parcels: [{ lotAddress: '경북 봉화군 1', isMountain: false,
                crops: [{ name: '벼', area: '300', unit: 'm2' }], category: '논', purpose: '판매', subLots: [] }]
        }
        const rows = flatten([log])
        expect(rows).toHaveLength(1)
        expect(rows[0]._cropsDisplay).toBe('벼')
        expect(rows[0]._areaDisplay).toBe('300㎡')
        expect(rows[0]._lotAddress).toBe('경북 봉화군 1')
        expect(rows[0]._parcelPurpose).toBe('판매')
    })

    it('category/purpose stub(검증된 버그) → 최상위로 _parcelPurpose 복원', () => {
        const log = {
            id: 2, receptionNumber: '504', subCategory: '밭', purpose: '자가소비',
            lotAddress: '경북 봉화군 2', area: '150', cropsDisplay: '콩',
            parcels: [{ lotAddress: '경북 봉화군 2', isMountain: false,
                crops: [{ name: '콩', area: '150', unit: 'm2' }], category: '', purpose: '', subLots: [] }]
        }
        const rows = flatten([log])
        expect(rows[0]._parcelPurpose).toBe('자가소비')
    })

    it('완전 stub 대표필지 → 최상위 cropsDisplay/area/lotAddress 폴백(방어적)', () => {
        const log = {
            id: 3, receptionNumber: '505', subCategory: '논', purpose: '판매',
            lotAddress: '경북 봉화군 3', area: '200', cropsDisplay: '벼, 보리',
            parcels: [{ lotAddress: '', isMountain: false, crops: [], category: '', purpose: '', subLots: [] }]
        }
        const rows = flatten([log])
        expect(rows[0]._cropsDisplay).toBe('벼, 보리')
        expect(rows[0]._areaDisplay).toBe('200')
        expect(rows[0]._lotAddress).toBe('경북 봉화군 3')
    })

    it("완전 stub 대표필지 + area='0' → '-'가 아닌 '0' 표시(계약 핀)", () => {
        const log = {
            id: 6, receptionNumber: '508', subCategory: '논', purpose: '판매',
            lotAddress: '경북 봉화군 6', area: '0', cropsDisplay: '벼',
            parcels: [{ lotAddress: '', isMountain: false, crops: [], category: '', purpose: '', subLots: [] }]
        }
        const rows = flatten([log])
        expect(rows[0]._areaDisplay).toBe('0')
    })

    it('subLot 행은 최상위 미상속 (하위필지 독립)', () => {
        const log = {
            id: 4, receptionNumber: '506', subCategory: '논', purpose: '판매',
            lotAddress: '경북 봉화군 4', area: '400', cropsDisplay: '벼',
            parcels: [{
                lotAddress: '경북 봉화군 4', isMountain: false,
                crops: [{ name: '벼', area: '400', unit: 'm2' }], category: '논', purpose: '판매',
                subLots: [{ lotAddress: '경북 봉화군 4-1', crops: [] }]
            }]
        }
        const rows = flatten([log])
        // 행0=대표필지, 행1=하위필지
        expect(rows).toHaveLength(2)
        expect(rows[1]._lotAddress).toBe('경북 봉화군 4-1')
        expect(rows[1]._cropsDisplay).toBe('-')   // 최상위 cropsDisplay('벼')를 상속하지 않음
    })

    it('parcels 배열 없는 레거시 레코드는 최상위 분기로 처리(기존 동작 유지)', () => {
        const log = {
            id: 5, receptionNumber: '507', lotAddress: '경북 봉화군 5',
            area: '100', cropsDisplay: '배추', parcels: []
        }
        const rows = flatten([log])
        expect(rows).toHaveLength(1)
        expect(rows[0]._cropsDisplay).toBe('배추')
        expect(rows[0]._lotAddress).toBe('경북 봉화군 5')
    })
})
