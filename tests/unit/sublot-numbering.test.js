// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// SLS-1-265: 하위 지번과 추가 작물이 같은 `-1`, `-2` 자리를 두고 부딪히던 것
//
// 🚨 확정된 접수번호 기준 (사용자 확인, 2026-08-20)
//    · 한 농업인이 시료를 여러 점  → 503, 504, 505  (별개 시료)
//    · 한 시료에 지번이 여러 개    → 503, 503-1, 503-2  (하위 지번)
//    · 한 지번에 작물이 여러 개    → 503(주작물), 503-1, 503-2  (추가 작물)
//
//    뒤 두 규칙이 한 필지에서 만나면 번호가 겹친다. 예전 코드는 겹침을 피하려고
//    **하위 지번을 통째로 버렸다** — 경고도 없고 등록은 성공으로 보였다.
//    하위 지번은 접수대장 내보내기와 **흙토람 업로드 파일**에도 행으로 나가므로,
//    사라진 지번은 흙토람에도 안 올라갔다.
//
//    해법은 한 시료 안의 **연속 번호**다. 작물을 먼저 세고 하위 지번이 잇는다.
//      503   본지번 주작물 / 503-1 본지번 추가작물 / 503-2·503-3 하위 지번
//
// ⚠️ 접수번호는 성적서·흙토람으로 나가는 **대외 식별자**다. 화면마다 다르면 안 된다.
//    그래서 목록·내보내기·흙토람이 `subLotDisplayNumber` 하나를 공유한다.
const SRC = readFileSync(join(process.cwd(), 'src', 'soil', 'soil-log-record.js'), 'utf8')

/** 폼 입력을 흉내낸 필지 */
const parcelOf = (cropNames, subLotAddrs) => ({
    lotAddress: '내성리 100',
    isMountain: false,
    subLots: subLotAddrs.map((a) => ({ lotAddress: a, crops: [{ name: '벼', area: '100' }] })),
    crops: cropNames.map((n) => ({ name: n, area: '500' })),
    category: '논', purpose: '일반', note: '',
})

const COMMON = { name: '홍길동', date: '2026-08-20', subCategory: '논' }

describe('하위 지번 번호 (SLS-1-265)', () => {
    let R

    beforeAll(() => {
        new Function(SRC)()          // IIFE — window.SoilLogRecord가 붙는다
        R = window.SoilLogRecord
    })

    /** soil-script.js의 _buildLogsForParcels와 같은 순서로 레코드를 만든다 */
    function buildRecords(parcel, { base = 503, isFill = false } = {}) {
        const valid = parcel.crops.filter((c) => c.name.trim())
        const b = isFill ? `F${base}` : String(base)
        if (valid.length <= 1) {
            return [R.buildSoilLogRecord(parcel, {
                receptionNumber: b, commonData: COMMON, index: 0, totalParcels: 1,
            })]
        }
        return valid.map((crop, ci) => R.buildSoilLogRecord(parcel, {
            receptionNumber: ci === 0 ? b : `${b}-${ci}`,
            commonData: COMMON, index: 0, totalParcels: 1,
            crop, cropIndex: ci, cropSplitCount: valid.length,
        }))
    }

    /** 그 시료가 만들어 내는 모든 접수번호 (레코드 + 하위 지번), 번호순 */
    function allNumbers(records) {
        const out = []
        for (const rec of records) {
            out.push(rec.receptionNumber)
            for (let i = 0; i < (rec.parcels[0].subLots || []).length; i++) {
                out.push(R.subLotDisplayNumber(rec, i))
            }
        }
        return out.sort((x, y) => {
            const a = x.replace(/^F/, '').split('-').map(Number)
            const b = y.replace(/^F/, '').split('-').map(Number)
            for (let i = 0; i < 2; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0)
            return 0
        })
    }

    it.each([
        ['작물1 / 하위0', ['벼'], [], ['503']],
        ['작물1 / 하위2', ['벼'], ['101', '102'], ['503', '503-1', '503-2']],
        ['작물2 / 하위0', ['벼', '콩'], [], ['503', '503-1']],
        ['작물2 / 하위2', ['벼', '콩'], ['101', '102'], ['503', '503-1', '503-2', '503-3']],
        ['작물3 / 하위1', ['벼', '콩', '팥'], ['101'], ['503', '503-1', '503-2', '503-3']],
    ])('%s → 번호가 겹치지 않고 이어진다', (_label, crops, subs, expected) => {
        const nums = allNumbers(buildRecords(parcelOf(crops, subs)))
        expect(nums).toEqual(expected)
        expect(new Set(nums).size, `번호가 겹쳤다: ${nums.join(', ')}`).toBe(nums.length)
    })

    it('입력한 하위 지번이 사라지지 않는다 — 이 티켓의 본론', () => {
        const recs = buildRecords(parcelOf(['벼', '콩'], ['101', '102']))
        const kept = recs.flatMap((r) => (r.parcels[0].subLots || []).map((s) => s.lotAddress))
        expect(kept, '작물이 2개라고 하위 지번을 버렸다').toEqual(['101', '102'])
    })

    it('하위 지번은 주작물 레코드에만 붙는다 — 형제에 붙으면 두 번 나간다', () => {
        const recs = buildRecords(parcelOf(['벼', '콩'], ['101', '102']))
        expect(recs[0].parcels[0].subLots.map((s) => s.lotAddress)).toEqual(['101', '102'])
        expect(recs[1].parcels[0].subLots, '형제 레코드에도 하위 지번이 붙었다').toEqual([])
    })

    it('성토(F 접두)도 그대로 이어진다', () => {
        const nums = allNumbers(buildRecords(parcelOf(['벼', '콩'], ['101', '102']), { isFill: true }))
        expect(nums).toEqual(['F503', 'F503-1', 'F503-2', 'F503-3'])
    })

    it('작물을 2개→1개로 줄이면 하위 지번이 -1부터 다시 매겨진다 (그룹 수정)', () => {
        // 그룹 수정도 같은 경로를 타고 작물 수를 매번 다시 센다.
        // 옛 cropSplitCount가 남으면 번호가 뜬금없이 밀린다.
        const nums = allNumbers(buildRecords(parcelOf(['벼'], ['101', '102'])))
        expect(nums).toEqual(['503', '503-1', '503-2'])
    })

    describe('subLotDisplayNumber — 옛 레코드와 이상한 값', () => {
        it('cropSplitCount가 없으면 예전과 똑같이 -1부터', () => {
            // 이 티켓 이전에 만들어진 레코드가 전부 여기에 해당한다.
            const old = { receptionNumber: '503' }
            expect([0, 1].map((i) => window.SoilLogRecord.subLotDisplayNumber(old, i)))
                .toEqual(['503-1', '503-2'])
        })

        it.each([0, -3, 2.5, 'x', null, undefined, NaN, Infinity])(
            'cropSplitCount=%s 는 1로 본다', (v) => {
                expect(window.SoilLogRecord.subLotDisplayNumber(
                    { receptionNumber: '503', cropSplitCount: v }, 0)).toBe('503-1')
            })

        it('음수 인덱스도 첫 자리로 떨어진다', () => {
            expect(window.SoilLogRecord.subLotDisplayNumber({ receptionNumber: '503' }, -1))
                .toBe('503-1')
        })
    })
})
