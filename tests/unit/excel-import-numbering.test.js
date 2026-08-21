import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 공용 엑셀 가져오기의 접수번호 자동 채번 (SLS-1-270)
 *
 * E2E(compost-import-flow.spec.js)는 compost를 통해서만 이 코드에 닿는데,
 * `autoNumberExtract` / `autoNumberFilter`는 **현재 어떤 소비자도 설정하지 않는다.**
 * 그 분기와 경계값은 E2E로 도달할 수 없어 여기서 직접 세워 호출한다.
 *
 * ⚠️ 이 모듈은 `window.ExcelImportManager`로 노출되는 브라우저 전역 스크립트다.
 *    번들이 아니라 원본을 읽어 가짜 window에 실어 클래스를 꺼낸다.
 */
const SRC = fs.readFileSync(
    path.join(__dirname, '../../src/shared/excel-import-manager.js'), 'utf8')

const fakeWindow = {}
new Function('window', SRC)(fakeWindow)
const ExcelImportManager = fakeWindow.ExcelImportManager

/** 채번만 떼어 호출한다 — init()은 DOM을 요구하므로 부르지 않는다 */
function assign(parsed, { existing = [], extract, filter } = {}) {
    const mgr = new ExcelImportManager({
        getExistingLogs: () => existing,
        autoNumberExtract: extract,
        autoNumberFilter: filter,
    })
    mgr._parsedLogs = parsed
    const warnings = []
    mgr._autoAssignReceptionNumbers(warnings)
    return { numbers: parsed.map((l) => l.receptionNumber), warnings }
}

const rows = (...nums) => nums.map((n) => ({ receptionNumber: n }))

describe('접수번호 자동 채번 (SLS-1-270)', () => {
    it('1. 전 행이 비어 있으면 기존 최대값 다음부터 연번을 매긴다', () => {
        const r = assign(rows('', '', ''), { existing: rows('98', '100', '99') })
        expect(r.numbers).toEqual(['101', '102', '103'])
    })

    it('2. 전 행에 번호가 있으면 하나도 건드리지 않는다', () => {
        const r = assign(rows('7', '8'), { existing: rows('100') })
        expect(r.numbers).toEqual(['7', '8'])
    })

    it('3. 일부만 비어 있으면 빈 칸만 채우고 명시 번호는 보존한다', () => {
        // 이 티켓의 본체. 예전에는 `.some()`이 참이라 전부 건너뛰어 ''가 남았다.
        const r = assign(rows('201', '', ''), { existing: rows('100') })
        expect(r.numbers).toEqual(['201', '202', '203'])
    })

    it('4. 자동 채번은 배치 안의 명시 번호보다 위에서 시작한다 (충돌 불가)', () => {
        // 기존 최대(100)보다 배치 명시 번호(500)가 크면 그 위에서 이어야 겹치지 않는다
        const r = assign(rows('', '500', ''), { existing: rows('100') })
        expect(r.numbers).toEqual(['501', '500', '502'])
        expect(new Set(r.numbers).size).toBe(3)
    })

    it('5. 공백만 있는 번호는 빈 칸으로 본다', () => {
        const r = assign(rows('   ', '5'), { existing: [] })
        expect(r.numbers).toEqual(['6', '5'])
    })

    it('6. 자릿수가 지나치게 큰 기존 번호는 최대값 계산에서 제외한다', () => {
        // parseInt('4'.repeat(400)) === Infinity → 예전에는 maxNum이 Infinity가 되어
        // 'Infinity'가 저장되고 이후 채번을 계속 오염시켰다 (soil은 SLS-1-223에서 수정)
        const huge = '4'.repeat(400)
        expect(parseInt(huge, 10)).toBe(Infinity)
        const r = assign(rows(''), { existing: rows(huge, '10') })
        expect(r.numbers).toEqual(['11'])
    })

    it('7. extractFn이 숫자 문자열을 돌려줘도 예전처럼 동작한다', () => {
        // !isNaN('5')는 참이었다 — Number.isSafeInteger('5')는 거짓이라 그냥 바꾸면 호환이 깨진다
        const r = assign(rows(''), {
            existing: rows('F30'),
            extract: (log) => String(log.receptionNumber).replace(/^F/, ''),
        })
        expect(r.numbers).toEqual(['31'])
    })

    it('8. filterFn으로 갈린 다른 시퀀스는 최대값에 끼어들지 않는다', () => {
        // 성토(F)와 일반을 별도 시퀀스로 두는 용도. 일반만 세어야 한다.
        const existing = [
            { receptionNumber: '900', kind: 'fill' },
            { receptionNumber: '5', kind: 'normal' },
        ]
        const parsed = [
            { receptionNumber: '', kind: 'normal' },
            { receptionNumber: '800', kind: 'fill' },
        ]
        const r = assign(parsed, { existing, filter: (log) => log.kind === 'normal' })
        // 900·800(다른 시퀀스)은 무시하고 5 다음인 6이어야 한다
        expect(r.numbers).toEqual(['6', '800'])
    })

    it('8-b. 다른 시퀀스의 빈 행에는 손대지 않는다 (한 번에 한 시퀀스)', () => {
        // 술어 하나로는 시퀀스를 열거할 수 없다. 범위 밖 빈 행에 이 시퀀스의 번호를
        // 매기면 남의 번호를 쓰는 것이 된다 → 비워 두고 _handleNext 가드가 막는다.
        const parsed = [
            { receptionNumber: '', kind: 'normal' },
            { receptionNumber: '', kind: 'fill' },
        ]
        const r = assign(parsed, { existing: rows(), filter: (log) => log.kind === 'normal' })
        expect(r.numbers).toEqual(['1', ''])
    })

    it('9. 안전 범위를 넘으면 조용히 자르지 않고 경고를 남긴다', () => {
        const r = assign(rows('', ''), { existing: rows(String(Number.MAX_SAFE_INTEGER)) })
        expect(r.numbers).toEqual(['', ''])
        expect(r.warnings).toHaveLength(1)
        expect(r.warnings[0]).toContain('2건')
    })

    it('9-b. 경계 직전이면 채울 수 있는 만큼 채우고 나머지만 경고한다', () => {
        // MAX_SAFE_INTEGER - 1이 최대면 첫 행은 MAX_SAFE_INTEGER로 채워지고 둘째만 못 채운다
        const r = assign(rows('', ''), { existing: rows(String(Number.MAX_SAFE_INTEGER - 1)) })
        expect(r.numbers).toEqual([String(Number.MAX_SAFE_INTEGER), ''])
        expect(r.warnings).toHaveLength(1)
        expect(r.warnings[0]).toContain('1건')
    })

    it('9-c. extractFn이 안전하지 않은 정수를 돌려주면 최대값에서 제외한다', () => {
        const r = assign(rows(''), {
            existing: rows('a', 'b'),
            extract: (log) => (log.receptionNumber === 'a' ? Number.MAX_SAFE_INTEGER + 1 : 7),
        })
        expect(r.numbers).toEqual(['8'])
    })

    it('10. 기존 로그가 없어도 1부터 시작한다', () => {
        const r = assign(rows('', ''), { existing: [] })
        expect(r.numbers).toEqual(['1', '2'])
    })
})
