// ========================================
// 공통 XSS 방지 모듈
// DOMPurify를 사용한 HTML 새니타이징
// ========================================

// DOMPurify 훅 1회 등록 가드 (sanitizeHTML 최초 호출 시 등록)
let relNoopenerHookRegistered = false;

/**
 * HTML 문자열을 새니타이즈하여 XSS 공격 방지
 * @param {string} html - 새니타이즈할 HTML 문자열
 * @returns {string} 새니타이즈된 HTML 문자열
 */
function sanitizeHTML(html) {
    if (typeof window.DOMPurify !== 'undefined') {
        // reverse tabnabbing 방어: target=_blank 링크에 rel="noopener noreferrer" 강제 (SLS-1-132)
        // Electron은 setWindowOpenHandler가 새 창 생성을 차단하므로 실질 효과는 웹 빌드에서 발생.
        if (!relNoopenerHookRegistered) {
            window.DOMPurify.addHook('afterSanitizeAttributes', (node) => {
                if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
                    node.setAttribute('rel', 'noopener noreferrer');
                }
            });
            relNoopenerHookRegistered = true;
        }
        const config = {
            ALLOWED_TAGS: [
                'div', 'span', 'p', 'br', 'hr',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'ul', 'ol', 'li', 'dl', 'dt', 'dd',
                'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
                'a', 'img', 'input', 'select', 'option', 'textarea', 'button', 'label',
                'fieldset', 'legend',
                'strong', 'em', 'b', 'i', 'u', 's', 'small', 'mark', 'sub', 'sup',
                'pre', 'code', 'blockquote', 'cite', 'abbr',
                'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
                'figure', 'figcaption', 'details', 'summary'
            ],
            // 🚨 여기에 **없는 속성은 조용히 지워진다.** 두 번 사고가 났다:
            //    · SLS-1-243 `hidden`  — 공지가 접히지 않고 전부 펼쳐졌다
            //    · SLS-1-253 `style`   — 막대 그래프 폭이 사라져 전부 같은 길이가 됐다
            //    둘 다 "마크업에 넣었는데 화면에서 사라진" 형태라 원인을 찾기 어렵다.
            //    ⚠️ sanitizeHTML을 거치는 곳에서는 **속성으로 표현을 실어 보내지 않는다.**
            //       값은 data-*로 넘기고, 스타일·상태는 삽입 **뒤에** DOM 프로퍼티로 준다.
            ALLOWED_ATTR: [
                'class', 'id', 'title', 'alt', 'src', 'href', 'target', 'rel',
                'type', 'name', 'value', 'placeholder', 'disabled', 'readonly', 'checked', 'selected',
                'for', 'data-*', 'aria-*', 'role',
                'colspan', 'rowspan', 'width', 'height',
                'min', 'max', 'step', 'pattern', 'required', 'maxlength', 'minlength',
                'rows', 'cols', 'multiple', 'accept'
            ],
            // 폼 태그는 신뢰 마크업 렌더링(드롭다운/버튼 등)에 필요해 허용하되,
            // ALLOWED_ATTR 화이트리스트로 on* 이벤트는 이미 차단됨. 방어 보강 차원에서 위험 속성 명시 금지.
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'formaction'],
            ALLOW_DATA_ATTR: true
        };
        return window.DOMPurify.sanitize(html, config);
    }
    // DOMPurify가 없으면 기본 이스케이프 처리
    return escapeHTML(html);
}

/**
 * 텍스트를 HTML 엔티티로 이스케이프
 *
 * 🚨 따옴표까지 반드시 이스케이프한다 (SLS-1-249).
 *    예전 구현은 `div.textContent = x; return div.innerHTML`이었는데, HTML 텍스트 노드
 *    직렬화는 규격상 `&`·`<`·`>`만 바꾸고 **따옴표는 그대로 내보낸다.** 텍스트 문맥에서는
 *    맞지만, 이 함수의 결과는 `value="..."`·`title="..."` 같은 **속성 문맥**으로도 들어간다.
 *    그러면 `"`가 속성을 닫아버려 뒤가 통째로 잘렸다:
 *
 *        입력  1"동 옆 창고   →  value="1"동 옆 창고"  →  화면 '1'
 *
 *    저장은 됐는데 **다시 열 때** 잘려 보이고, 그 상태로 저장하면 원본이 덮였다.
 *    (스크립트 실행은 DOMPurify의 속성 화이트리스트와 CSP가 막았다 — 피해는 데이터 유실이었다)
 *
 * ⚠️ `&`를 **맨 먼저** 치환해야 한다. 순서를 바꾸면 `&lt;`가 다시 `&amp;lt;`가 된다.
 *
 * DOM 대신 문자열로 처리하는 이유: 미리보기 표가 13열 × 최대 200행이라 호출이 수천 번이고,
 * `soil-result-importer.js`·`heuktoram-result-importer.js`의 로컬 폴백이 이미 이 구현이라
 * 세 곳의 동작이 하나로 맞는다.
 *
 * @param {string|null|undefined} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHTML(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 안전하게 innerHTML 설정
 * @param {HTMLElement|null} element - 대상 요소
 * @param {string} html - 설정할 HTML
 */
function setInnerHTML(element, html) {
    if (element) {
        element.innerHTML = sanitizeHTML(html);
    }
}

/**
 * `data-width-pct`를 실제 폭으로 바꾼다 (SLS-1-253).
 *
 * 🚨 `sanitizeHTML`은 `style` 속성을 **지운다**(ALLOWED_ATTR에 없다).
 *    그래서 막대 그래프 폭을 마크업에 인라인으로 넣으면 사라지고,
 *    폭 없는 막대는 부모를 100% 채워 **값과 무관하게 전부 같은 길이**가 된다.
 *    실제로 두 곳에서 그렇게 됐다 — 관리자 릴리스 현황, 토양 분기별 완료율.
 *
 *    값은 `data-width-pct`(data-*는 허용됨)로 넘기고, 삽입 **뒤에** 이 함수를 부른다.
 *    DOM 프로퍼티 대입이라 새니타이저를 거치지 않는다.
 *
 * @param {ParentNode|null} root - 검색 기준 요소
 */
function applyDataWidths(root) {
    root?.querySelectorAll('[data-width-pct]').forEach((el) => {
        // Number로 숫자만 통과시킨다 — 문자열이 CSS로 흘러들지 않게
        const pct = Number(el.dataset.widthPct);
        el.style.width = `${Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0}%`;
    });
}

/**
 * 빈 콘텐츠로 요소 초기화 (새니타이징 불필요)
 * @param {HTMLElement|null} element - 대상 요소
 */
function clearElement(element) {
    if (element) {
        element.innerHTML = '';
    }
}

/**
 * 사용자 입력값을 안전하게 이스케이프 (텍스트로 사용할 때)
 * @param {string} value - 이스케이프할 값
 * @returns {string} 이스케이프된 값
 */
function safeText(value) {
    return escapeHTML(value);
}

/**
 * 템플릿 리터럴 내 사용자 데이터를 안전하게 처리
 * @param {string} template - 템플릿 문자열
 * @param {Object} data - 치환할 데이터
 * @returns {string} 처리된 문자열
 */
function safeTemplate(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        const safeValue = escapeHTML(value);
        // ⚠️ key를 정규식에 그대로 넣지 않는다 (SLS-1-249 코드리뷰).
        //    '가격($)' 같은 키가 오면 메타문자로 해석되어 엉뚱한 자리를 치환하거나 던진다.
        const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // ⚠️ 치환자는 **함수로** 넘긴다 (SLS-1-249 계획 리뷰).
        //    문자열로 넘기면 String.replace가 `$&`·`` $` ``·`$'`·`$1`·`$$`를 특수 해석해,
        //    값에 `$&`가 들어오면 매치된 `{{key}}` 자체로 바뀐다. 함수 치환자에는 그 해석이 없다.
        result = result.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, 'g'), () => safeValue);
    }
    return result;
}

/**
 * CSV Injection 방지: 엑셀 셀 값에서 수식 실행을 차단
 * =, +, -, @, \t, \r로 시작하는 값 앞에 작은따옴표(') 추가
 * @param {*} value - 셀 값
 * @returns {*} 새니타이즈된 값 (문자열이 아니면 그대로 반환)
 */
function sanitizeExcelCell(value) {
    if (typeof value !== 'string') return value;
    if (value.length > 1 && /^[=+\-@\t\r;|]/.test(value)) return "'" + value;
    return value;
}

/**
 * 엑셀 내보내기용 객체 배열의 모든 문자열 값을 새니타이즈 (json_to_sheet용)
 * @param {Array<Object>} data - json_to_sheet에 전달할 데이터 배열
 * @returns {Array<Object>} 새니타이즈된 데이터 배열
 */
function sanitizeExcelData(data) {
    return data.map(row => {
        const sanitized = {};
        for (const [key, val] of Object.entries(row)) {
            sanitized[key] = sanitizeExcelCell(val);
        }
        return sanitized;
    });
}

/**
 * 엑셀 내보내기용 2차원 배열의 모든 문자열 값을 새니타이즈 (aoa_to_sheet용)
 * @param {Array<Array>} aoa - aoa_to_sheet에 전달할 2차원 배열
 * @returns {Array<Array>} 새니타이즈된 2차원 배열
 */
function sanitizeExcelAoa(aoa) {
    return aoa.map(row => Array.isArray(row) ? row.map(cell => sanitizeExcelCell(cell)) : row);
}

// 전역으로 내보내기
window.sanitizeHTML = sanitizeHTML;
window.escapeHTML = escapeHTML;
window.setInnerHTML = setInnerHTML;
window.applyDataWidths = applyDataWidths;
window.clearElement = clearElement;
window.safeText = safeText;
window.safeTemplate = safeTemplate;
window.sanitizeExcelCell = sanitizeExcelCell;
window.sanitizeExcelData = sanitizeExcelData;
window.sanitizeExcelAoa = sanitizeExcelAoa;
