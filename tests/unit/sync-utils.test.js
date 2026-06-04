import { describe, it, expect, beforeAll } from 'vitest'

// sync-utils.js를 import → window.SyncUtils 노출
let SU
beforeAll(async () => {
    await import('../../src/shared/sync-utils.js')
    SU = window.SyncUtils
})

describe('getTimestamp — 다양한 형식을 ms로 정규화', () => {
    it('falsy → 0', () => {
        expect(SU.getTimestamp(null)).toBe(0)
        expect(SU.getTimestamp(undefined)).toBe(0)
        expect(SU.getTimestamp(0)).toBe(0)
        expect(SU.getTimestamp('')).toBe(0)
    })
    it('Firestore Timestamp({seconds}) → seconds*1000', () => {
        expect(SU.getTimestamp({ seconds: 100 })).toBe(100000)
        expect(SU.getTimestamp({ seconds: 1700000000 })).toBe(1700000000000)
    })
    it('ISO 문자열 → Date.getTime()', () => {
        expect(SU.getTimestamp('2026-01-01T00:00:00.000Z')).toBe(Date.parse('2026-01-01T00:00:00.000Z'))
    })
    it('숫자 → 그대로', () => {
        expect(SU.getTimestamp(1700000000000)).toBe(1700000000000)
    })
    it('잘못된 ISO 문자열 → NaN (비교 시 항상 false가 되는 분기)', () => {
        expect(SU.getTimestamp('invalid-date')).toBeNaN()
    })
})

describe('normalizeId — ID 문자열 정규화', () => {
    it('null/undefined → null', () => {
        expect(SU.normalizeId(null)).toBe(null)
        expect(SU.normalizeId(undefined)).toBe(null)
    })
    it('숫자 → 문자열', () => {
        expect(SU.normalizeId(5)).toBe('5')
        expect(SU.normalizeId(0)).toBe('0')
    })
    it('문자열은 트림', () => {
        expect(SU.normalizeId('  abc  ')).toBe('abc')
    })
    it('빈/공백 문자열 → null', () => {
        expect(SU.normalizeId('')).toBe(null)
        expect(SU.normalizeId('   ')).toBe(null)
    })
    it('NaN → null', () => {
        expect(SU.normalizeId(NaN)).toBe(null)
    })
})

describe('getItemId — id 우선, 없으면 receptionNumber', () => {
    it('id 우선', () => {
        expect(SU.getItemId({ id: 1, receptionNumber: '9' })).toBe('1')
    })
    it('id 없으면 receptionNumber 폴백', () => {
        expect(SU.getItemId({ receptionNumber: '7' })).toBe('7')
    })
    it('둘 다 없으면 null', () => {
        expect(SU.getItemId({})).toBe(null)
        expect(SU.getItemId(null)).toBe(null)
    })
})

describe('smartMerge — 로컬↔클라우드 병합 (데이터 유실 방지 핵심)', () => {
    const item = (id, receptionNumber, updatedAt, extra) =>
        ({ id, receptionNumber, updatedAt, ...(extra || {}) })

    it('클라우드에만 있는 항목은 추가(added)', () => {
        const local = []
        const cloud = [item('1', '1', '2026-01-01T00:00:00Z')]
        const r = SU.smartMerge(local, cloud)
        expect(r.added).toBe(1)
        expect(r.hasChanges).toBe(true)
        expect(r.data).toHaveLength(1)
    })

    it('양쪽 동일 id — 클라우드가 더 최신이면 클라우드 채택(updated)', () => {
        const local = [item('1', '1', '2026-01-01T00:00:00Z', { name: '로컬' })]
        const cloud = [item('1', '1', '2026-02-01T00:00:00Z', { name: '클라우드' })]
        const r = SU.smartMerge(local, cloud)
        expect(r.updated).toBe(1)
        expect(r.data[0].name).toBe('클라우드')
    })

    it('양쪽 동일 id — 로컬이 더 최신이면 로컬 유지', () => {
        const local = [item('1', '1', '2026-03-01T00:00:00Z', { name: '로컬' })]
        const cloud = [item('1', '1', '2026-01-01T00:00:00Z', { name: '클라우드' })]
        const r = SU.smartMerge(local, cloud)
        expect(r.updated).toBe(0)
        expect(r.data[0].name).toBe('로컬')
    })

    it('★ 로컬에만 있고 syncedAt 없음 → 미업로드분이므로 보존(유실 방지)', () => {
        const local = [item('9', '9', '2026-01-01T00:00:00Z')] // syncedAt 없음
        const cloud = []
        const r = SU.smartMerge(local, cloud)
        expect(r.deleted).toBe(0)
        expect(r.data).toHaveLength(1)
        expect(r.data[0].id).toBe('9')
    })

    it('★ 로컬에만 있고 syncedAt 있음 → 클라우드에서 삭제된 것으로 보고 제거(deleted)', () => {
        const local = [item('9', '9', '2026-01-01T00:00:00Z', { syncedAt: '2026-01-02T00:00:00Z' })]
        const cloud = []
        const r = SU.smartMerge(local, cloud)
        expect(r.deleted).toBe(1)
        expect(r.hasChanges).toBe(true)
        expect(r.data).toHaveLength(0)
    })

    it('변경 없으면 hasChanges=false', () => {
        const local = [item('1', '1', '2026-01-01T00:00:00Z')]
        const cloud = [item('1', '1', '2026-01-01T00:00:00Z')]
        const r = SU.smartMerge(local, cloud)
        expect(r.hasChanges).toBe(false)
        expect(r.added + r.updated + r.deleted).toBe(0)
    })

    it('ISO(로컬) vs Firestore seconds(클라우드) 혼합 비교가 정상 동작', () => {
        const localTime = '2026-01-01T00:00:00Z'
        const cloudSeconds = Math.floor(Date.parse('2026-02-01T00:00:00Z') / 1000)
        const local = [item('1', '1', localTime, { name: '로컬' })]
        const cloud = [{ id: '1', receptionNumber: '1', updatedAt: { seconds: cloudSeconds }, name: '클라우드' }]
        const r = SU.smartMerge(local, cloud)
        expect(r.data[0].name).toBe('클라우드') // 클라우드(2월)가 더 최신
    })

    it('결과는 receptionNumber 오름차순 정렬', () => {
        const local = []
        const cloud = [
            item('3', '3', '2026-01-01T00:00:00Z'),
            item('1', '1', '2026-01-01T00:00:00Z'),
            item('2', '2', '2026-01-01T00:00:00Z'),
        ]
        const r = SU.smartMerge(local, cloud)
        expect(r.data.map(d => d.receptionNumber)).toEqual(['1', '2', '3'])
    })

    it('숫자 본번 동률(가지번호)이면 문자열 보조키로 안정 정렬', () => {
        const local = []
        const cloud = [
            item('b', '5-3', '2026-01-01T00:00:00Z'),
            item('a', '5-2', '2026-01-01T00:00:00Z'),
        ]
        const r = SU.smartMerge(local, cloud)
        // parseInt 둘 다 5(동률) → localeCompare로 '5-2' < '5-3'
        expect(r.data.map(d => d.receptionNumber)).toEqual(['5-2', '5-3'])
    })

    it('비숫자 접수번호(parseInt→0 clump)도 보조키로 결정적 정렬', () => {
        const local = []
        const cloud = [
            item('y', 'bbb', '2026-01-01T00:00:00Z'),
            item('x', 'aaa', '2026-01-01T00:00:00Z'),
        ]
        const r = SU.smartMerge(local, cloud)
        expect(r.data.map(d => d.receptionNumber)).toEqual(['aaa', 'bbb'])
    })

    it('숫자/문자 혼용 id도 정규화하여 동일 항목으로 매칭', () => {
        const local = [{ id: 1, receptionNumber: '1', updatedAt: '2026-01-01T00:00:00Z', name: '로컬' }]
        const cloud = [{ id: '1', receptionNumber: '1', updatedAt: '2026-02-01T00:00:00Z', name: '클라우드' }]
        const r = SU.smartMerge(local, cloud)
        expect(r.data).toHaveLength(1)        // 중복 아님
        expect(r.data[0].name).toBe('클라우드')
    })
})
