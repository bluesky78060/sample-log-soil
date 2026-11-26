import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// 런타임과 같은 쓰기 라이브러리여야 포장 구조가 같다 (커뮤니티 xlsx 와 출력이 다를 수 있다).
import * as XLSXStyle from 'xlsx-js-style'
import JSZip from 'jszip'
import { finalizeXlsxPackage } from '../../src/shared/xlsx-package.js'

// 흙토람 업로드 거부 방지 포장 보정 (SLS-1-300).
// 시험 이력과 미확인 사항은 docs-internal/ai-pm/SLS-1-300/SLS-1-300-direction.md.
// 이 테스트는 ZIP 구조까지만 증명한다 — 흙토람이 받아들이는지는 증명하지 못한다.

const XLSX = XLSXStyle.default || XLSXStyle
const CT = '[Content_Types].xml'
const BIN = '<Default Extension="bin" ContentType="application/vnd.ms-excel.sheet.binary.macroEnabled.main"/>'
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

/** 프로덕션과 같은 write 옵션의 실제 SheetJS 출력 (병합 포함 — 퇴비 주입이 mergeCells 를 요구한다) */
const sheetJsOutput = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['a', 'b'], ['1', '2'], ['3', '4'], ['5', '6'], ['7', '8']])
    ws['!merges'] = [XLSX.utils.decode_range('A1:B1')]
    XLSX.utils.book_append_sheet(wb, ws, '검정정보일괄입력')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}
const names = async (buf) => Object.keys((await JSZip.loadAsync(buf)).files)
const ctOf = async (buf) => (await JSZip.loadAsync(buf)).file(CT).async('string')
const sheetOf = async (buf) => (await JSZip.loadAsync(buf)).file('xl/worksheets/sheet1.xml').async('string')

/** HeuktoramManager 는 export 되지 않아 소스에서 메서드 본문을 꺼내 실행한다. */
const SOIL_SRC = read('src/heuktoram/heuktoram-script.js')
const soilMethod = (name, isAsync = false) => {
    const m = SOIL_SRC.match(new RegExp(`\\n    ${isAsync ? 'async ' : ''}${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n    \\}\\n`))
    expect(m, `${name} 본문을 찾지 못했다`).toBeTruthy()
    const Fn = isAsync ? Object.getPrototypeOf(async function () {}).constructor : Function
    return new Fn('window', ...m[1].split(',').map(s => s.trim()).filter(Boolean), m[2])
}
let soil
beforeAll(() => {
    const win = { JSZip }
    soil = {}
    const bind = (name, isAsync) => { const f = soilMethod(name, isAsync); return (...a) => f.call(soil, win, ...a) }
    soil.injectDataValidations = bind('injectDataValidations', true)
    soil.buildDataValidationsXml = bind('buildDataValidationsXml')
    soil.buildDataValidations = bind('buildDataValidations')
})

describe('보정 결과', () => {
    it('전제: SheetJS 원본은 xlsb bin 선언을 갖고 CT 가 첫 엔트리가 아니다 (깨지면 수정 필요성 재확인)', async () => {
        const src = sheetJsOutput()
        expect(await ctOf(src)).toContain(BIN)
        expect((await names(src))[0]).not.toBe(CT)
    })

    it('CT 가 ZIP 첫 엔트리이고 xlsb bin 선언이 없다', async () => {
        const out = await finalizeXlsxPackage(sheetJsOutput(), JSZip)
        expect((await names(out))[0]).toBe(CT)
        expect(await ctOf(out)).not.toContain('binary.macroEnabled.main')
    })

    it('그 한 줄만 지운다 — CT 의 나머지와 다른 엔트리 payload·상대 순서는 그대로다', async () => {
        const src = sheetJsOutput()
        const out = await finalizeXlsxPackage(src, JSZip)
        expect(await ctOf(out)).toBe((await ctOf(src)).replace(BIN, ''))
        const a = await JSZip.loadAsync(src), b = await JSZip.loadAsync(out)
        const rest = Object.keys(a.files).filter(n => n !== CT)
        expect(Object.keys(b.files).slice(1)).toEqual(rest)
        for (const n of rest) {
            if (a.files[n].dir) continue
            const [x, y] = [await a.file(n).async('uint8array'), await b.file(n).async('uint8array')]
            expect(Buffer.from(y).equals(Buffer.from(x)), n).toBe(true)
        }
    })

    it('선언이 원래 없어도(SheetJS 가 바뀐 경우) 던지지 않고 순서만 맞춘다', async () => {
        const z = await JSZip.loadAsync(sheetJsOutput())
        z.file(CT, (await z.file(CT).async('string')).replace(BIN, ''))
        const out = await finalizeXlsxPackage(await z.generateAsync({ type: 'arraybuffer' }), JSZip)
        expect((await names(out))[0]).toBe(CT)
    })

    it('CT 가 없으면 던진다', async () => {
        const z = await JSZip.loadAsync(sheetJsOutput())
        z.remove(CT)
        await expect(finalizeXlsxPackage(await z.generateAsync({ type: 'arraybuffer' }), JSZip)).rejects.toThrow(CT)
    })

    it('JSZip 이 없으면 조용히 통과하지 않고 던진다', async () => {
        const saved = window.JSZip
        delete window.JSZip
        try {
            await expect(finalizeXlsxPackage(sheetJsOutput())).rejects.toThrow('JSZip')
        } finally {
            if (saved) window.JSZip = saved
        }
    })
})

describe('데이터 검증 주입과의 결합', () => {
    it('토양: 주입된 검증이 보정 뒤에도 남는다', async () => {
        const out = await finalizeXlsxPackage(
            await soil.injectDataValidations(sheetJsOutput(), soil.buildDataValidations(3)), JSZip)
        const sheet = await sheetOf(out)
        expect(sheet).toContain('<dataValidations count="3">')
        expect(sheet).toContain('sqref="F5:F1048576"')
        expect((await names(out))[0]).toBe(CT)
        expect(await ctOf(out)).not.toContain('binary.macroEnabled.main')
    })

    it('토양: 검증 목록이 비어 주입이 원본을 그대로 돌려줘도 보정은 적용된다', async () => {
        const passthrough = await soil.injectDataValidations(sheetJsOutput(), [])
        expect(await ctOf(passthrough)).toContain(BIN)   // early-return 은 재압축하지 않는다
        const out = await finalizeXlsxPackage(passthrough, JSZip)
        expect((await names(out))[0]).toBe(CT)
        expect(await ctOf(out)).not.toContain('binary.macroEnabled.main')
    })
})

describe('재검증 분기 — 두 조건을 따로 깬다', () => {
    // 정상 입력으로는 재검증 throw 에 닿을 수 없다. 두 번째 loadAsync(재검증)에 위조 ZIP 을 돌려주는 JSZip 으로 깬다.
    const finalizeWithForgedCheck = (forgedBuf) => {
        let loads = 0
        const Fake = function () { return new JSZip() }
        Fake.loadAsync = (buf) => JSZip.loadAsync(++loads === 2 ? forgedBuf : buf)
        return finalizeXlsxPackage(sheetJsOutput(), Fake)
    }

    /** CT 위치와 bin 선언 유무를 독립적으로 정한다 — 한 조건이 다른 조건에 가려지지 않게. */
    const forgeZip = async ({ ctFirst, keepBin }) => {
        const src = await JSZip.loadAsync(sheetJsOutput())
        const ct = (await src.file(CT).async('string')).replace(keepBin ? '' : BIN, '')
        const forged = new JSZip()
        if (ctFirst) forged.file(CT, ct, { createFolders: false })
        for (const n of Object.keys(src.files)) {
            if (n !== CT && !src.files[n].dir) forged.file(n, await src.file(n).async('uint8array'), { createFolders: false })
        }
        if (!ctFirst) forged.file(CT, ct, { createFolders: false })
        return forged.generateAsync({ type: 'arraybuffer' })
    }

    it('순서만 어긋남(bin 선언은 없음) → 던진다', async () => {
        const buf = await forgeZip({ ctFirst: false, keepBin: false })
        expect((await names(buf))[0]).not.toBe(CT)
        expect(await ctOf(buf)).not.toContain('binary.macroEnabled.main')
        await expect(finalizeWithForgedCheck(buf)).rejects.toThrow('xlsx 포장 보정 실패')
    })

    it('bin 선언만 남음(CT 는 첫 엔트리) → 던진다', async () => {
        const buf = await forgeZip({ ctFirst: true, keepBin: true })
        expect((await names(buf))[0]).toBe(CT)
        expect(await ctOf(buf)).toContain(BIN)
        await expect(finalizeWithForgedCheck(buf)).rejects.toThrow('xlsx 포장 보정 실패')
    })

    it('둘 다 맞는 위조 입력은 던지지 않는다 — 위 두 테스트가 늘 던지는 목이 아님을 보증', async () => {
        const buf = await forgeZip({ ctFirst: true, keepBin: false })
        await expect(finalizeWithForgedCheck(buf)).resolves.toBeInstanceOf(ArrayBuffer)
    })
})

describe('세 내보내기 경로가 보정을 거친다', () => {
    it('흙토람 토양·공익직불제: 다운로드 버퍼가 보정 결과다', () => {
        for (const fn of ['exportToHeuktoram', 'exportToGongik']) {
            const body = SOIL_SRC.match(new RegExp(`\\n    async ${fn}\\(\\) \\{[\\s\\S]*?\\n    \\}\\n`))?.[0]
            expect(body, `${fn} 본문을 찾지 못했다`).toBeTruthy()
            expect(body, fn).toMatch(/this\.downloadBuffer\(patchedBuffer,/)
            expect(body, `${fn}: patchedBuffer 가 보정 결과여야 한다`)
                .toMatch(/const patchedBuffer = await window\.finalizeXlsxPackage\(\s*await this\.injectDataValidations\(/)
        }
    })

    it('두 페이지 entry 가 보정 모듈을 싣는다', () => {
        for (const p of ['src/heuktoram/heuktoram-entry.js', 'src/compost-analysis/compost-analysis-entry.js']) {
            expect(read(p), p).toMatch(/^import '\.\.\/shared\/xlsx-package\.js';/m)
        }
    })

    describe('퇴비 흙토람: exportFile 을 실제로 실행해 다운로드된 바이트를 본다', () => {
        let E, captured, RealBlob, realCreate, realRevoke
        beforeAll(async () => {
            window.XLSX = XLSX
            window.JSZip = JSZip
            await import('../../src/shared/sanitize.js')
            await import('../../src/shared/address-parser.js')
            await import('../../src/shared/lot-address-parser.js')
            await import('../../src/shared/compost-fields.js')
            await import('../../src/shared/xlsx-package.js')
            await import('../../src/compost-analysis/compost-heuktoram-export.js')
            E = window.CompostHeuktoramExport
            RealBlob = window.Blob
            realCreate = URL.createObjectURL
            realRevoke = URL.revokeObjectURL
        })
        const capture = () => {
            captured = undefined
            window.Blob = function (parts, opts) { captured = parts[0]; return new RealBlob(parts, opts) }
            URL.createObjectURL = () => 'blob:test'
            URL.revokeObjectURL = () => {}
        }
        afterEach(() => {
            window.Blob = RealBlob
            URL.createObjectURL = realCreate
            URL.revokeObjectURL = realRevoke
        })

        const rows = [{ key: 'c1', log: {
            id: 'c1', receptionNumber: '101', date: '2026-07-01', farmName: '시험농장',
            farmAddress: '경상북도 봉화군 봉화읍 문단리 1', farmArea: '2000', farmAreaUnit: 'm2',
            sampleType: '가축분퇴비', animalType: '돼지', purpose: '성분검사',
        } }]

        it('다운로드 파일은 CT 첫 엔트리·bin 선언 없음이고 Q·W 검증이 남는다', async () => {
            capture()
            await E.exportFile(rows, { c1: { testDate: '2026-07-20', maturity: '부숙완료' } }, 't.xlsx')
            expect(captured, 'downloadBuffer 에 도달하지 않았다').toBeTruthy()
            expect((await names(captured))[0]).toBe(CT)
            expect(await ctOf(captured)).not.toContain('binary.macroEnabled.main')
            const sheet = await sheetOf(captured)
            expect(sheet).toContain('Q5:Q1048576')
            expect(sheet).toContain('W5:W1048576')
        })
    })
})
