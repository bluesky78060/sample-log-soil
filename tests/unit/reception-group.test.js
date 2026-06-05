import { describe, it, expect, beforeAll } from 'vitest'

// reception-group.js → window.ReceptionGroup
let RG
beforeAll(async () => {
    await import('../../src/soil/reception-group.js')
    RG = window.ReceptionGroup
})

describe('parseReceptionGroup', () => {
    it('일반 번호: base만, isFill=false', () => {
        expect(RG.parseReceptionGroup('503')).toEqual({ base: '503', isFill: false })
    })
    it('가지번호: 첫 "-" 앞 본번', () => {
        expect(RG.parseReceptionGroup('503-2')).toEqual({ base: '503', isFill: false })
    })
    it('성토(F접두): base는 F 제거, isFill=true', () => {
        expect(RG.parseReceptionGroup('F503')).toEqual({ base: '503', isFill: true })
        expect(RG.parseReceptionGroup('F503-1')).toEqual({ base: '503', isFill: true })
    })
    it('빈/누락 입력 → base 빈 문자열', () => {
        expect(RG.parseReceptionGroup('')).toEqual({ base: '', isFill: false })
        expect(RG.parseReceptionGroup(undefined)).toEqual({ base: '', isFill: false })
        expect(RG.parseReceptionGroup(null)).toEqual({ base: '', isFill: false })
    })
})

describe('isSameGroup', () => {
    it('같은 본번 + 같은 일반 → 같은 그룹', () => {
        expect(RG.isSameGroup('503', '503-2')).toBe(true)
    })
    it('일반 vs 성토는 본번 같아도 다른 그룹', () => {
        expect(RG.isSameGroup('503', 'F503')).toBe(false)
    })
    it('다른 본번 → 다른 그룹', () => {
        expect(RG.isSameGroup('503', '504')).toBe(false)
    })
    it('빈 본번은 항상 false', () => {
        expect(RG.isSameGroup('', '')).toBe(false)
        expect(RG.isSameGroup('', '503')).toBe(false)
    })
})

describe('findRelatedLogs (테이블 완료 그룹 연동)', () => {
    const logs = [
        { id: 1, receptionNumber: '503' },
        { id: 2, receptionNumber: '503-1' },
        { id: 3, receptionNumber: '503-2' },
        { id: 4, receptionNumber: 'F503' },      // 성토 — 별개 그룹
        { id: 5, receptionNumber: '504' },
    ]
    it('같은 본번 일반 시료만 묶음 (성토 제외)', () => {
        const r = RG.findRelatedLogs(logs, '503')
        expect(r.map(l => l.id).sort()).toEqual([1, 2, 3])
    })
    it('가지번호로 호출해도 본번 그룹 전체', () => {
        const r = RG.findRelatedLogs(logs, '503-2')
        expect(r.map(l => l.id).sort()).toEqual([1, 2, 3])
    })
    it('성토 번호로 호출 → 성토만', () => {
        const r = RG.findRelatedLogs(logs, 'F503')
        expect(r.map(l => l.id)).toEqual([4])
    })
    it('빈 접수번호 → 빈 배열 (전체 매칭 방지)', () => {
        expect(RG.findRelatedLogs(logs, '')).toEqual([])
    })
    it('logs 누락 안전', () => {
        expect(RG.findRelatedLogs(null, '503')).toEqual([])
    })
})

describe('computeBulkTargetIds (일괄 완료 대상 계산)', () => {
    const logs = [
        { id: 1, receptionNumber: '503' },
        { id: 2, receptionNumber: '503-1' },
        { id: 3, receptionNumber: 'F503' },     // 성토 — 503 선택 시 미포함
        { id: 4, receptionNumber: '504' },
        { id: 5, receptionNumber: '504-1' },
    ]
    it('선택 1건 → 같은 그룹(연관 가지번호) 자동 포함, 성토 제외', () => {
        const t = RG.computeBulkTargetIds(logs, ['1'])
        expect([...t].sort()).toEqual(['1', '2'])
    })
    it('성토 선택 → 성토 그룹만', () => {
        const t = RG.computeBulkTargetIds(logs, ['3'])
        expect([...t]).toEqual(['3'])
    })
    it('두 그룹 선택 → 각 그룹 연관 포함 합집합', () => {
        const t = RG.computeBulkTargetIds(logs, ['1', '4'])
        expect([...t].sort()).toEqual(['1', '2', '4', '5'])
    })
    it('id 타입 혼용(숫자/문자) 안전', () => {
        const t = RG.computeBulkTargetIds(logs, [1])  // 숫자 id
        expect([...t].sort()).toEqual(['1', '2'])
    })
    it('빈 본번 선택 항목은 자기 자신만 포함(그룹 확장 없음)', () => {
        const noBase = [{ id: 9, receptionNumber: '' }, { id: 10, receptionNumber: '' }]
        const t = RG.computeBulkTargetIds(noBase, ['9'])
        expect([...t]).toEqual(['9'])
    })
    it('빈 선택 → 빈 집합', () => {
        expect(RG.computeBulkTargetIds(logs, []).size).toBe(0)
    })
})

describe('동치성: findRelatedLogs vs 기존 인라인 로직', () => {
    // 기존 인라인 로직 재현 (회귀 가드)
    const legacyRelated = (logs, receptionNumber) => {
        const isFill = receptionNumber.startsWith('F')
        const baseNumber = receptionNumber.replace(/^F/, '').split('-')[0]
        return logs.filter(l => {
            const logRec = l.receptionNumber || ''
            const logBase = logRec.replace(/^F/, '').split('-')[0]
            return logBase === baseNumber && baseNumber !== '' && logRec.startsWith('F') === isFill
        })
    }
    const logs = [
        { id: 1, receptionNumber: '503' }, { id: 2, receptionNumber: '503-1' },
        { id: 3, receptionNumber: 'F503' }, { id: 4, receptionNumber: '504' },
        { id: 5, receptionNumber: '' },
    ]
    for (const rec of ['503', '503-1', 'F503', '504', '', '999']) {
        it(`"${rec}" 결과 동일`, () => {
            expect(RG.findRelatedLogs(logs, rec).map(l => l.id))
                .toEqual(legacyRelated(logs, rec).map(l => l.id))
        })
    }
})

describe('동치성: computeBulkTargetIds vs 기존 인라인 로직', () => {
    // 기존 일괄완료 인라인 로직 재현 (회귀 가드)
    const legacyBulk = (logs, selectedIds) => {
        const selectedGroups = selectedIds.map(id => {
            const log = logs.find(l => String(l.id) === id)
            const rec = log?.receptionNumber || ''
            return { base: rec.replace(/^F/, '').split('-')[0], isFill: rec.startsWith('F') }
        }).filter(g => g.base)
        return new Set(
            logs.filter(log => {
                if (selectedIds.includes(String(log.id))) return true
                const rec = log.receptionNumber || ''
                const base = rec.replace(/^F/, '').split('-')[0]
                const isFill = rec.startsWith('F')
                return base && selectedGroups.some(g => g.base === base && g.isFill === isFill)
            }).map(log => String(log.id))
        )
    }
    const logs = [
        { id: '1', receptionNumber: '503' }, { id: '2', receptionNumber: '503-1' },
        { id: '3', receptionNumber: 'F503' }, { id: '4', receptionNumber: '504' },
        { id: '5', receptionNumber: '504-1' }, { id: '6', receptionNumber: '' },
    ]
    for (const sel of [['1'], ['3'], ['1', '4'], ['6'], ['2', '3'], []]) {
        it(`선택 [${sel.join(',')}] 결과 동일`, () => {
            expect([...RG.computeBulkTargetIds(logs, sel)].sort())
                .toEqual([...legacyBulk(logs, sel)].sort())
        })
    }
})
