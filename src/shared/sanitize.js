// ========================================
// 공통 XSS 방지 모듈
// DOMPurify를 사용한 HTML 새니타이징
// ========================================

/**
 * HTML 문자열을 새니타이즈하여 XSS 공격 방지
 * @param {string} html - 새니타이즈할 HTML 문자열
 * @returns {string} 새니타이즈된 HTML 문자열
 */
function sanitizeHTML(html) {
    if (typeof DOMPurify !== 'undefined') {
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
        return DOMPurify.sanitize(html, config);
    }
    // DOMPurify가 없으면 기본 이스케이프 처리
    return escapeHTML(html);
}

/**
 * 텍스트를 HTML 엔티티로 이스케이프
 * @param {string|null|undefined} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHTML(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
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
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), safeValue);
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
window.clearElement = clearElement;
window.safeText = safeText;
window.safeTemplate = safeTemplate;
window.sanitizeExcelCell = sanitizeExcelCell;
window.sanitizeExcelData = sanitizeExcelData;
window.sanitizeExcelAoa = sanitizeExcelAoa;
