/**
 * 퇴·액비 검정결과 저장소 (SLS-1-204)
 *
 * 퇴비 접수 페이지와 검정결과 페이지가 **같은 데이터를 보도록** 하는 단일 진실원.
 * 두 화면이 각자 localStorage를 읽고 쓰면 어느 한쪽이 어긋나는 순간 데이터가 갈라진다.
 *
 * 현재 소비처는 src/compost/ 하나뿐이다. 검정결과 페이지(src/compost-analysis/)는
 * SLS-1-204 P1~P3에서 만들 예정이며 **아직 존재하지 않는다** — 이 모듈은 그 선행 투자다.
 *
 * ⚠️ Firestore 동기화 없음 (SLS-1-204 사용자 결정)
 *   퇴비 검정결과는 localStorage에만 저장한다. 다른 PC로 옮길 때는 설정 화면의
 *   전체 내보내기를 쓴다 — settings-script.js의 extraKeys에 compostTestResults가
 *   이미 등록되어 있어 백업·연도별 삭제 양쪽에서 함께 처리된다.
 *
 * 연도를 소유하지 않는다 — 호출자가 매번 넘긴다. 모듈이 연도를 들고 있으면
 * 화면이 연도를 바꿨을 때 어느 쪽이 진짜인지 모호해진다.
 */
(function () {
    'use strict';

    const key = (year) => `compostTestResults_${year}`;

    /**
     * @param {string|number} year
     * @returns {Object} { [logId]: { moisture, maturity, judgment, ... } } — 없으면 {}
     */
    function load(year) {
        try {
            const data = localStorage.getItem(key(year));
            if (!data) return {};
            return JSON.parse(data) || {};
        } catch (e) {
            (window.logger?.error || console.error)('퇴·액비 검사 결과 로드 실패:', e);
            return {};
        }
    }

    /**
     * @param {string|number} year
     * @param {Object} results
     * @returns {boolean} 저장 성공 여부 — quota 초과 시 false (SLS-1-198 계약과 동일하게
     *          호출부가 후속 경로를 계속 진행할 수 있도록 throw하지 않는다)
     */
    function save(year, results) {
        try {
            localStorage.setItem(key(year), JSON.stringify(results));
            return true;
        } catch (e) {
            (window.logger?.error || console.error)('퇴·액비 검사 결과 저장 실패:', e);
            return false;
        }
    }

    window.CompostResultsStore = { load, save, key };
})();
