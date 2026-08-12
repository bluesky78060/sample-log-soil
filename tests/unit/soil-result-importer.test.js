import { describe, it, expect, beforeAll } from 'vitest'

// soil-result-importer.js를 import → window.SoilResultImporter 노출 (IIFE, jsdom 환경)
// 테스트 대상: 접수번호 채번 순수 로직 (SLS-1-222)
//   instance._fns = { ..., collectExistingNumbers, collectLiteralNumbers, computePreview }
beforeAll(async () => {
    await import('../../src/soil/reception-number.js')
    await import('../../src/soil/soil-result-importer.js')
})

const fns = () => window.SoilResultImporter._fns
// ============================================================
// 접수번호 채번 (SLS-1-222)
//
// 이 계층은 결함이 새어나간 뒤에야 테스트가 생겼다. 성토(subCategory='성토')는
// 'F' 접두의 별 시퀀스인데 가져오기 경로가 일반 채번만 써서, 성토 행 전부가
// 같은 번호로 저장되고 이후 일반 자동채번이 1번에 고정됐다.
// ============================================================

const collect = (logs, cls, opts) => fns().collectExistingNumbers(logs, cls, opts)
const preview = (o) => fns().computePreview(o)

// 표준 매핑: 접수번호 0 / 성명 1 / 지번주소 2
const MAP = { receptionNumber: 0, name: 1, lotAddress: 2 }
// 성토 판정용: 성명 0 / 지번주소 1 / 구분 2
const MAP_FILL = { name: 0, lotAddress: 1, subCategory: 2 }

describe('collectExistingNumbers — 일반 시퀀스', () => {
    const logs = [
        { receptionNumber: '5', landClass1: '농가의뢰' },
        { receptionNumber: '6-1', landClass1: '농가의뢰' },        // 서브넘버 → 본번으로 접힘
        { receptionNumber: '7', landClass1: '공익직불제' },         // 다른 경지구분 → 제외
        { receptionNumber: '8', landClass1: '농가의뢰', subCategory: '성토' }, // 성토 → 제외
        { receptionNumber: 'F9', landClass1: '농가의뢰' },          // F 접두 → 제외
        { receptionNumber: 10, landClass1: '농가의뢰' },            // 숫자형도 처리
    ]

    it('같은 경지구분1차만 모으고 서브넘버는 본번으로 접는다', () => {
        expect([...collect(logs, '농가의뢰')].sort()).toEqual(['10', '5', '6'])
    })

    it('성토·F접두를 제외한다 (computeNextNumber와 동일 조건)', () => {
        const s = collect(logs, '농가의뢰')
        expect(s.has('8')).toBe(false)
        expect(s.has('F9')).toBe(false)
        expect(s.has('9')).toBe(false)
    })

    it('landClass1이 없으면 기본값(농가의뢰)으로 간주', () => {
        expect(collect([{ receptionNumber: '3' }], '농가의뢰').has('3')).toBe(true)
    })

    it('빈 입력·접수번호 없는 레코드', () => {
        expect(collect([], '농가의뢰').size).toBe(0)
        expect(collect(null, '농가의뢰').size).toBe(0)
        expect(collect([{ receptionNumber: '' }, {}], '농가의뢰').size).toBe(0)
    })
})

describe('collectExistingNumbers — 성토 시퀀스', () => {
    const logs = [
        { receptionNumber: '5', landClass1: '농가의뢰' },
        { receptionNumber: 'F2', landClass1: '농가의뢰', subCategory: '성토' },
        { receptionNumber: 'F7-1', landClass1: '농가의뢰', subCategory: '성토' },
        { receptionNumber: '3', landClass1: '농가의뢰', subCategory: '성토' }, // F 없는 성토
        { receptionNumber: 'F9', landClass1: '공익직불제', subCategory: '성토' },
    ]

    it('fill=true면 성토만 모으고 F를 떼서 숫자로 넣는다', () => {
        expect([...collect(logs, '농가의뢰', { fill: true })].sort()).toEqual(['2', '3', '7'])
    })

    it('두 시퀀스가 서로를 제외한다', () => {
        expect([...collect(logs, '농가의뢰')]).toEqual(['5'])
        expect(collect(logs, '농가의뢰', { fill: true }).has('5')).toBe(false)
    })

    it('경지구분 범위는 성토에도 적용된다', () => {
        expect([...collect(logs, '공익직불제', { fill: true })]).toEqual(['9'])
    })
})

describe('computePreview — 미리보기를 만들 수 없는 조건', () => {
    it('행 없음 / 매핑 없음 / 식별 필드 미매핑 → null', () => {
        expect(preview({ rows: [], mapping: MAP })).toBeNull()
        expect(preview({ rows: [['1', 'A', '주소']], mapping: {} })).toBeNull()
        expect(preview({ rows: [['벼', '1000']], mapping: { cropsDisplay: 0, area: 1 } })).toBeNull()
    })

    it('성명만 매핑돼도 만들어진다', () => {
        expect(preview({ rows: [['홍길동']], mapping: { name: 0 } })).not.toBeNull()
    })
})

describe('computePreview — 성토(F) 시퀀스 채번', () => {
    it('구분=성토 행은 F 접두로 채번되고 번호가 전진한다 (SLS-1-222 회귀)', () => {
        const r = preview({
            rows: [['A', '주소1', '성토'], ['B', '주소2', '성토'], ['C', '주소3', '성토']],
            mapping: MAP_FILL, nextFillNumber: 1,
        })
        // 수정 전에는 1, 1, 1로 저장돼 유일성이 깨졌다
        expect(r.items.map(i => i.display)).toEqual(['F1', 'F2', 'F3'])
        expect(new Set(r.items.map(i => i.display)).size).toBe(3)
    })

    it('일반과 성토가 섞이면 각자의 시퀀스로 채번된다', () => {
        const r = preview({
            rows: [['A', '주소1', '논'], ['B', '주소2', '성토'], ['C', '주소3', '밭'], ['D', '주소4', '성토']],
            mapping: MAP_FILL, nextNumber: 10, nextFillNumber: 3,
        })
        expect(r.items.map(i => i.display)).toEqual(['10', 'F3', '11', 'F4'])
    })

    it('성토 커서는 기존 성토 번호를 건너뛴다', () => {
        const r = preview({
            rows: [['A', '주소1', '성토'], ['B', '주소2', '성토']],
            mapping: MAP_FILL, existingFill: new Set(['3', '4']), nextFillNumber: 3,
        })
        expect(r.items.map(i => i.display)).toEqual(['F5', 'F6'])
    })

    it('일반 5와 성토 F5는 충돌이 아니다', () => {
        const r = preview({
            rows: [['A', '주소1', '논'], ['B', '주소2', '성토']],
            mapping: MAP_FILL,
            existing: new Set(['4']), nextNumber: 5,
            existingFill: new Set(['4']), nextFillNumber: 5,
        })
        expect(r.items.map(i => i.display)).toEqual(['5', 'F5'])
        expect(r.stats.dup).toBe(0)
    })

    it('성토 수동 번호는 표기 그대로 중복 판정한다', () => {
        // 기존 F3(성토)과 일반 3이 함께 있는 대장. 수동 F3은 F3과 충돌하고,
        // F9는 어느 표기와도 겹치지 않는다. 일반 3은 F3과 다른 표기다.
        const r = preview({
            rows: [['F3', 'A', '주소', '성토'], ['F9', 'B', '주소', '성토']],
            mapping: { receptionNumber: 0, name: 1, lotAddress: 2, subCategory: 3 },
            logs: [
                { receptionNumber: 'F3', subCategory: '성토', landClass1: '농가의뢰' },
                { receptionNumber: '3', subCategory: '논', landClass1: '농가의뢰' },
            ],
        })
        expect(r.items[0].status).toBe('dup')
        expect(r.items[1].status).toBe('new')
    })

    it('성토 수동 번호가 저장되면 성토 커서만 올라간다', () => {
        const r = preview({
            rows: [['F50', 'A', '주소', '성토'], ['', 'B', '주소', '성토'], ['', 'C', '주소', '논']],
            mapping: { receptionNumber: 0, name: 1, lotAddress: 2, subCategory: 3 },
            nextNumber: 7, nextFillNumber: 2,
        })
        expect(r.items[1].display).toBe('F51')  // 성토 커서 상향
        expect(r.items[2].display).toBe('7')    // 일반 커서는 그대로
    })

    it('자동부여 행의 rec에는 receptionNumber를 넣지 않는다 (매니저가 채번한다)', () => {
        const r = preview({ rows: [['A', '주소', '성토']], mapping: MAP_FILL, nextFillNumber: 4 })
        expect(r.items[0].display).toBe('F4')
        expect(r.items[0].auto).toBe(true)
        expect(r.items[0].rec.receptionNumber).toBeUndefined()
        expect(r.items[0].rec.subCategory).toBe('성토')
    })
})

describe('computePreview — 수동 번호와 자동부여가 섞인 배치', () => {
    // 매니저 addImportedRecord는 레코드마다 max+1로 다시 채번한다.
    // 수동 번호가 먼저 저장되면 뒤따르는 자동부여 번호가 그 위로 올라간다.
    it('수동 번호가 기존 최대값보다 크면 이후 자동부여가 그 위에서 이어진다', () => {
        const r = preview({
            rows: [['50', 'A', '주소'], ['', 'B', '주소']],
            mapping: MAP, existing: new Set(['10']), nextNumber: 11,
        })
        expect(r.items.map(i => i.display)).toEqual(['50', '51'])
    })

    it('건너뛰는 중복 행은 저장되지 않으므로 커서를 올리지 않는다', () => {
        const r = preview({
            rows: [['80', 'A', '주소'], ['', 'B', '주소']],
            mapping: MAP, nextNumber: 11, dupPolicy: 'skip',
            logs: [{ receptionNumber: '10' }, { receptionNumber: '80' }],
        })
        expect(r.items[0].skip).toBe(true)
        expect(r.items[1].display).toBe('11')
    })

    it('덮어쓰기 정책의 중복 행은 저장되므로 커서를 올린다', () => {
        const r = preview({
            rows: [['80', 'A', '주소'], ['', 'B', '주소']],
            mapping: MAP, nextNumber: 11, dupPolicy: 'overwrite',
            logs: [{ receptionNumber: '10' }, { receptionNumber: '80' }],
        })
        expect(r.items[0].skip).toBe(false)
        expect(r.items[1].display).toBe('81')
    })

    it("빈 칸 자동부여가 문자열 'null'을 만들지 않는다 (SLS-1-222 부수 회귀)", () => {
        // 커서 초기화를 autoAll로 감싸면 String(null) → 'null'이 된다
        const r = preview({
            rows: [['', 'A', '주소'], ['', 'B', '주소']],
            mapping: MAP, existing: new Set(['1', '2']),
        })
        expect(r.items.map(i => i.display)).toEqual(['3', '4'])
        expect(r.items.some(i => i.display === 'null')).toBe(false)
    })
})

describe('computePreview — 오류 행과 집계', () => {
    it('성명·주소 모두 비면 err이고 커서에 영향이 없다', () => {
        const r = preview({
            rows: [['', '', ''], ['', 'B', '주소']],
            mapping: MAP, existing: new Set(['10']), nextNumber: 11,
        })
        expect(r.items[0].status).toBe('err')
        expect(r.items[0].reason).toBe('성명·주소 없음')
        expect(r.items[1].display).toBe('11')
    })

    it('stats와 willImport가 맞물린다 (new + 덮어쓰기 dup)', () => {
        const r = preview({
            rows: [['5', 'A', '주소'], ['9', 'B', '주소'], ['', '', '']],
            mapping: MAP, dupPolicy: 'overwrite',
            logs: [{ receptionNumber: '5' }],
        })
        expect(r.stats).toEqual({ total: 3, new: 1, dup: 1, err: 1 })
        expect(r.willImport).toBe(2)
    })

    it('landClass1이 모든 행에 일괄 적용된다', () => {
        const r = preview({ rows: [['A'], ['B']], mapping: { name: 0 }, landClass1: '공익직불제' })
        expect(r.landClass1).toBe('공익직불제')
        expect(r.items.every(i => i.rec.landClass1 === '공익직불제')).toBe(true)
    })
})

describe('computePreview — 수동 번호 중복은 시퀀스 무관·표기 그대로 (SLS-1-222 리뷰 회귀)', () => {
    // 순수화 과정에서 중복 판정 풀을 시퀀스별로 나눴다가, 구분='성토' 행의 수동 번호가
    // 일반 번호와 충돌하는 것을 놓쳐 같은 번호가 두 건 저장되는 회귀를 만들었다.
    // 폼 등록 경로(soil-script.js)는 `logBaseNumber === numToCheck`로 subCategory와
    // 무관하게 비교한다 — 그것이 이 앱의 확립된 규칙이다.
    const collectLit = (logs, cls) => fns().collectLiteralNumbers(logs, cls)
    const MAP_FULL = { receptionNumber: 0, name: 1, lotAddress: 2, subCategory: 3 }

    // 프로덕션과 같은 경로로 넘긴다 — `logs`를 주면 computePreview가 세 풀을 도출한다.
    // 풀을 직접 주입하면 "호출부가 풀을 빠뜨리는" 형태의 회귀를 이 테스트가 놓친다.
    const withPools = (logs, rows, opts = {}) => preview({
        rows, mapping: MAP_FULL, landClass1: '농가의뢰', dupPolicy: opts.dupPolicy || 'skip',
        logs,
        nextNumber: opts.nextNumber ?? 1,
        nextFillNumber: opts.nextFillNumber ?? 1,
    })

    it('성토 행의 F 없는 수동 번호가 기존 일반 번호와 충돌하면 dup', () => {
        const logs = [
            { receptionNumber: '1', subCategory: '논', landClass1: '농가의뢰' },
            { receptionNumber: '2', subCategory: '논', landClass1: '농가의뢰' },
            { receptionNumber: '3', subCategory: '논', landClass1: '농가의뢰' },
        ]
        const r = withPools(logs, [
            ['1', 'A', '주소', '성토'], ['2', 'B', '주소', '성토'], ['3', 'C', '주소', '성토'],
        ], { nextNumber: 4 })
        expect(r.items.map(i => i.status)).toEqual(['dup', 'dup', 'dup'])
        expect(r.willImport).toBe(0)   // 기본 정책(skip)에서 한 건도 등록되지 않는다
    })

    it('배치 내부에서도 시퀀스를 넘어 충돌을 잡는다', () => {
        const r = withPools([], [['1', 'A', '주소', '논'], ['1', 'B', '주소', '성토']])
        expect(r.items.map(i => i.status)).toEqual(['new', 'dup'])
    })

    it('F 접두 수동 번호도 기존 F 번호와 충돌하면 dup', () => {
        // 구 코드는 일반 풀에서 F 접두를 제외해 이 충돌을 구조적으로 놓쳤다
        const logs = [{ receptionNumber: 'F5', subCategory: '성토', landClass1: '농가의뢰' }]
        const r = withPools(logs, [['F5', 'A', '주소', '성토']], { nextFillNumber: 6 })
        expect(r.items[0].status).toBe('dup')
    })

    it('F5와 5는 표기가 달라 충돌하지 않는다 (과잉수정 방지)', () => {
        const logs = [{ receptionNumber: 'F5', subCategory: '성토', landClass1: '농가의뢰' }]
        const r = withPools(logs, [['5', 'A', '주소', '논']])
        expect(r.items[0].status).toBe('new')
    })

    it('자동부여한 번호와 뒤따르는 수동 번호가 충돌하면 dup', () => {
        const r = withPools([], [['', 'A', '주소', '논'], ['1', 'B', '주소', '논']])
        expect(r.items.map(i => i.status)).toEqual(['new', 'dup'])
    })

    it('성토 자동부여는 여전히 F 시퀀스를 쓴다 (본 수정 유지)', () => {
        const r = withPools([], [['', 'A', '주소', '성토'], ['', 'B', '주소', '성토'], ['', 'C', '주소', '논']])
        expect(r.items.map(i => i.display)).toEqual(['F1', 'F2', '1'])
    })

    it('경지구분 1차 범위를 넘어선 번호는 충돌이 아니다', () => {
        const logs = [{ receptionNumber: '5', subCategory: '논', landClass1: '공익직불제' }]
        const r = withPools(logs, [['5', 'A', '주소', '논']])
        expect(r.items[0].status).toBe('new')
    })
})

describe('collectLiteralNumbers', () => {
    const collectLit = (logs, cls) => fns().collectLiteralNumbers(logs, cls)

    it('표기를 그대로 보존하고 두 시퀀스를 통합한다', () => {
        const logs = [
            { receptionNumber: '5', subCategory: '논', landClass1: '농가의뢰' },
            { receptionNumber: 'F2', subCategory: '성토', landClass1: '농가의뢰' },
            { receptionNumber: '7', subCategory: '성토', landClass1: '농가의뢰' }, // F 없는 성토
        ]
        expect([...collectLit(logs, '농가의뢰')].sort()).toEqual(['5', '7', 'F2'])
    })

    it('서브넘버는 본번으로 접고 경지구분 범위를 지킨다', () => {
        const logs = [
            { receptionNumber: '5-1', landClass1: '농가의뢰' },
            { receptionNumber: '9', landClass1: '공익직불제' },
        ]
        expect([...collectLit(logs, '농가의뢰')]).toEqual(['5'])
    })

    it('landClass1 생략 시 기본값으로 폴백한다 (computeNextNumber와 동일)', () => {
        expect(collectLit([{ receptionNumber: '5' }], undefined).has('5')).toBe(true)
    })

    it('빈 입력·접수번호 없는 레코드', () => {
        expect(collectLit([], '농가의뢰').size).toBe(0)
        expect(collectLit(null, '농가의뢰').size).toBe(0)
        expect(collectLit([{ receptionNumber: '' }, {}], '농가의뢰').size).toBe(0)
    })
})

describe('computePreview — 저장되지 않는 행은 배치 집합에도 남지 않는다 (SLS-1-222 재리뷰 M-2)', () => {
    // 건너뛰는 중복 행의 번호가 배치 집합에 남으면, 뒤따르는 자동부여 행이 그 번호를
    // 피해 가면서 미리보기가 실제 저장 번호보다 앞서 나간다 (미리보기 ≠ 저장).
    const MAP_FULL = { receptionNumber: 0, name: 1, lotAddress: 2, subCategory: 3 }

    it('건너뛴 성토 중복 뒤의 자동부여가 매니저와 같은 번호를 보여준다', () => {
        // 대장: F1(성토) · 2(일반). 배치: 성토 수동 '2'(일반 2와 표기 충돌 → skip) + 성토 자동
        const r = preview({
            rows: [['2', 'A', '주소', '성토'], ['', 'B', '주소', '성토']],
            mapping: MAP_FULL, landClass1: '농가의뢰', dupPolicy: 'skip',
            logs: [
                { receptionNumber: 'F1', subCategory: '성토', landClass1: '농가의뢰' },
                { receptionNumber: '2', subCategory: '논', landClass1: '농가의뢰' },
            ],
            nextNumber: 3, nextFillNumber: 2,
        })
        expect(r.items[0].status).toBe('dup')
        expect(r.items[0].skip).toBe(true)
        // 행1이 저장되지 않으므로 매니저는 F2를 부여한다 (수정 전에는 F3을 보여줬다)
        expect(r.items[1].display).toBe('F2')
    })

    it('덮어쓰기 정책이면 저장되므로 배치 집합에 남는다', () => {
        const r = preview({
            rows: [['2', 'A', '주소', '논'], ['', 'B', '주소', '논']],
            mapping: MAP_FULL, landClass1: '농가의뢰', dupPolicy: 'overwrite',
            logs: [{ receptionNumber: '2', subCategory: '논', landClass1: '농가의뢰' }],
            nextNumber: 3,
        })
        expect(r.items[0].skip).toBe(false)
        expect(r.items[1].display).toBe('3')
    })

    it('logs가 배열이 아니면 경고하되 죽지 않는다', () => {
        const r = preview({
            rows: [['5', 'A', '주소', '논']], mapping: MAP_FULL,
            logs: { not: 'an array' }, nextNumber: 1,
        })
        expect(r).not.toBeNull()
        expect(r.items[0].status).toBe('new')
    })
})

describe('collectExistingNumbers — 기본 경지구분 폴백 (computeNextNumber와 대칭)', () => {
    it('landClass1 생략 시 기본값으로 폴백한다', () => {
        expect(collect([{ receptionNumber: '5' }], undefined).has('5')).toBe(true)
        expect(collect([{ receptionNumber: 'F5', subCategory: '성토' }], undefined, { fill: true }).has('5')).toBe(true)
    })
})

