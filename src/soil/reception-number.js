/**
 * 접수번호 채번 순수 로직 (DOM/매니저 비의존 · 단위 테스트 대상)
 *
 * 토양 접수번호 규칙:
 *  - 같은 경지구분 1차(landClass1) 범위 내에서 독립적으로 max+1 채번한다.
 *  - 일반 시료와 성토(subCategory='성토', 'F' 접두) 시료는 서로 다른 번호 체계를 쓴다.
 *  - 접수번호의 본번은 '12-3'처럼 '-' 뒤 가지번호를 가질 수 있어 split('-')[0]로 본번만 본다.
 *
 * SoilSampleManager의 generateNextReceptionNumber / generateNextFillReceptionNumber /
 * getNextNumberForClass 가 모두 이 함수에 위임한다(알고리즘 단일화).
 *
 * @global window.ReceptionNumber
 */
(function () {
    'use strict';

    const DEFAULT_LAND_CLASS = '농가의뢰';

    /** 접수번호의 본번 표기 (`'12-3'` → `'12'`) */
    function baseOf(receptionNumber) {
        return String(receptionNumber).split('-')[0].trim();
    }

    /** 본번 표기가 성토 네임스페이스(F 접두)인가 */
    function isFillNotation(base) {
        return base.toUpperCase().startsWith('F');
    }

    /**
     * 주어진 로그 배열에서 targetClass 범위의 다음 접수번호(정수)를 계산.
     *
     * 시퀀스는 **접수번호 표기**로 나눈다 — `F` 접두면 성토, 아니면 일반.
     * `subCategory`로 나누지 않는다.
     *
     * 왜 표기 기준인가 (SLS-1-223):
     *  - 불변식(`F` 접두 ⟺ `subCategory==='성토'`)이 지켜지는 레코드에서는 두 정의가
     *    **같은 결과**를 낸다. 즉 건강한 대장에서 이 규칙은 아무것도 바꾸지 않는다.
     *  - 불변식이 깨진 레코드에서만 달라진다. `subCategory` 기준으로 나누면
     *    그런 레코드가 **두 풀 모두에서 제외**되어(일반 풀은 F 접두를 빼고, 성토 풀은
     *    구분≠성토를 뺀다) 그 번호가 다시 발급됐다 — 경고 없이 중복 대장이 된다.
     *  - `reception-group.js`와 정렬이 이미 `F` 접두로 판단한다. 기준을 통일한다.
     *
     * **전수성 조건**: 어떤 레코드도 두 풀 중 정확히 하나에는 반드시 들어가야 한다.
     * 이 조건이 깨지면 그 레코드의 번호가 재발급된다.
     *
     * @param {Array<Object>} logs - 시료 로그 배열
     * @param {string} targetClass - 기준 경지구분 1차
     * @param {Object} [opts]
     * @param {boolean} [opts.fill=false] - true면 성토(F) 번호 체계, false면 일반
     * @param {string}  [opts.defaultClass='농가의뢰'] - landClass1 누락 로그의 기본 분류
     * @returns {number} 다음 번호(정수). 성토도 정수를 반환하며 'F' 접두는 호출측이 붙인다.
     */
    function computeNextNumber(logs, targetClass, opts) {
        const o = opts || {};
        const fill = !!o.fill;
        const def = o.defaultClass || DEFAULT_LAND_CLASS;
        const target = targetClass || def;

        let maxNumber = 0;
        const list = Array.isArray(logs) ? logs : [];
        for (const log of list) {
            if (!log || !log.receptionNumber) continue;
            // 같은 경지구분 1차 범위만
            if ((log.landClass1 || def) !== target) continue;

            const base = baseOf(log.receptionNumber);
            // 시퀀스 분리는 표기 기준 (전수성: 모든 레코드가 정확히 한쪽에 들어간다)
            if (fill !== isFillNotation(base)) continue;

            const num = parseInt(fill ? base.slice(1) : base, 10);
            if (!isNaN(num) && num > maxNumber) maxNumber = num;
        }
        return maxNumber + 1;
    }

    /**
     * 접수번호 표기와 구분의 불변식 검사 — `F` 접두 ⟺ 구분='성토'.
     *
     * 이 불변식이 깨진 레코드는 채번·그룹핑·정렬이 서로 다르게 분류해
     * 조용한 중복의 원인이 된다.
     *
     * @param {string} base 접수번호 본번 표기
     * @param {boolean} isFillCategory 구분이 '성토'인가
     * @returns {string|null} 위반 사유, 정상이면 null
     */
    function namespaceViolation(base, isFillCategory) {
        if (isFillCategory === isFillNotation(base)) return null;
        return isFillCategory
            ? '구분=성토인데 접수번호가 F로 시작하지 않음'
            : '접수번호가 F로 시작하는데 구분이 성토가 아님';
    }

    /**
     * 대장의 접수번호 정합성 점검 (읽기 전용).
     *
     * @param {Array<Object>} logs
     * @param {Object} [opts]
     * @param {string} [opts.defaultClass='농가의뢰']
     * @returns {{violations: Array<Object>, duplicates: Array<Object>}}
     *   violations: 불변식이 깨진 레코드 (양방향)
     *   duplicates: 같은 경지구분1차 안에서 같은 본번 표기를 가진 묶음
     */
    function auditReceptionNumbers(logs, opts) {
        const def = (opts && opts.defaultClass) || DEFAULT_LAND_CLASS;
        const list = Array.isArray(logs) ? logs : [];
        const violations = [];
        const byKey = new Map();

        for (const log of list) {
            if (!log || !log.receptionNumber) continue;
            const landClass1 = log.landClass1 || def;
            const base = baseOf(log.receptionNumber);
            const reason = namespaceViolation(base, log.subCategory === '성토');
            const info = {
                id: log.id,
                receptionNumber: String(log.receptionNumber),
                name: log.name || '',
                landClass1,
                subCategory: log.subCategory || '',
            };
            if (reason) violations.push({ ...info, reason });

            // 키를 파싱하지 않고 값에 담는다 — 경지구분 이름에 어떤 문자가 있어도 안전하다
            const key = landClass1 + '\u0000' + base;
            if (!byKey.has(key)) byKey.set(key, { landClass1, base, records: [] });
            byKey.get(key).records.push(info);
        }

        const duplicates = [];
        for (const group of byKey.values()) {
            if (group.records.length < 2) continue;
            duplicates.push({
                landClass1: group.landClass1, base: group.base,
                count: group.records.length, records: group.records,
            });
        }
        return { violations, duplicates };
    }

    window.ReceptionNumber = {
        computeNextNumber, DEFAULT_LAND_CLASS,
        // SLS-1-223: 불변식 검사·정합성 점검 (가져오기·편집·설정 화면이 공유)
        baseOf, isFillNotation, namespaceViolation, auditReceptionNumbers,
    };
})();
