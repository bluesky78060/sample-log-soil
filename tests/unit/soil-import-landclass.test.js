import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-234: 경지구분 1차를 행별로 읽어 저장
//
// 🚨 1차는 단순한 라벨이 아니다. **접수번호가 1차마다 독립 시퀀스**다
//    (soil-script.js:992 addImportedRecord). 한 배치에 여러 1차가 섞이면
//    번호 풀·배치 집합·커서가 전부 1차마다 있어야 한다.
//
// ⚠️ 저장 경로는 이미 1차별로 옳다. 여기서 어긋나면
//    - 자동부여 행: 미리보기에 보인 번호가 **실제 저장 번호와 달라진다**
//    - 수동 번호 행: 중복 판정이 1차를 무시해 자체 5와 대표필지 5를 충돌로 보고 **건너뛴다**
//    뒤쪽이 실제 데이터 손실이다.
//
// ⚠️ 이 영역은 SLS-1-222(같은 번호 두 건)·SLS-1-223(네임스페이스 위반)에서 사고가 났다.

let fns
beforeAll(async () => {
    await import('../../src/shared/sanitize.js')
    await import('../../src/soil/reception-number.js')
    await import('../../src/soil/soil-result-importer.js')
    fns = window.SoilResultImporter?._fns
    expect(fns, '_fns가 노출되지 않았다').toBeTruthy()
})

/** 열: [성명, 경지구분1차, 구분] */
const MAPPING = { name: 0, landClass1: 1, subCategory: 2 }
const preview = (rows, opts = {}) => fns.computePreview({
    rows, mapping: MAPPING, landClass1: '농가의뢰', logs: [], ...opts,
})
const numbers = (p) => p.items.map((it) => it.display)

describe('행별 1차 읽기', () => {
    it('1. 열의 값이 그대로 rec.landClass1에 들어간다', () => {
        const p = preview([['홍길동', '자체', '논'], ['김철수', '대표필지', '밭']])
        expect(p.items.map((it) => it.rec.landClass1)).toEqual(['자체', '대표필지'])
    })

    it('6. 빈 칸이면 창에서 고른 값을 쓴다', () => {
        const p = preview([['홍길동', '', '논']])
        expect(p.items[0].rec.landClass1).toBe('농가의뢰')
    })

    it('열이 매핑되지 않으면 창 선택값 (기존 동작)', () => {
        const p = fns.computePreview({
            rows: [['홍길동', '자체', '논']], mapping: { name: 0, subCategory: 2 },
            landClass1: '공익직불제', logs: [],
        })
        expect(p.items[0].rec.landClass1).toBe('공익직불제')
    })

    // 🚨 조용히 기본값으로 바꾸면 엉뚱한 경지구분으로 저장되고
    //    흙토람 내보내기·통계·번호 시퀀스가 함께 어긋난다
    it('7. 목록에 없는 값은 오류 행이 되고, 사유에 그 값과 빠져나갈 길이 있다', () => {
        const p = preview([['홍길동', '직불(일반)', '논']])
        expect(p.stats.err).toBe(1)
        expect(p.willImport).toBe(0)
        expect(p.items[0].reason).toContain('직불(일반)')
        expect(p.items[0].reason, '고칠 방법을 안 알려 준다').toMatch(/매핑을 해제|엑셀을 고치/)
    })
})

// ══════════════════════════════════════════════════════════════
// 이 파일의 핵심 — 번호가 1차별로 독립인가
// ══════════════════════════════════════════════════════════════
describe('접수번호가 1차별로 독립이다', () => {
    it('2. 섞인 배치에서 각 1차가 1부터 따로 매겨진다', () => {
        const p = preview([
            ['가', '자체', '논'],
            ['나', '대표필지', '논'],
            ['다', '자체', '논'],
            ['라', '대표필지', '논'],
        ])
        // 자체 1·2, 대표필지 1·2가 행 순서대로 번갈아 나온다.
        // 1차를 무시하고 한 줄로 이어 붙이면 1,2,3,4가 된다.
        expect(numbers(p), '1차를 무시하고 한 줄로 이어 붙였다').toEqual(['1', '1', '2', '2'])
    })

    it('3. 기존 로그가 있으면 1차별 최대값 다음부터 이어진다', () => {
        const logs = [
            { receptionNumber: '10', landClass1: '자체', subCategory: '논' },
            { receptionNumber: '3', landClass1: '대표필지', subCategory: '논' },
        ]
        const p = preview([['가', '자체', '논'], ['나', '대표필지', '논']], { logs })
        expect(numbers(p), '남의 시퀀스 최대값을 봤다').toEqual(['11', '4'])
    })

    // 🚨 성토는 F 접두의 별 시퀀스다. 1차 × 성토 = 2×2 조합이 전부 독립이어야 한다
    it('4. 성토(F) 시퀀스도 1차별로 독립이다', () => {
        const p = preview([
            ['가', '자체', '성토'],
            ['나', '대표필지', '성토'],
            ['다', '자체', '성토'],
            ['라', '자체', '논'],
        ])
        expect(numbers(p), '성토 풀을 1차끼리 공유했다').toEqual(['F1', 'F1', 'F2', '1'])
    })

    it('4-b. 같은 1차 안에서는 일반과 성토가 서로 방해하지 않는다', () => {
        const p = preview([
            ['가', '자체', '논'],
            ['나', '자체', '성토'],
            ['다', '자체', '논'],
        ])
        expect(numbers(p)).toEqual(['1', 'F1', '2'])
    })
})

describe('수동 번호 중복 판정도 1차별이다', () => {
    // 🚨 여기가 실제 데이터 손실 지점이다 — 충돌로 보면 그 행을 **건너뛴다**
    it('5. 다른 1차의 같은 번호는 충돌이 아니다', () => {
        const rows = [['가', '자체', '논'], ['나', '대표필지', '논']]
        const mapping = { name: 0, landClass1: 1, subCategory: 2, receptionNumber: 3 }
        const p = fns.computePreview({
            rows: rows.map((r, i) => [...r, '5']),
            mapping, landClass1: '농가의뢰', logs: [], autoNumber: false,
        })
        expect(p.stats.dup, '자체 5와 대표필지 5를 충돌로 봤다').toBe(0)
        expect(p.willImport, '한 행이 건너뛰어졌다').toBe(2)
    })

    it('5-b. 같은 1차 안에서는 여전히 충돌로 잡는다', () => {
        const mapping = { name: 0, landClass1: 1, subCategory: 2, receptionNumber: 3 }
        const p = fns.computePreview({
            rows: [['가', '자체', '논', '5'], ['나', '자체', '논', '5']],
            mapping, landClass1: '농가의뢰', logs: [], autoNumber: false,
        })
        expect(p.stats.dup, '같은 1차의 중복을 놓쳤다').toBe(1)
    })

    it('5-c. 기존 로그와의 중복도 1차별로 본다', () => {
        const logs = [{ receptionNumber: '5', landClass1: '자체', subCategory: '논' }]
        const mapping = { name: 0, landClass1: 1, subCategory: 2, receptionNumber: 3 }
        const p = fns.computePreview({
            rows: [['가', '대표필지', '논', '5']],
            mapping, landClass1: '농가의뢰', logs, autoNumber: false,
        })
        expect(p.stats.dup, '남의 1차 번호를 중복으로 봤다').toBe(0)
    })
})

describe('기존 경로 회귀 (열이 없을 때)', () => {
    // 🚨 1차별로 나누다가 단일 1차 동작을 깨뜨리면 지금 쓰는 사람이 전부 영향을 받는다
    it('8. 열이 매핑되지 않으면 지금과 완전히 같다', () => {
        const rows = [['가', '', '논'], ['나', '', '논'], ['다', '', '성토']]
        const p = fns.computePreview({
            rows, mapping: { name: 0, subCategory: 2 }, landClass1: '농가의뢰',
            logs: [{ receptionNumber: '7', landClass1: '농가의뢰', subCategory: '논' }],
        })
        expect(numbers(p)).toEqual(['8', '9', 'F1'])
        expect(p.items.every((it) => it.rec.landClass1 === '농가의뢰')).toBe(true)
    })

    it('호출부가 넘긴 단일 커서가 존중된다', () => {
        const p = fns.computePreview({
            rows: [['가', '', '논']], mapping: { name: 0, subCategory: 2 },
            landClass1: '농가의뢰', logs: [], nextNumber: 50,
        })
        expect(numbers(p)).toEqual(['50'])
    })

    it('1차별 커서를 주면 그쪽이 우선한다', () => {
        const p = preview([['가', '자체', '논'], ['나', '대표필지', '논']], {
            nextNumberByClass: { 자체: 100, 대표필지: 200 },
        })
        expect(numbers(p)).toEqual(['100', '200'])
    })
})

// 🚨 codex 코드리뷰 MAJOR — 헤더가 그냥 '경지구분'이면 1차인지 2차인지 알 수 없다.
//    서식(2단 병합)에서는 왼쪽이라 1차가 맞지만, 평평한 1행 헤더 파일에서 그 열에
//    논/밭이 들어 있으면 1차로 읽혀 **전 행이 오류가 되고 가져오기가 통째로 막힌다.**
describe('값을 보고 1차↔2차를 바로잡는다', () => {
    const refine = (mapping, rows) => fns.refineMappingByValues(mapping, rows)

    it('9. 값이 논/밭이면 2차로 옮긴다', () => {
        const m = refine({ name: 0, landClass1: 1 }, [['홍길동', '논'], ['김철수', '밭']])
        expect(m.landClass1, '논/밭인데 1차로 뒀다').toBeUndefined()
        expect(m.subCategory, '2차로 안 옮겼다').toBe(1)
    })

    it('10. 값이 1차 목록이면 그대로 둔다', () => {
        const m = refine({ name: 0, landClass1: 1 }, [['가', '자체'], ['나', '대표필지']])
        expect(m.landClass1).toBe(1)
        expect(m.subCategory).toBeUndefined()
    })

    // ⚠️ 애매하면 손대지 않는다 — 추측으로 옮기다 멀쩡한 매핑을 망가뜨리는 쪽이 더 나쁘다
    it('11. 1차 값이 하나라도 있으면 옮기지 않는다', () => {
        const m = refine({ name: 0, landClass1: 1 }, [['가', '자체'], ['나', '논']])
        expect(m.landClass1, '섞여 있는데 옮겨 버렸다').toBe(1)
    })

    it('12. 알 수 없는 값뿐이면 손대지 않는다', () => {
        const m = refine({ name: 0, landClass1: 1 }, [['가', '직불(일반)']])
        expect(m.landClass1).toBe(1)
    })

    // 그 열을 빼앗으면 제대로 잡힌 2차가 사라진다
    it('13. 2차가 이미 다른 열에 잡혀 있으면 옮기지 않는다', () => {
        const m = refine({ name: 0, landClass1: 1, subCategory: 2 }, [['가', '논', '밭']])
        expect(m.landClass1).toBe(1)
        expect(m.subCategory).toBe(2)
    })

    it('14. 데이터가 없으면 손대지 않는다', () => {
        expect(refine({ landClass1: 1 }, []).landClass1).toBe(1)
        expect(refine({ landClass1: 1 }, [['', '']]).landClass1).toBe(1)
    })
})
