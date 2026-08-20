import { describe, it, expect, beforeAll } from 'vitest'

// reception-number.js를 import → window.ReceptionNumber 노출
let RN
beforeAll(async () => {
    await import('../../src/soil/reception-number.js')
    RN = window.ReceptionNumber
})

const log = (receptionNumber, landClass1, subCategory) => ({ receptionNumber, landClass1, subCategory })

describe('computeNextNumber — 일반(성토 아님) 채번', () => {
    const next = (logs, target, opts) => RN.computeNextNumber(logs, target, opts)

    it('빈 배열이면 1', () => {
        expect(next([], '농가의뢰')).toBe(1)
        expect(next(null, '농가의뢰')).toBe(1)
        expect(next(undefined, '농가의뢰')).toBe(1)
    })

    it('같은 경지구분 내 max+1', () => {
        const logs = [log('1', '농가의뢰'), log('3', '농가의뢰'), log('2', '농가의뢰')]
        expect(next(logs, '농가의뢰')).toBe(4)
    })

    it('경지구분 1차별로 독립 채번', () => {
        const logs = [log('5', '개량제'), log('2', '농가의뢰'), log('1', '개량제')]
        expect(next(logs, '농가의뢰')).toBe(3)  // 농가의뢰 max=2 → 3
        expect(next(logs, '개량제')).toBe(6)    // 개량제 max=5 → 6
        expect(next(logs, '직불')).toBe(1)      // 없음 → 1
    })

    it('landClass1 누락 로그는 defaultClass(농가의뢰)로 간주', () => {
        const logs = [log('2', undefined), log('4', null)]
        expect(next(logs, '농가의뢰')).toBe(5)
    })

    it('가지번호(12-3)는 본번(12)만 인식', () => {
        const logs = [log('5-2', '농가의뢰'), log('5-3', '농가의뢰')]
        expect(next(logs, '농가의뢰')).toBe(6)
    })

    it('성토(F) 번호는 일반 채번에서 제외', () => {
        const logs = [log('1', '농가의뢰'), log('F3', '농가의뢰', '성토')]
        expect(next(logs, '농가의뢰')).toBe(2)  // F3 무시 → max=1 → 2
    })

    it('receptionNumber 없는 로그는 무시', () => {
        const logs = [log('', '농가의뢰'), log(null, '농가의뢰'), log('3', '농가의뢰')]
        expect(next(logs, '농가의뢰')).toBe(4)
    })

    it('비숫자 본번은 무시', () => {
        const logs = [log('abc', '농가의뢰')]
        expect(next(logs, '농가의뢰')).toBe(1)
    })

    it('안전 정수 범위를 넘는 본번은 무시한다 (Infinity 오염 방지)', () => {
        // parseInt('1000…0')은 NaN이 아니라 Infinity를 돌려준다. isNaN만 보면
        // maxNumber가 Infinity가 되어 다음 접수번호가 'Infinity'로 저장되고,
        // 그 레코드가 대장에 남아 이후 채번을 계속 오염시킨다 (SLS-1-223 재리뷰 2).
        const huge = '1' + '0'.repeat(400)
        expect(parseInt(huge, 10)).toBe(Infinity)   // 전제 확인
        expect(next([log(huge, '농가의뢰'), log('3', '농가의뢰')], '농가의뢰')).toBe(4)

        // 2^53 경계 위쪽도 마찬가지 (정밀도를 잃어 엉뚱한 번호가 된다)
        expect(next([log('9007199254740993', '농가의뢰')], '농가의뢰')).toBe(1)

        // 성토 시퀀스도 같아야 한다 — 'FInfinity'가 저장되면 F 풀이 통째로 망가진다
        const fillNext = (logs) => RN.computeNextNumber(logs, '농가의뢰', { fill: true })
        expect(fillNext([log('F' + huge, '농가의뢰', '성토'), log('F2', '농가의뢰', '성토')])).toBe(3)
    })

    it('targetClass 미지정 시 defaultClass 기준', () => {
        const logs = [log('7', '농가의뢰')]
        expect(next(logs)).toBe(8)  // target 생략 → 농가의뢰
    })

    it('opts.defaultClass 지정 시 누락 로그를 그 분류로 간주', () => {
        const logs = [log('3', undefined)]
        expect(next(logs, '개량제', { defaultClass: '개량제' })).toBe(4)
    })
})

describe('computeNextNumber — 성토(F) 채번', () => {
    const nextFill = (logs, target) => RN.computeNextNumber(logs, target, { fill: true })

    it('성토만 집계하여 max+1 (F 접두 제거 후 숫자)', () => {
        const logs = [log('F2', '농가의뢰', '성토'), log('F5', '농가의뢰', '성토'), log('3', '농가의뢰')]
        expect(nextFill(logs, '농가의뢰')).toBe(6)  // 성토 max=5 → 6 (일반 3 무시)
    })

    it('성토 없으면 1', () => {
        const logs = [log('3', '농가의뢰')]
        expect(nextFill(logs, '농가의뢰')).toBe(1)
    })

    it('성토도 경지구분 1차별 독립', () => {
        const logs = [log('F4', '개량제', '성토'), log('F1', '농가의뢰', '성토')]
        expect(nextFill(logs, '농가의뢰')).toBe(2)
        expect(nextFill(logs, '개량제')).toBe(5)
    })

    it('fill + defaultClass 조합: 누락 로그를 커스텀 기본분류로 간주', () => {
        const logs = [log('F3', undefined, '성토')] // landClass1 누락 성토
        expect(RN.computeNextNumber(logs, '개량제', { fill: true, defaultClass: '개량제' })).toBe(4)
        // 기본분류가 다르면 매칭 안 됨 → 1
        expect(RN.computeNextNumber(logs, '개량제', { fill: true })).toBe(1)
    })
})

// ============================================================
// 표기 기준 네임스페이스 (SLS-1-223)
// ============================================================

describe('computeNextNumber — 정상 데이터에서 구 규칙과 동일 (속성 테스트)', () => {
    // 이 변경의 안전성 근거: 불변식(F 접두 ⟺ 구분='성토')이 지켜지는 레코드에서는
    // 표기 기준과 구분 기준이 **같은 결과**를 낸다. 건강한 대장에서는 no-op이다.
    // 구 구현을 여기 복사해 대조한다 — 구현이 바뀌면 이 테스트가 알려준다.
    const DEF = '농가의뢰'
    function computeNextNumberOld(logs, targetClass, opts) {
        const o = opts || {}
        const fill = !!o.fill
        const def = o.defaultClass || DEF
        const target = targetClass || def
        let maxNumber = 0
        for (const log of (Array.isArray(logs) ? logs : [])) {
            if (!log || !log.receptionNumber) continue
            const isFill = log.subCategory === '성토'
            if (fill !== isFill) continue
            if ((log.landClass1 || def) !== target) continue
            const baseNumber = String(log.receptionNumber).split('-')[0]
            if (!fill && baseNumber.startsWith('F')) continue
            const numStr = fill ? baseNumber.replace('F', '') : baseNumber
            const num = parseInt(numStr, 10)
            if (!isNaN(num) && num > maxNumber) maxNumber = num
        }
        return maxNumber + 1
    }

    const CLASSES = ['농가의뢰', '공익직불제', '대표필지']
    const CATS = ['논', '밭', '과수', '시설']

    /** 불변식을 지키는 대장을 만든다 — 성토면 F 접두, 아니면 평번호 */
    function makeCleanLedger(rand, n) {
        const logs = []
        for (let i = 0; i < n; i++) {
            const fill = rand() < 0.4
            const num = 1 + Math.floor(rand() * 40)
            const sub = rand() < 0.15 ? (1 + Math.floor(rand() * 3)) : 0
            const asNumber = !fill && !sub && rand() < 0.15   // 숫자형 receptionNumber
            const rn = (fill ? `F${num}` : String(num)) + (sub ? `-${sub}` : '')
            const rec = {
                receptionNumber: asNumber ? num : rn,
                subCategory: fill ? '성토' : CATS[Math.floor(rand() * CATS.length)],
            }
            // landClass1 누락·빈 문자열도 섞는다 (|| def 폴백 경로)
            const clsPick = rand()
            if (clsPick < 0.1) { /* 누락 */ }
            else if (clsPick < 0.15) rec.landClass1 = ''
            else rec.landClass1 = CLASSES[Math.floor(rand() * CLASSES.length)]
            logs.push(rec)
        }
        return logs
    }

    /** 결정적 의사난수 (시드 고정 — 실패를 재현할 수 있어야 한다) */
    function makeRand(seed) {
        let s = seed
        return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
    }

    it('불변식을 지키는 임의 대장 500개에서 구/신 결과가 항상 같다', () => {
        const mismatches = []
        for (let seed = 1; seed <= 500; seed++) {
            const rand = makeRand(seed)
            const logs = makeCleanLedger(rand, 1 + Math.floor(rand() * 12))
            for (const cls of CLASSES) {
                for (const fill of [false, true]) {
                    const oldV = computeNextNumberOld(logs, cls, { fill })
                    const newV = RN.computeNextNumber(logs, cls, { fill })
                    if (oldV !== newV) mismatches.push({ seed, cls, fill, oldV, newV })
                }
            }
        }
        expect(mismatches.slice(0, 5), `불일치 ${mismatches.length}건`).toEqual([])
    })

    it('불변식이 깨진 레코드에서만 달라진다', () => {
        // 구분은 성토인데 표기가 일반 → 구 규칙은 어느 풀에도 안 넣어 '3'을 재발급했다
        const bad = [{ receptionNumber: '3', subCategory: '성토', landClass1: '농가의뢰' }]
        expect(computeNextNumberOld(bad, '농가의뢰')).toBe(1)   // 구: 일반 다음이 1 → '3'과 충돌 위험
        expect(RN.computeNextNumber(bad, '농가의뢰')).toBe(4)      // 신: 표기가 일반이므로 4
        expect(computeNextNumberOld(bad, '농가의뢰', { fill: true })).toBe(4) // 구: 성토 풀에 3
        expect(RN.computeNextNumber(bad, '농가의뢰', { fill: true })).toBe(1)    // 신: F 표기 없음
    })

    it('표기가 성토인데 구분이 아닌 레코드도 표기대로 분류된다', () => {
        const bad = [{ receptionNumber: 'F9', subCategory: '논', landClass1: '농가의뢰' }]
        expect(RN.computeNextNumber(bad, '농가의뢰', { fill: true })).toBe(10)
        expect(RN.computeNextNumber(bad, '농가의뢰')).toBe(1)
    })

    it('소문자 f는 일반 표기다 — 판별자를 나머지 4곳과 맞춘다', () => {
        // _parseReceptionNumber·reception-group·정렬·importer가 모두 정확한 'F'로
        // 판단한다. 여기서만 관대하면 판별자가 또 갈린다 (리뷰 지적).
        const logs = [{ receptionNumber: 'f5', subCategory: '성토', landClass1: '농가의뢰' }]
        expect(RN.computeNextNumber(logs, '농가의뢰', { fill: true })).toBe(1)
        // 'f5'는 일반 풀에 들어가지만 parseInt('f5')=NaN이라 max에 기여하지 않는다
        expect(RN.computeNextNumber(logs, '농가의뢰')).toBe(1)
        // 점검이 이 레코드를 놓치지 않는다
        expect(RN.auditReceptionNumbers(logs).malformed).toHaveLength(1)
    })
})

describe('namespaceViolation', () => {
    const v = (base, isFill) => window.ReceptionNumber.namespaceViolation(base, isFill)

    it('불변식을 지키면 null', () => {
        expect(v('5', false)).toBeNull()
        expect(v('F5', true)).toBeNull()
    })

    it('소문자 f는 일반 표기이므로 구분이 성토면 위반이다', () => {
        // 판별자를 나머지 4곳(정확한 'F')과 맞춘 결과
        expect(v('f5', true)).toContain('F로 시작하지 않음')
        expect(v('f5', false)).toBeNull()
    })

    it('어긋나면 방향별 사유를 돌려준다', () => {
        expect(v('5', true)).toContain('F로 시작하지 않음')
        expect(v('F5', false)).toContain('구분이 성토가 아님')
    })
})

describe('auditReceptionNumbers', () => {
    const audit = (logs) => window.ReceptionNumber.auditReceptionNumbers(logs)

    it('정상 대장에서는 위반·중복 0건', () => {
        const r = audit([
            { id: 'a', receptionNumber: '1', subCategory: '논', landClass1: '농가의뢰' },
            { id: 'b', receptionNumber: 'F1', subCategory: '성토', landClass1: '농가의뢰' },
            { id: 'c', receptionNumber: '1', subCategory: '논', landClass1: '공익직불제' },
        ])
        expect(r.violations).toEqual([])
        expect(r.duplicates).toEqual([])
    })

    it('양방향 위반을 찾는다', () => {
        const r = audit([
            { id: 'a', receptionNumber: '3', subCategory: '성토', landClass1: '농가의뢰' },
            { id: 'b', receptionNumber: 'F9', subCategory: '논', landClass1: '농가의뢰' },
        ])
        expect(r.violations.map(x => x.id).sort()).toEqual(['a', 'b'])
        expect(r.violations.find(x => x.id === 'a').reason).toContain('F로 시작하지 않음')
        expect(r.violations.find(x => x.id === 'b').reason).toContain('구분이 성토가 아님')
    })

    it('정상 서브넘버는 중복이 아니다 (한 필지 다작물 — 리뷰 오탐 정정)', () => {
        // 작물 2개 필지는 '12', '12-1'을 정상 발급한다. 본번으로 묶으면 이런
        // 건강한 레코드가 전부 중복으로 오탐돼 도구가 쓸모없어진다.
        const r = audit([
            { id: 'a', receptionNumber: '12', name: '홍길동', subCategory: '논', landClass1: '농가의뢰' },
            { id: 'b', receptionNumber: '12-1', name: '홍길동', subCategory: '논', landClass1: '농가의뢰' },
            { id: 'c', receptionNumber: 'F7', name: '김철수', subCategory: '성토', landClass1: '농가의뢰' },
            { id: 'd', receptionNumber: 'F7-1', name: '김철수', subCategory: '성토', landClass1: '농가의뢰' },
        ])
        expect(r.duplicates).toEqual([])
        expect(r.violations).toEqual([])
    })

    it('표기가 완전히 같을 때만 중복으로 묶는다', () => {
        const r = audit([
            { id: 'a', receptionNumber: '5', subCategory: '논', landClass1: '농가의뢰' },
            { id: 'b', receptionNumber: '5', subCategory: '논', landClass1: '농가의뢰' },
            { id: 'c', receptionNumber: '5', subCategory: '논', landClass1: '공익직불제' },
        ])
        expect(r.duplicates).toHaveLength(1)
        expect(r.duplicates[0].landClass1).toBe('농가의뢰')
        expect(r.duplicates[0].count).toBe(2)
    })

    it('번호를 읽을 수 없는 레코드는 malformed로 분류한다', () => {
        const r = audit([
            { id: 'a', receptionNumber: '-1', landClass1: '농가의뢰' },
            { id: 'b', receptionNumber: '  ', landClass1: '농가의뢰' },
            { id: 'c', receptionNumber: 'abc', landClass1: '농가의뢰' },
        ])
        expect(r.malformed).toHaveLength(3)
        expect(r.duplicates).toEqual([])   // 노이즈를 중복에 섞지 않는다
    })

    it('안전 정수 범위를 넘는 접수번호도 malformed로 드러난다', () => {
        // 채번(computeNextNumber)이 무시하는 값은 점검에서도 보여야 한다.
        // 한쪽만 거르면 사용자는 화면에서 이상을 못 보는데 채번만 조용히 달라진다.
        const r = audit([
            { id: 'a', receptionNumber: '1' + '0'.repeat(400), landClass1: '농가의뢰' },
            { id: 'b', receptionNumber: '9007199254740993', landClass1: '농가의뢰' },
        ])
        expect(r.malformed).toHaveLength(2)
        expect(r.malformed[0].reason).toBe('접수번호가 다룰 수 있는 범위를 벗어남')
        expect(r.duplicates).toEqual([])
    })

    it('F5와 5는 서로 다른 표기라 중복이 아니다', () => {
        const r = audit([
            { id: 'a', receptionNumber: '5', subCategory: '논', landClass1: '농가의뢰' },
            { id: 'b', receptionNumber: 'F5', subCategory: '성토', landClass1: '농가의뢰' },
        ])
        expect(r.duplicates).toEqual([])
    })

    it('빈 입력·접수번호 없는 레코드는 건너뛴다', () => {
        const empty = { violations: [], duplicates: [], malformed: [] }
        expect(audit([])).toEqual(empty)
        expect(audit(null)).toEqual(empty)
        expect(audit([{ id: 'x' }, { id: 'y', receptionNumber: '' }])).toEqual(empty)
    })
})
