import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

// SLS-1-202: 판정은 검사자가 직접 한다 — 자동 판정 제거 회귀 가드
//
// 수정 전 saveCompostAnalysis는 judgment가 비어 있으면 autoJudgeCompost()로 채웠다.
// 사용자가 '미판정'을 고른 것도 의사표시인데 앱이 덮어썼다.
//
// 환경 주의:
// - compost-script.js는 `class ... extends window.BaseSampleManager`이므로
//   BaseSampleManager를 **먼저** import해야 평가 시점에 터지지 않는다.
// - 파일 말미의 인스턴스화는 DOMContentLoaded 콜백이라 jsdom(readyState complete)에서는
//   실행되지 않는다. 클래스는 window.CompostSampleManager로 노출된다.

beforeAll(async () => {
    await import('../../src/shared/BaseSampleManager.js')
    await import('../../src/compost/compost-script.js')
})

/** judgment 라디오 + 검정결과 입력칸을 갖춘 최소 DOM */
function setupDom({ judgment = '', moisture = '', maturity = '' } = {}) {
    document.body.innerHTML = `
        <input type="date" id="caTestDate" value="2026-07-27">
        <input type="radio" name="caJudgment" value="">
        <input type="radio" name="caJudgment" value="pass">
        <input type="radio" name="caJudgment" value="fail">
        <input id="ca_moisture" value="${moisture}">
        <select id="ca_maturity"><option value=""></option><option value="부숙중기">부숙중기</option></select>
        <div id="compostAnalysisModal"></div>
    `
    document.querySelector(`input[name="caJudgment"][value="${judgment}"]`).checked = true
    if (maturity) document.getElementById('ca_maturity').value = maturity
}

function createManager(log) {
    const m = new window.CompostSampleManager()
    m.selectedYear = '2026'
    m.sampleLogs = [log]
    m._caLogId = log.id
    m.log = () => {}
    m.showToast = vi.fn()
    m.saveLogs = vi.fn()
    m.filterAndRenderLogs = vi.fn()
    m.updateRecordCount = vi.fn()
    m.saveAllCompostTestResults = vi.fn()
    m.loadAllCompostTestResults = () => ({})
    return m
}

const compostLog = (over = {}) => ({
    id: 'c1', receptionNumber: '101', name: '홍길동',
    sampleType: '가축분퇴비', animalType: '돼지',
    farmArea: '2000', farmAreaUnit: 'm2',
    ...over
})

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = '' })

describe('자동 판정 제거 — 판정은 검사자가 직접 (SLS-1-202)', () => {
    it('1. 미판정을 고르면 앱이 값을 채워 넣지 않는다 (기준을 전부 만족해도)', () => {
        // 함수율 50(기준 70 이하 만족) + 부숙중기 → 예전이면 자동으로 'pass'가 들어갔다
        setupDom({ judgment: '', moisture: '50', maturity: '부숙중기' })
        const m = createManager(compostLog())

        m.saveCompostAnalysis()

        const saved = m.saveAllCompostTestResults.mock.calls[0][0]['c1']
        expect(saved.judgment).toBe('')
        expect(m.sampleLogs[0].testResult).toBe('')
    })

    // 코드리뷰 MINOR-1: 케이스 1은 기준 충족 픽스처라 '자동 적합' 방향만 막는다.
    // "기준 위반 시에만 fail을 채운다"는 부분 복원은 케이스 1을 통과한다 —
    // 앱이 컴플라이언스 기록에 부적합을 임의로 찍는 더 위험한 방향이다.
    it('1b. 미판정을 고르면 기준을 위반해도 앱이 값을 채우지 않는다', () => {
        setupDom({ judgment: '', moisture: '90', maturity: '' })   // 함수율 90 — 기준 70 이하 위반
        const m = createManager(compostLog())

        m.saveCompostAnalysis()

        const saved = m.saveAllCompostTestResults.mock.calls[0][0]['c1']
        expect(saved.judgment).toBe('')
        expect(m.sampleLogs[0].testResult).toBe('')
    })

    it('2. 기준을 위반해도 검사자가 적합을 고르면 그대로 저장된다', () => {
        // 함수율 90 — 퇴비 기준 70% 이하 위반. 검사자 판단이 앱 계산보다 우선한다.
        setupDom({ judgment: 'pass', moisture: '90', maturity: '부숙중기' })
        const m = createManager(compostLog())

        m.saveCompostAnalysis()

        const saved = m.saveAllCompostTestResults.mock.calls[0][0]['c1']
        expect(saved.judgment).toBe('pass')
        expect(m.sampleLogs[0].testResult).toBe('pass')
    })

    it('3. 기준을 만족해도 검사자가 부적합을 고르면 그대로 저장된다', () => {
        setupDom({ judgment: 'fail', moisture: '50', maturity: '부숙중기' })
        const m = createManager(compostLog())

        m.saveCompostAnalysis()

        const saved = m.saveAllCompostTestResults.mock.calls[0][0]['c1']
        expect(saved.judgment).toBe('fail')
        expect(m.sampleLogs[0].testResult).toBe('fail')
    })

    it('4. 자동 판정 함수 자체가 존재하지 않는다', () => {
        const m = createManager(compostLog())
        expect(m.autoJudgeCompost).toBeUndefined()
    })

    it('5. 항목별 기준 배지는 유지된다 (참고 정보)', () => {
        const m = createManager(compostLog())
        const statusEl = document.createElement('td')
        m._caAreaSqm = 2000
        // 함수율 90 → 기준 70 이하 초과 → ✕
        m.checkCompostFieldStatus({ key: 'moisture', standard: '70 이하' }, '90', statusEl)
        expect(statusEl.textContent).toBe('✕')

        const ok = document.createElement('td')
        m.checkCompostFieldStatus({ key: 'moisture', standard: '70 이하' }, '50', ok)
        expect(ok.textContent).toBe('✓')
    })
})
