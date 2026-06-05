/**
 * 접수번호 그룹핑 순수 로직 (DOM/매니저 비의존 · 단위 테스트 대상)
 *
 * 본필지+하위필지 연동 규칙:
 *  - 접수번호 '503', '503-1', '503-2'는 첫 '-' 앞의 본번 '503'으로 같은 그룹.
 *  - 성토(F접두) 시료는 번호가 같아도 일반 시료와 별개 그룹으로 분리한다.
 *    예: '503'과 'F503'은 base는 같지만 isFill이 달라 다른 그룹.
 *  - 본번이 빈 문자열('')이면 그룹 없음(어떤 그룹과도 매칭되지 않음).
 *
 * SoilSampleManager의 완료 버튼 그룹 연동(_bindTableEvents)과
 * 일괄 완료 대상 계산(_bindBulkActions)이 모두 이 함수에 위임한다(알고리즘 단일화).
 *
 * @global window.ReceptionGroup
 */
(function () {
    'use strict';

    /**
     * 접수번호를 그룹 키로 파싱한다.
     * @param {string} receptionNumber - 접수번호 (예: '503-1', 'F503')
     * @returns {{base: string, isFill: boolean}} base=본번(F제거·'-' 앞), isFill=성토 여부
     */
    function parseReceptionGroup(receptionNumber) {
        const rec = receptionNumber || '';
        return { base: rec.replace(/^F/, '').split('-')[0], isFill: rec.startsWith('F') };
    }

    /**
     * 두 접수번호가 같은 그룹(같은 본번 + 같은 성토 여부)인지.
     * base가 빈 문자열이면 항상 false.
     * @param {string} recA
     * @param {string} recB
     * @returns {boolean}
     */
    function isSameGroup(recA, recB) {
        const a = parseReceptionGroup(recA);
        const b = parseReceptionGroup(recB);
        return a.base !== '' && a.base === b.base && a.isFill === b.isFill;
    }

    /**
     * 단일 접수번호와 같은 그룹인 로그 전체를 반환한다 (테이블 완료 버튼용).
     * @param {Array<{receptionNumber?: string}>} logs
     * @param {string} receptionNumber
     * @returns {Array} 같은 그룹 로그 배열 (base가 비면 빈 배열)
     */
    function findRelatedLogs(logs, receptionNumber) {
        const target = parseReceptionGroup(receptionNumber);
        if (target.base === '') return [];
        return (logs || []).filter(l => {
            const g = parseReceptionGroup(l.receptionNumber || '');
            return g.base === target.base && g.isFill === target.isFill;
        });
    }

    /**
     * 선택된 id들의 그룹 + 연관 로그까지 포함한 대상 id 집합을 반환한다 (일괄 완료용).
     * 선택된 항목은 본번이 비어도 무조건 포함하고, 그 외에는 선택 그룹과 일치할 때만 포함한다.
     * @param {Array<{id: *, receptionNumber?: string}>} logs
     * @param {Array<string|number>} selectedIds
     * @returns {Set<string>} 대상 id 문자열 집합
     */
    function computeBulkTargetIds(logs, selectedIds) {
        const all = logs || [];
        const selectedSet = new Set((selectedIds || []).map(String));
        // 선택된 항목들의 그룹 키 목록 (본번 있는 것만)
        const selectedGroups = (selectedIds || [])
            .map(id => {
                const log = all.find(l => String(l.id) === String(id));
                return parseReceptionGroup(log?.receptionNumber || '');
            })
            .filter(g => g.base);

        const targetIds = new Set();
        all.forEach(log => {
            if (selectedSet.has(String(log.id))) {
                targetIds.add(String(log.id));
                return;
            }
            const g = parseReceptionGroup(log.receptionNumber || '');
            if (g.base && selectedGroups.some(s => s.base === g.base && s.isFill === g.isFill)) {
                targetIds.add(String(log.id));
            }
        });
        return targetIds;
    }

    const api = { parseReceptionGroup, isSameGroup, findRelatedLogs, computeBulkTargetIds };
    if (typeof window !== 'undefined') window.ReceptionGroup = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
