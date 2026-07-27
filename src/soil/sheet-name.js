// 엑셀 시트명 정규화 순수 로직 (SLS-1-199)
// 접수대장 내보내기의 경지구분1차별 시트 분리에서 사용한다.
//
// Excel 시트명 규칙 (전부 위반 시 book_append_sheet/저장 단계에서 파손):
//  - 금지 문자: [ ] : * ? / \  및 제어문자
//  - 선행·후행 아포스트로피(') 불가
//  - 최대 31자
//  - 'History'는 공유 통합문서 변경 로그용 예약 이름 (대소문자 무시)
//  - 통합문서 내 중복 불가 — 비교는 **대소문자 무시** (Excel은 GAP과 gap을 같은 이름으로 봄)
//
// 실무 값(LAND_CLASS1_OPTIONS 12종)은 전부 안전하지만, 엑셀 가져오기로 임의 값이
// 유입될 수 있으므로 방어를 완결한다.
//
// soil-script.js보다 먼저 로드되어야 한다 (soil-entry.js에서 순서 보장).
// window.SheetName으로 노출 — reception-number.js 등 기존 순수 로직 패턴과 동일.

(function () {
    'use strict';

    /**
     * 시트명을 Excel 규칙에 맞게 정규화하고 통합문서 내 유일성을 보장한다.
     * @param {string} name - 원본 이름 (경지구분1차 값 등)
     * @param {Set<string>} usedNames - 이미 사용된 이름 집합.
     *        **소문자로 저장/비교**한다(대소문자 무시 중복 판정). 호출자가 같은 Set을
     *        워크북 전체에 걸쳐 재사용해야 한다.
     * @returns {string} 사용 가능한 시트명 (usedNames에 등록됨)
     */
    function sanitizeSheetName(name, usedNames) {
        // 순서가 중요하다 (코드리뷰 MINOR-1):
        //  ① 금지·제어문자를 공백으로  ② 31자로 자른다  ③ 절단 **뒤에** 선행·후행의
        //     공백과 아포스트로피를 **함께** 제거한다.
        // ③을 trim과 아포스트로피 제거로 분리하면 순서에 관계없이 구멍이 생긴다 —
        // 먼저 제거하면 절단면이 내부 '를 후행으로 노출시키고, 나중에 trim하면
        // 그 trim이 걷어낸 공백 뒤에서 다시 '가 후행이 된다. xlsx check_ws_name이
        // 선행/후행 아포스트로피에 throw하므로 한 번에 처리한다.
        let s = String(name || '')
            .replace(/[\[\]:*?/\\\x00-\x1F]/g, ' ')
            .slice(0, 31)
            .replace(/^[\s']+|[\s']+$/g, '');
        if (!s) s = '미지정';
        if (s.toLowerCase() === 'history') s = `${s}_`; // 예약 이름 회피

        let candidate = s;
        let i = 2;
        while (usedNames.has(candidate.toLowerCase())) {
            const suffix = ` (${i++})`;
            // 접미사용 절단도 같은 이유로 후행 공백·아포스트로피를 함께 정리한다.
            // (접미사가 ')'로 끝나므로 결과의 후행 아포스트로피는 생기지 않는다)
            candidate = s.slice(0, 31 - suffix.length).replace(/[\s']+$/, '') + suffix;
        }
        usedNames.add(candidate.toLowerCase());
        return candidate;
    }

    window.SheetName = { sanitizeSheetName };
})();
