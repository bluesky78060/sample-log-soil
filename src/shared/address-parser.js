// ========================================
// 주소 파싱 공통 모듈 (시도 매핑 단일 출처 · SSOT)
// 시도, 시군구, 읍면동, 나머지주소 분리
//
// 시도 목록·약어 매핑은 이 모듈이 유일한 출처다(SLS-1-97).
// soil-script/heuktoram-script 등은 window.SIDO_LIST / SIDO_SHORT_MAP / expandSido 를 재사용한다.
// → '강원도' vs '강원특별자치도' 같은 표기 불일치를 한 곳에서 통제.
// ========================================

// 시도 목록 (전체 이름). 2023 개편 신·구 명칭 모두 인식.
const SIDO_LIST = [
    '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
    '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
    '강원도', '충청북도', '충청남도', '전라북도', '전북특별자치도',
    '전라남도', '경상북도', '경상남도', '제주특별자치도'
];

// 시도 약어 → 표준 전체 이름 매핑 (2023 개편 반영: 강원/전북 특별자치도)
const SIDO_SHORT_MAP = {
    '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시',
    '인천': '인천광역시', '광주': '광주광역시', '대전': '대전광역시',
    '울산': '울산광역시', '세종': '세종특별자치시', '경기': '경기도',
    '강원': '강원특별자치도', '충북': '충청북도', '충남': '충청남도',
    '전북': '전북특별자치도', '전남': '전라남도', '경북': '경상북도',
    '경남': '경상남도', '제주': '제주특별자치도'
};

/**
 * 시도명(약어 또는 전체)을 표준 전체 이름으로 변환.
 * 이미 전체 이름이거나 매칭되는 약어가 없으면 원본을 그대로 반환한다.
 * @param {string} name - 시도명 (예: '경북', '경상북도', '강원')
 * @returns {string} 표준 전체 이름 (예: '경상북도', '강원특별자치도')
 */
function expandSido(name) {
    if (!name) return '';
    if (SIDO_LIST.includes(name)) return name;
    return SIDO_SHORT_MAP[name] || name;
}

/**
 * 주소를 시도, 시군구, 읍면동, 나머지주소로 분리
 * @param {string} address - 전체 주소 (도로명주소 또는 지번주소)
 * @returns {object} { sido, sigungu, eupmyeondong, rest }
 */
function parseAddressParts(address) {
    if (!address || address === '-') {
        return { sido: '', sigungu: '', eupmyeondong: '', rest: '' };
    }

    // 우편번호 제거 (예: "(12345) " 형식)
    address = address.replace(/^\(\d{5}\)\s*/, '').trim();

    let sido = '';
    let sigungu = '';
    let eupmyeondong = '';
    let rest = '';

    // 공백으로 분리
    const parts = address.split(/\s+/);

    // 1. 시도 찾기 (전체 이름 또는 약어)
    if (parts.length > 0) {
        const firstPart = parts[0];
        if (SIDO_LIST.includes(firstPart)) {
            sido = firstPart;
            parts.shift();
        } else if (SIDO_SHORT_MAP[firstPart]) {
            sido = SIDO_SHORT_MAP[firstPart];
            parts.shift();
        }
    }

    // 2. 시군구 찾기 (시, 군, 구로 끝나는 부분)
    if (parts.length > 0) {
        const sigunguPattern = /(시|군|구)$/;
        if (sigunguPattern.test(parts[0])) {
            sigungu = parts.shift();
            // 두 번째 파트도 구인지 확인 (예: "성남시 분당구")
            if (parts.length > 0 && /구$/.test(parts[0])) {
                sigungu += ' ' + parts.shift();
            }
        }
    }

    // 3. 읍면동 찾기 (읍, 면, 동, 리, 가로 끝나는 부분)
    if (parts.length > 0) {
        const eupmyeondongPattern = /(읍|면|동|리|가)$/;
        if (eupmyeondongPattern.test(parts[0])) {
            eupmyeondong = parts.shift();
        }
    }

    // 4. 나머지 주소
    rest = parts.join(' ');

    return { sido, sigungu, eupmyeondong, rest };
}

// 전역으로 내보내기 (시도 매핑 SSOT)
window.parseAddressParts = parseAddressParts;
window.SIDO_LIST = SIDO_LIST;
window.SIDO_SHORT_MAP = SIDO_SHORT_MAP;
window.expandSido = expandSido;
