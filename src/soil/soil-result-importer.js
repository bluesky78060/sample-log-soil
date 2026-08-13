/**
 * SoilResultImporter
 *
 * 토양 시료 접수 — 흙토람式 엑셀/붙여넣기 가져오기 모달 (자체 완결).
 *
 * 흙토람 결과 입력 모달(heuktoram-result-importer.js)의 인터랙션 패턴을 따르되,
 * 접수 레코드 "신규 등록"용으로 재구성한다. 모달 DOM·스타일을 이 모듈이 직접
 * 주입하므로 외부 마크업/CSS(heuktoram-style.css)에 의존하지 않는다.
 *
 * 흐름:
 *   1) 엑셀 데이터 입력  — 파일 업로드(드래그앤드롭) / 텍스트 붙여넣기 토글
 *   2) 컬럼 매핑         — 엑셀 컬럼 → 접수 필드 (접수번호[선택]·성명·연락처·
 *                          지번주소·작물·면적·구분·목적·비고), 자동 매핑 추정
 *   3) 경지구분 1차      — 11값 드롭다운 → 가져오는 모든 행에 일괄 적용
 *   4) 옵션             — 접수번호 자동부여 / 중복 시(건너뛰기·덮어쓰기)
 *   5) 미리보기          — 생성될 행 표 + 신규/중복/오류 배지 + 건수 요약
 *
 * 저장은 window.soilManager.addImportedRecord(record) 로 위임한다.
 *
 * @global window.SoilResultImporter (싱글턴 인스턴스)
 */
(function () {
    'use strict';

    // ============================================================
    // 상수
    // ============================================================
    const FILE_SIZE_WARN = 5 * 1024 * 1024;    // 5MB: 경고만
    const FILE_SIZE_HARD = 50 * 1024 * 1024;   // 50MB: 거부
    const PREVIEW_ROW_LIMIT = 200;             // 미리보기 표 최대 행
    const LAND_CLASS1_OPTIONS = ['개량제', '전략', '직불', '자체', '기타', '친환경', '유기농', '무농약', 'GAP', '농가의뢰', '대표필지', '공익직불제'];
    const LAND_CLASS1_DEFAULT = '농가의뢰';

    // 매핑 대상 접수 필드 (순서 = 매핑 UI 표시 순서)
    // key: record 필드명, label: UI 표시명, auto: 자동 매핑용 헤더 키워드(정규화)
    //   - 각 기술센터마다 컬럼명이 제각각이므로 동의어를 폭넓게 등록한다.
    //   - 매칭은 _autoMap()의 스코어 기반 전역 최적화로 처리(긴/정확 키워드 우선).
    const TARGET_FIELDS = [
        { key: 'receptionNumber', label: '접수번호', optional: true,
          auto: ['접수번호', '접수no', '접수번호no', '번호', '연번', '순번', '일련번호', '관리번호', '정렬번호', 'no', 'num', 'seq', 'index', 'id'] },
        { key: 'name',            label: '성명',
          auto: ['성명', '이름', '성함', '의뢰인', '의뢰자', '의뢰인명', '농가명', '농가', '경영체명', '농업인', '농업인명', '신청인', '신청자', '신청인명', '대표자', '대표자명', '경작자', '경작자명', '경작인', '민원인', '고객명', '고객', '토지소유자', '소유자', '소유자명', '재배자', 'name', 'farmer', 'applicant', 'owner'] },
        { key: 'phoneNumber',     label: '연락처',
          auto: ['연락처', '전화', '전화번호', '휴대폰', '휴대폰번호', '핸드폰', '핸드폰번호', '휴대전화', '휴대전화번호', '연락전화', '연락번호', '핸펀', 'phone', 'tel', 'telephone', 'hp', 'mobile', 'cell', 'cellphone', 'contact'] },
        { key: 'lotAddress',      label: '지번주소',
          auto: ['지번주소', '지번', '소재지', '소재지지번', '토지소재지', '필지', '필지주소', '시료채취지', '채취지', '채취지주소', '경작지', '경작지주소', '농지', '농지주소', '토지주소', '포장주소', '포장위치', '시료위치', '주소', 'address', 'addr', 'jibun', 'lot', 'parcel'] },
        { key: 'cropsDisplay',    label: '작물',
          auto: ['작물', '작물명', '재배작물', '재배작목', '작목', '작목명', '품목', '품목명', '재배품목', '경작작물', 'crop', 'crops', 'item'] },
        { key: 'area',            label: '면적',
          auto: ['면적', '재배면적', '경작면적', '필지면적', '농지면적', '포장면적', '시료면적', '제곱미터', '평방미터', 'area', 'size'] },
        { key: 'subCategory',     label: '구분',
          auto: ['구분', '지목', '토지구분', '전답구분', '논밭구분', '시료구분', '경지지목', 'category', 'type', 'gubun'] },
        { key: 'purpose',         label: '목적',
          auto: ['목적', '용도', '사용용도', '분석목적', '검정목적', '신청목적', '의뢰목적', '시료목적', 'purpose', 'usage', 'use'] },
        { key: 'note',            label: '비고',
          auto: ['비고', '비고란', '메모', '참고', '참고사항', '특이사항', '기타', '기타사항', '코멘트', 'note', 'notes', 'remark', 'remarks', 'memo', 'comment', 'comments', 'etc'] },
        // 공익직불제용 (선택) — gongik:true 인 항목은 경지구분1차='공익직불제'일 때 강조
        { key: 'businessRegNo',   label: '경영체등록번호', optional: true, gongik: true,
          auto: ['경영체등록번호', '농업경영체등록번호', '농업경영체', '경영체', '경영체번호', '경영체등록', '등록번호', '경영등록번호', 'businessregno', 'bizregno', 'bizno', 'businessno', 'farmbizno'] },
        { key: 'addressPostcode', label: '우편번호', optional: true,
          // ⚠️ '번호'·'등록번호' 같은 짧은 키워드는 넣지 않는다 — 접수번호·경영체등록번호와 겹친다.
          //    로드 시 auditDuplicateKeywords()가 교차 중복을 경고한다.
          auto: ['우편번호', '우편', '신우편번호', '도로명우편번호',
                 'zip', 'zipcode', 'zipno', 'postcode', 'postalcode', 'post'] },
        { key: 'addressRoad',     label: '농가주소(경작자)', optional: true, gongik: true,
          // '농가' 단독은 성명(name)과 의미 충돌하므로 제외, '농가주소' 등 명시 키워드만 사용
          auto: ['농가주소', '농업인주소', '경영체주소', '경작자주소', '거주지주소', '거주지', '도로명주소', '도로명', '주소도로명', '신청인주소', '의뢰인주소', '대표자주소', 'farmeraddr', 'addressroad', 'roadaddr', 'roadaddress'] },
        { key: 'date',            label: '접수일자', optional: true, gongik: true,
          auto: ['접수일자', '접수일', '접수날짜', '조사일자', '조사일', '분석의뢰일', '의뢰일', '의뢰일자', '신청일', '신청일자', '채취일', '채취일자', '시료채취일', '채취년월일', '채취연월일', '시료채취년월일', '등록일', '등록일자', '일자', '날짜', 'date', 'regdate', 'recvdate'] },
    ];

    // 자동매핑 동점 처리용: TARGET_FIELDS 정의 순서 (앞 필드 우선)
    const FIELD_ORDER = new Map(TARGET_FIELDS.map((f, i) => [f.key, i]));

    // ============================================================
    // 가져오기 기본 서식 (SLS-1-225)
    // ============================================================
    //
    // ⚠️ 신규 기능이 아니라 **복구**다. 구 모달(#excelImportModal)에
    //    '📄 엑셀 서식 다운로드'(index.html:827)와 _downloadTemplate()
    //    (excel-import-manager.js:123)이 있었으나, 구 모달 진입점이 hidden 처리되면서
    //    의도치 않게 함께 사라졌다. 구 구현의 구조(sanitizeExcelAoa 포함)를 따른다.
    //
    // 왜 시트를 나누나: 경지구분은 행 단위로 넣을 열이 없다(3단계에서 일괄 지정).
    //   한 시트에 자체·대표필지를 섞으면 어느 행이 어느 구분인지 알 수 없다.
    //   시트명을 LAND_CLASS1_OPTIONS 값과 같게 두어, 후속 '시트 일괄 가져오기'에서
    //   시트명 → 경지구분으로 그대로 쓸 수 있게 한다.
    //
    // 개인정보: 자체·대표필지는 성명·연락처·농가주소를 **넣지 않는다**. 식별 조건이
    //   OR(:345)이고 행 검사도 name||lotAddress(:372)라 지번주소만으로 통과한다.
    //   열이 없으면 실수로 채울 자리도 없다 — 규칙이 아니라 구조로 막는다.

    /** 필드 키 → 서식 헤더. 문자열 리터럴로 적지 말 것(라벨 변경 시 매핑이 조용히 깨진다) */
    const fieldLabel = (key) => TARGET_FIELDS.find((f) => f.key === key)?.label ?? key;

    const TPL_NO_PII = ['receptionNumber', 'lotAddress', 'cropsDisplay', 'area', 'subCategory', 'purpose', 'note'];
    const TPL_FARMER = ['receptionNumber', 'name', 'phoneNumber', 'addressPostcode', 'addressRoad',
        'lotAddress', 'cropsDisplay', 'area', 'subCategory', 'purpose', 'note'];

    const TEMPLATE_SHEETS = [
        { name: '자체', fields: TPL_NO_PII },
        { name: '대표필지', fields: TPL_NO_PII },
        { name: '농가의뢰', fields: TPL_FARMER },
        // 공익직불제 = 농가의뢰 + 경영체등록번호 + 접수일자
        { name: '공익직불제', fields: [...TPL_FARMER, 'businessRegNo', 'date'] },
    ];

    // 예시 행 값. 키가 없는 필드는 빈 칸으로 나간다.
    //
    // ⚠️ 지번주소에 경고를 넣는 이유: 예시 행을 지우지 않고 가져오면 식별 검사(:345, :372)를
    //    그대로 통과해 쓰레기 데이터가 들어간다. 안내를 비고에만 두면 가장 안 보는 칸이라
    //    소용이 없다. **식별 필드 자체**를 눈에 띄게 해야 미리보기에서 바로 걸린다.
    // ⚠️ 접수번호는 비운다 — 도구 자신의 권장값이 '(비움 · 자동부여)'(:1151)다.
    //    예시에 501을 넣으면 그 권장과 모순되고, 수동 번호로 오인된다.
    // ⚠️ soil-entry.js는 스타일 없는 xlsx를 import하므로 색·굵게는 불가. 강조는 텍스트로만.
    const TEMPLATE_SAMPLE = {
        lotAddress: '⚠예시 – 삭제 후 사용⚠ 경상북도 봉화군 봉화읍 문단리 699',
        cropsDisplay: '고추',
        area: '1500',
        subCategory: '밭',
        purpose: '일반재배',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
        addressPostcode: '36628',
        addressRoad: '경상북도 봉화군 봉화읍 내성리 100',
        businessRegNo: '1234567890',
        date: '2026-08-12',
        note: '이 행은 예시입니다. 지우고 사용하세요.',
    };

    /**
     * 서식 시트 구성을 만든다 — DOM·다운로드 부작용 없음(단위 테스트용).
     *
     * ⚠️ _downloadTemplate()에서 이 로직을 분리해 둔 이유: window.XLSX는 모듈 네임스페이스
     *    객체(frozen)라 테스트에서 writeFile을 가로채기 까다롭고, 실제로 그 때문에 테스트가
     *    조용히 통과한 사고가 있었다(tests/e2e/soil-export-sheets.spec.js:1-7).
     *    순수 함수로 두면 헤더·예시 행을 직접 검증할 수 있다.
     *
     * @returns {Array<{name: string, headers: string[], rows: Array<Array<string>>}>}
     */
    function buildTemplateSheets() {
        return TEMPLATE_SHEETS.map((sheet) => ({
            name: sheet.name,
            // fields를 함께 돌려준다 — 테스트가 "열이 **올바른 필드에** 매핑됐는가"를
            // 확인하려면 헤더와 필드 키의 대응이 필요하다. 인덱스 집합만 보면
            // 엉뚱한 필드에 붙어도 통과한다 (codex 리뷰 MINOR-1).
            fields: [...sheet.fields],
            headers: sheet.fields.map(fieldLabel),
            rows: [sheet.fields.map((key) => TEMPLATE_SAMPLE[key] ?? '')],
        }));
    }

    // ============================================================
    // 헬퍼
    // ============================================================
    function normalizeHeader(text) {
        // 공백(\s, 개행 포함)·괄호·㎡ 외에 흔한 구분기호(-, _, /, ., ·, :, ;, |, *, #, ㎥)도
        // 제거해 '전화 번호', '전화-번호', '주소(도로명)' 같은 변형을 한 형태로 수렴시킨다.
        return String(text || '')
            .replace(/[\s()[\]{}㎡㎥\-_/.,·:;|*#]/g, '')
            .toLowerCase();
    }

    /**
     * 어떤 필드에도 자동 매핑하지 않을 헤더 (정규화 후 완전 일치).
     *
     * ⚠️ '필지구분'은 본필지/하위필지를 뜻하는데, 우리 모델에서 그건 **접수번호로 판별한다**
     *    (503 / 503-1). 대응 필드가 없다. 그런데 subCategory 키워드 '구분'에 접미 일치해
     *    구분(논/밭/과수/시설)으로 들어간다 → 흙토람 내보내기와 성토 판별이 함께 어긋난다.
     *
     * ⚠️ 키워드('구분')를 지우는 방식으로 고치지 않는다. 헤더가 그냥 '구분'인 서식이
     *    잘 동작 중이라 그걸 깨뜨린다. 제외 목록이 영향 범위가 좁다.
     *
     * ⚠️ '경지구분'·'경지구분1차'도 막는다. 이 앱에서 **경지구분은 1차**(자체/대표필지/
     *    농가의뢰/공익직불제)를 뜻하고, 2차(논/밭/과수/시설)는 '구분'이라고 부른다
     *    (TARGET_FIELDS의 subCategory 라벨). 1차는 모달에서 배치 단위로 고르는 값이라
     *    가져오기 대상 필드가 아닌데, '구분' 접미 일치로 2차에 들어간다.
     *    실물 서식에서 subCategory에 '농가의뢰'가 저장되는 것을 확인했다.
     *    막으면 자동 추정만 사라져 눈에 보이지만, 안 막으면 조용히 틀린 값이 저장된다.
     *
     * ⚠️ '경지구분2차'는 **막지 않는다** — 그건 정확히 우리 subCategory다.
     *
     * ⚠️ **자동 추정에만** 적용한다. 사용자가 직접 고르는 수동 매핑은 막지 않는다.
     */
    const HEADER_DENYLIST = new Set(
        // ⚠️ 사람이 읽는 표기 그대로 적고 normalizeHeader로 맞춘다.
        //    정규화를 빼면 '경지구분 1차'가 헤더 '경지구분1차'와 어긋나 새어 나간다.
        ['필지 구분', '본필지 구분', '필지 유형', '경지 구분', '경지구분 1차', '경지구분 1']
            .map(normalizeHeader)
    );

    // ── 자동매핑 점수 상수 ───────────────────────────────────────
    // 구간 베이스 간격(≥200)이 가산항(키워드/헤더 길이, 현실상 ≤ ~12)보다 훨씬 커서
    // 길이에 관계없이 EXACT > AFFIX > INCLUDE > RINCLUDE 불변식이 항상 성립한다.
    const SCORE_EXACT    = 1000; // 완전 일치 (헤더 == 키워드)
    const SCORE_AFFIX    = 500;  // 접두/접미 일치 (헤더가 키워드로 시작/끝남)
    const SCORE_INCLUDE  = 300;  // 부분 포함 (키워드 ⊂ 헤더)
    const SCORE_RINCLUDE = 100;  // 역포함 (헤더 ⊂ 키워드, 약식 표기)
    // 영문/숫자 전용 키워드 판별 — 2글자(no/id/hp 등)는 완전일치 전용으로 제한해
    // 우연한 부분일치 과매칭을 막는다(한글은 글자당 정보량이 커서 2글자도 허용).
    const ASCII_KEYWORD = /^[a-z0-9]+$/;

    // 키워드 정규화 사전계산: TARGET_FIELDS 각 필드에 _autoNorm = [{nk, ascii}] 부착.
    // 매 _autoMap 호출마다 normalizeHeader(키워드)를 반복 계산하지 않도록 1회만 수행.
    TARGET_FIELDS.forEach((f) => {
        const seen = new Set();
        f._autoNorm = [];
        for (const kw of f.auto) {
            const nk = normalizeHeader(kw);
            if (!nk || seen.has(nk)) continue;
            seen.add(nk);
            f._autoNorm.push({ nk, ascii: ASCII_KEYWORD.test(nk) });
        }
    });

    /**
     * 정규화 헤더 nh 와 필드의 사전계산 키워드(autoNorms = [{nk, ascii}])의 적합도 점수.
     *  - 0                  : 매칭 없음
     *  - SCORE_EXACT+len    : 완전 일치 (가장 신뢰도 높음)
     *  - SCORE_AFFIX+len    : 헤더가 키워드로 시작/끝남
     *  - SCORE_INCLUDE+len  : 키워드가 헤더에 포함
     *  - SCORE_RINCLUDE+len : 헤더가 키워드에 포함 (헤더가 더 짧은 약식)
     * 같은 필드의 여러 키워드 중 최고 점수를 채택한다.
     *
     * 영문 2글자 키워드는 완전일치 외 매칭(접두접미/부분/역포함)에서 제외(minMatch=3)해
     * 'no'·'id' 등이 무관한 헤더에 우연히 끼어드는 과매칭을 방지한다.
     */
    function scoreFieldHeader(autoNorms, nh) {
        if (!nh) return 0;
        let best = 0;
        for (const { nk, ascii } of autoNorms) {
            const minMatch = ascii ? 3 : 2;
            let s = 0;
            if (nh === nk) {
                s = SCORE_EXACT + nk.length;
            } else if (nk.length >= minMatch && (nh.startsWith(nk) || nh.endsWith(nk))) {
                s = SCORE_AFFIX + nk.length;
            } else if (nk.length >= minMatch && nh.includes(nk)) {
                s = SCORE_INCLUDE + nk.length;
            } else if (nk.length >= 3 && nh.length >= 3 && nk.includes(nh)) {
                // 헤더가 키워드보다 짧은 약식(예: 헤더 '경영체' ⊂ 키워드 '경영체번호').
                // 약식은 한글/영문 구분 없이 3글자 이상만 허용(minMatch 미적용, 의도적 고정).
                // 가산항은 헤더 길이(nh.length) — 더 긴 약식일수록 신뢰도가 높으므로 차등.
                s = SCORE_RINCLUDE + nh.length;
            }
            if (s > best) best = s;
        }
        return best;
    }

    /**
     * 헤더 배열 → { fieldKey: colIdx } 자동 매핑 (순수 함수, DOM 비의존 · 단위 테스트 대상).
     * 모든 (필드 × 컬럼) 쌍을 점수화한 뒤 [점수 ↓ → FIELD_ORDER → colIdx ↑] 순으로
     * 정렬해 필드·컬럼을 각각 1회씩 greedy 할당한다. 전역 최적에 가까운 결정적 매칭.
     */
    function computeAutoMapping(headers) {
        const normHeaders = (headers || []).map((h) => normalizeHeader(h));
        const candidates = [];
        for (const f of TARGET_FIELDS) {
            normHeaders.forEach((nh, colIdx) => {
                if (!nh || HEADER_DENYLIST.has(nh)) return;
                const score = scoreFieldHeader(f._autoNorm, nh);
                if (score > 0) candidates.push({ fieldKey: f.key, colIdx, score });
            });
        }
        candidates.sort((a, b) =>
            b.score - a.score ||
            FIELD_ORDER.get(a.fieldKey) - FIELD_ORDER.get(b.fieldKey) ||
            a.colIdx - b.colIdx
        );
        const mapping = {};
        const usedCols = new Set();
        for (const c of candidates) {
            if (mapping[c.fieldKey] != null || usedCols.has(c.colIdx)) continue;
            mapping[c.fieldKey] = c.colIdx;
            usedCols.add(c.colIdx);
        }
        return mapping;
    }

    /**
     * 교차 필드 동일 키워드 점검(개발 보조). 두 필드 이상에 같은 정규화 키워드가
     * 등록되면 동점이 FIELD_ORDER로만 갈리므로, 의도치 않은 중복을 콘솔 경고로 노출한다.
     * @returns {string[]} 중복 키워드 설명 목록 (없으면 빈 배열)
     */
    function auditDuplicateKeywords() {
        const seen = new Map();
        for (const f of TARGET_FIELDS) {
            for (const { nk } of f._autoNorm) {
                if (!seen.has(nk)) seen.set(nk, []);
                seen.get(nk).push(f.key);
            }
        }
        const dups = [];
        for (const [nk, keys] of seen) {
            if (keys.length > 1) dups.push(`${nk} → [${keys.join(', ')}]`);
        }
        if (dups.length) logWarn('[자동매핑] 교차 필드 중복 키워드(우선순위 FIELD_ORDER 적용):', dups.join(' / '));
        return dups;
    }

    // ============================================================
    // 접수번호 채번 (순수 함수, DOM/매니저 비의존 · 단위 테스트 대상)
    // ============================================================

    /**
     * 기존 레코드에서 "같은 경지구분1차 + 같은 시퀀스" 범위의 접수번호 집합.
     *
     * 시퀀스 분리는 **접수번호 표기** 기준이다 (SLS-1-223) — `subCategory`를 보지 않는다.
     * 규칙을 복제하지 않고 `reception-number.js`의 헬퍼(`baseOf`·`isFillNotation`)를
     * 직접 호출하므로 `computeNextNumber`와 어긋날 수 없다.
     *
     * 전수성: 모든 레코드가 정확히 한 풀에 들어간다. 이 조건이 깨지면
     * 어느 풀에도 없는 레코드의 번호가 재발급된다.
     */
    function collectExistingNumbers(logs, landClass1, opts) {
        const fill = !!(opts && opts.fill);
        const target = landClass1 || LAND_CLASS1_DEFAULT;
        const RN = window.ReceptionNumber;
        const set = new Set();
        for (const log of (logs || [])) {
            if (!log || !log.receptionNumber) continue;
            if ((log.landClass1 || LAND_CLASS1_DEFAULT) !== target) continue;
            const base = RN.baseOf(log.receptionNumber);
            // 시퀀스 분리는 **표기 기준**이다 (SLS-1-223) — computeNextNumber와 같은 판별자.
            // 헬퍼를 직접 쓰므로 규칙이 어긋날 수 없다.
            if (fill !== RN.isFillNotation(base)) continue;
            set.add(fill ? base.slice(1) : base);
        }
        return set;
    }

    /**
     * 기존 레코드의 접수번호 **본번 표기 그대로**의 집합 (경지구분1차 범위).
     *
     * 자동채번 풀(collectExistingNumbers)과 목적이 다르다:
     *  - 자동채번 풀은 매니저 computeNextNumber를 따라 시퀀스를 분리하고 F를 떼거나 제외한다
     *  - 이 함수는 **수동 입력 번호의 중복 판정**용이라 표기를 그대로 둔다
     *
     * 수동 번호 중복은 시퀀스와 무관하게 판정해야 한다. 폼 등록 경로도 그렇게 한다
     * (`soil-script.js`의 `logBaseNumber === numToCheck` — subCategory를 보지 않는다).
     * 시퀀스별로 나눠 판정하면 구분='성토' 행에 수동 번호 `5`를 주었을 때
     * 일반 `5`와 충돌하는 것을 놓쳐 같은 번호가 두 건 저장된다.
     * `F5`와 `5`는 표기가 달라 서로 충돌하지 않는다 — 그것이 이 함수가 표기를 보존하는 이유다.
     */
    function collectLiteralNumbers(logs, landClass1) {
        const target = landClass1 || LAND_CLASS1_DEFAULT;
        const set = new Set();
        for (const log of (logs || [])) {
            if (!log || !log.receptionNumber) continue;
            if ((log.landClass1 || LAND_CLASS1_DEFAULT) !== target) continue;
            set.add(String(log.receptionNumber).split('-')[0].trim());
        }
        return set;
    }

    /** 매핑된 컬럼의 셀 값 (미매핑이면 빈 문자열) */
    function cellOf(row, mapping, key) {
        const idx = mapping[key];
        if (idx == null || idx < 0) return '';
        return String(row[idx] ?? '').trim();
    }

    /** 한 행 → 접수 레코드 (매핑되지 않은 필드는 빈 문자열) */
    /**
     * 주소 문자열 앞의 '(NNNNN) ' 우편번호 접두를 떼어낸다 (SLS-1-226).
     *
     * 정규식은 라벨 추출(soil-script.js:3269)과 **같은 형태**여야 한다 —
     * 여기서 만든 address를 거기서 다시 읽기 때문이다.
     */
    /** 전각 괄호·숫자를 ASCII로. 길이가 1:1로 유지되어 원본을 같은 위치에서 자를 수 있다. */
    function toAsciiDigits(str) {
        return String(str || '')
            .replace(/（/g, '(').replace(/）/g, ')')
            .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    }

    function splitPostcodePrefix(road) {
        const raw = String(road || '');
        // ⚠️ 엑셀 자료에는 전각 괄호·숫자와 괄호 안 공백이 섞여 들어온다(codex 리뷰 MINOR).
        //    '（３６６２８） 주소', '( 36628 ) 주소' 같은 형태를 놓치면 우편번호가 조용히 빈다.
        //    정규화는 **판정에만** 쓰고 잘라낸 나머지는 원본에서 가져온다 — 주소 본문을 바꾸지 않는다.
        const m = toAsciiDigits(raw).match(/^\(\s*(\d{5})\s*\)\s*/);
        return m ? { zip: m[1], rest: raw.slice(m[0].length) } : { zip: '', rest: raw };
    }

    /**
     * 엑셀의 우편번호·농가주소로 앱 규약에 맞는 주소 3종을 만든다 (SLS-1-226).
     *
     * 규약(address.js:340-344): address = `(우편번호) 도로명주소`, 우편번호가 없으면 빈 문자열.
     *
     * ⚠️ 우편번호 출처가 둘이다. 사용자 자료 형태가 제각각이라 둘 다 받는다.
     *      ① '우편번호' 열 (5자리 숫자일 때만)
     *      ② 주소 앞의 '(NNNNN) ' 접두
     *    ①이 우선이다 — 열이 더 명시적이다. 이때 주소에 접두가 있어도 **떼어내고** 열 값을 쓴다
     *    (그래야 '(36628) (36628) …' 이중 접두가 안 생긴다).
     *
     * ⚠️ 5자리가 아닌 값(구 6자리 '123-456', 오타)은 우편번호로 쓰지 않는다.
     *    조용히 틀린 우편번호가 인쇄되는 것보다 비는 편이 낫다.
     *
     * ⚠️ addressRoad에는 접두를 뗀 순수 도로명을 넣는다 — 개별 입력의 roadInput도
     *    접두가 없고(address.js:302), 목록이 addressRoad를 그대로 보여주기 때문이다.
     */
    function buildAddressFields(rawPostcode, rawRoad) {
        const { zip: inlineZip, rest } = splitPostcodePrefix(rawRoad);
        const colZip = toAsciiDigits(rawPostcode).trim();
        const zip = /^\d{5}$/.test(colZip) ? colZip : inlineZip;
        const road = rest.trim();
        return {
            addressPostcode: zip,
            addressRoad: road,
            address: (zip && road) ? `(${zip}) ${road}` : '',
        };
    }

    /**
     * 자동조회 결과를 주소에 반영한다 (SLS-1-227).
     *
     * ⚠️ **결과를 rec에 넣어야 실제로 저장된다.** `_commit()`은 `it.rec`만 복사하므로,
     *    조회 결과를 미리보기 표시용으로만 들고 있으면 화면에는 보이는데 저장은 안 되는
     *    허깨비 기능이 된다 (codex 계획 리뷰 지적).
     *
     * ⚠️ 우편번호 열을 직접 적었으면 **그 값이 우선**이다. 조회는 보조 수단이지
     *    작업자가 적은 값을 덮어쓰는 장치가 아니다.
     *
     * ⚠️ 조회로 채울 때는 도로명도 JUSO 표기로 함께 바꾼다. 우편번호와 도로명은 짝이라,
     *    조회한 우편번호에 작업자가 적은 다른 표기를 붙이면 서로 어긋난 쌍이 된다.
     */
    function applyAddrLookup(addr, addrLookup) {
        const L = window.SoilAddressLookup;
        if (!addrLookup || !L || !addr.addressRoad || addr.addressPostcode) return addr;
        const hit = addrLookup.get(L.normalizeRoad(addr.addressRoad));
        if (!hit || hit.status !== 'ok') return addr;
        return {
            addressPostcode: hit.zip,
            addressRoad: hit.road,
            address: `(${hit.zip}) ${hit.road}`,
        };
    }

    function buildRecord(row, mapping, landClass1, addrLookup) {
        const get = (key) => cellOf(row, mapping, key);
        const addr = applyAddrLookup(
            buildAddressFields(get('addressPostcode'), get('addressRoad')),
            addrLookup
        );
        return {
            ...addr,
            name: get('name'),
            phoneNumber: get('phoneNumber'),
            lotAddress: get('lotAddress'),
            cropsDisplay: get('cropsDisplay'),
            area: get('area'),
            subCategory: get('subCategory'),
            purpose: get('purpose'),
            note: get('note'),
            businessRegNo: get('businessRegNo'),
            date: get('date'),
            landClass1,
        };
    }

    /**
     * 접수번호 접두와 구분의 불변식 검사 — `F` 접두 ⟺ 구분='성토'.
     *
     * 이 불변식이 깨진 레코드는 두 채번 풀 **어디에도 들어가지 않는다**
     * (일반 풀은 F 접두를 제외하고, 성토 풀은 구분이 성토가 아닌 것을 제외한다).
     * 그래서 뒤따르는 자동부여가 같은 번호를 다시 부여해도 아무 경고가 없다.
     * 실측 (SLS-1-222 적대적 검증):
     *   [성토 수동 '3', 일반 자동 ×3] → 3, 1, 2, 3   ← '3' 두 건
     *   [논 수동 'F1', 성토 자동 ×1]  → F1, F1        ← 미리보기에 이미 중복
     * 자동부여 쪽에서 표기 충돌을 피하게 하면 매니저의 채번과 어긋나므로
     * (매니저는 그 검사를 하지 않는다) 진입점에서 막는 것이 유일하게 정합적이다.
     *
     * @param {string} base 접수번호 본번 표기
     * @param {boolean} isFill 구분이 '성토'인가
     * @returns {string|null} 위반 사유, 정상이면 null
     */
    function namespaceViolation(base, isFill) {
        // 규칙은 reception-number.js 한 곳에만 둔다 (SLS-1-223)
        return window.ReceptionNumber.namespaceViolation(base, isFill);
    }

    /** 번호 집합에서 다음 번호를 추정한다 (매니저 미준비 시 폴백) */
    function inferNextNumber(existing) {
        let maxN = 0;
        existing.forEach((n) => {
            const v = parseInt(n, 10);
            if (!Number.isNaN(v) && v > maxN) maxN = v;
        });
        return maxN + 1;
    }

    /**
     * 파싱된 행 + 매핑 → 미리보기 항목·집계 (순수 함수).
     *
     * 반환 `null`은 "미리보기를 만들 수 없음"이다 — 행이 없거나, 매핑이 없거나,
     * 식별 필드(성명·지번주소·접수번호)가 하나도 매핑되지 않은 경우.
     *
     * @param {Object} o
     * @param {Array<Array<string>>} o.rows
     * @param {Object} o.mapping  { 필드키: 컬럼인덱스 }
     * @param {string} o.landClass1
     * @param {boolean} [o.autoNumber]
     * @param {'skip'|'overwrite'} [o.dupPolicy]
     * @param {Set<string>} [o.existing]      일반 시퀀스 기존 번호
     * @param {number|null} [o.nextNumber]    일반 시퀀스 시작 번호
     * @param {Set<string>} [o.existingFill]  성토 시퀀스 기존 번호
     * @param {number|null} [o.nextFillNumber] 성토 시퀀스 시작 번호(F 접두 없이)
     * @param {Set<string>} [o.existingLiteral] 수동 번호 중복 판정용 — 표기 그대로, 시퀀스 통합
     * @param {Array<Object>} [o.logs] 기존 레코드. 주면 위 세 풀을 여기서 도출한다(권장).
     *   개별 풀 인자는 단위 테스트 주입용이다.
     */
    function computePreview(o) {
        const rows = o.rows || [];
        const mapping = o.mapping || {};
        const landClass1 = o.landClass1 || LAND_CLASS1_DEFAULT;
        // 주소 자동조회 결과 (SLS-1-227). 정규화 주소 → 판정.
        // ⚠️ preview item이 아니라 **호출자가 소유한 맵**으로 받는다 —
        //    _recompute()가 preview를 통째로 다시 만들기 때문에 item에 붙이면 사라진다.
        const addrLookup = o.addrLookup instanceof Map ? o.addrLookup : null;
        const dupPolicy = o.dupPolicy || 'skip';
        // 세 풀은 항상 같은 로그에서 나와야 한다. `logs`를 주면 여기서 도출하므로
        // 호출부가 하나를 빠뜨릴 수 없다 — 빠뜨리면 그 검사가 조용히 사라진다
        // (SLS-1-222 리뷰에서 실제로 그렇게 중복 검사가 없어졌다).
        // 개별 풀 인자는 단위 테스트에서 특정 상태를 주입할 때만 쓴다.
        // logs를 줬는데 배열이 아니면(손상된 localStorage 등) 조용히 넘기지 않는다 —
        // 그러면 세 풀이 모두 비어 중복 검사가 사라진다.
        if (o.logs != null && !Array.isArray(o.logs)) {
            logWarn('[가져오기] computePreview: logs가 배열이 아님 — 중복 검사가 비어 있게 됩니다', o.logs);
        }
        const hasLogs = Array.isArray(o.logs);
        const existing = hasLogs ? collectExistingNumbers(o.logs, landClass1) : (o.existing || new Set());
        const existingFill = hasLogs ? collectExistingNumbers(o.logs, landClass1, { fill: true }) : (o.existingFill || new Set());
        // 수동 번호 중복 판정용 — 표기 그대로, 두 시퀀스 통합
        const existingLiteral = hasLogs ? collectLiteralNumbers(o.logs, landClass1) : (o.existingLiteral || new Set());

        const mappedKeys = Object.keys(mapping);
        // 최소 1개 식별 필드가 매핑돼야 의미 있음
        const hasIdentity = mapping.name != null || mapping.lotAddress != null || mapping.receptionNumber != null;
        if (rows.length === 0 || mappedKeys.length === 0 || !hasIdentity) return null;

        // 접수번호 컬럼이 매핑되지 않았으면 자동부여가 강제된다
        const autoAll = !!o.autoNumber || mapping.receptionNumber == null;

        // 커서는 autoAll이 아니어도 반드시 초기화한다 — 접수번호 컬럼은 매핑됐지만
        // 특정 행의 칸만 빈 경우에도 자동부여로 넘어가기 때문이다.
        // (초기화를 autoAll로 감싸면 그 행의 번호가 String(null) → 'null'이 된다 → SLS-1-222 부수)
        let nextNum = o.nextNumber != null ? o.nextNumber : inferNextNumber(existing);
        let nextFill = o.nextFillNumber != null ? o.nextFillNumber : inferNextNumber(existingFill);

        // 배치 내 사용 번호 — 두 시퀀스가 독립이므로 집합도 따로 둔다
        // (일반 5와 성토 F5는 충돌이 아니다)
        const seenInBatch = new Set();
        const seenFillInBatch = new Set();
        // 수동 번호 중복 판정용 배치 집합 (표기 그대로, 시퀀스 무관)
        const seenLiteralInBatch = new Set();

        const items = [];
        const stats = { total: rows.length, new: 0, dup: 0, err: 0 };

        rows.forEach((row) => {
            const get = (key) => cellOf(row, mapping, key);
            const rec = buildRecord(row, mapping, landClass1, addrLookup);

            // 식별 정보 없는 빈 행 → 오류
            if (!rec.name && !rec.lotAddress) {
                stats.err++;
                items.push({ status: 'err', reason: '성명·주소 없음', display: '(빈 행)', rec });
                return;
            }

            let recNo;
            let useAuto = autoAll;
            if (!useAuto) {
                recNo = get('receptionNumber');
                // 매핑은 있으나 그 칸이 빈 행은 자동부여로 넘긴다
                if (!recNo) useAuto = true;
            }

            // 성토는 F 접두의 별 시퀀스다. 이 분기가 없으면 성토 행에 일반 번호가 찍히고,
            // 저장된 성토 레코드는 일반 풀에서 제외돼 카운터가 전진하지 않아
            // 전 행이 같은 번호로 저장된다 (SLS-1-222).
            const isFill = rec.subCategory === '성토';
            const pool = isFill ? existingFill : existing;
            const seenPool = isFill ? seenFillInBatch : seenInBatch;

            if (useAuto) {
                // 기존·배치 양쪽을 피해 증가시킨다
                let candidate = isFill ? nextFill : nextNum;
                while (pool.has(String(candidate)) || seenPool.has(String(candidate))) candidate++;
                seenPool.add(String(candidate));
                recNo = isFill ? `F${candidate}` : String(candidate);
                // 뒤따르는 수동 행이 이 번호와 충돌하는 것을 감지해야 한다
                seenLiteralInBatch.add(recNo);
                if (isFill) nextFill = candidate + 1;
                else nextNum = candidate + 1;
                stats.new++;
                items.push({ status: 'new', display: recNo, rec: { ...rec, receptionNumber: undefined }, auto: true });
            } else {
                const base = String(recNo).split('-')[0].trim();

                // 접두와 구분이 어긋난 행은 반려한다 (사유는 namespaceViolation 주석 참조)
                const violation = namespaceViolation(base, isFill);
                if (violation) {
                    stats.err++;
                    items.push({ status: 'err', reason: violation, display: recNo, rec });
                    return;
                }

                // 중복 판정은 **표기 그대로, 시퀀스 무관**이다 (폼 등록 경로와 동일 규칙).
                // 시퀀스별로 나눠 판정하면 구분='성토' 행의 수동 번호 `5`가 일반 `5`와
                // 충돌하는 것을 놓쳐 같은 번호가 두 건 저장된다.
                const isDup = existingLiteral.has(base) || seenLiteralInBatch.has(base);
                const willBeSaved = !(isDup && dupPolicy === 'skip');
                seenLiteralInBatch.add(base);

                // 커서는 시퀀스별로 올린다 — 매니저가 그 시퀀스로 채번하기 때문이다.
                // 성토 시퀀스는 F를 떼고 숫자만 본다 (computeNextNumber와 동일).
                //
                // 저장되지 않는 행(건너뛰는 중복)의 번호는 배치 집합에도 넣지 않는다.
                // 넣으면 뒤따르는 자동부여 행이 그 번호를 피해 가면서 미리보기가
                // 실제 저장 번호보다 앞서 나간다 (미리보기 ≠ 저장).
                const key = isFill ? base.replace('F', '') : base;
                if (willBeSaved) seenPool.add(key);

                // 수동 번호가 실제로 저장되면 매니저의 max+1 채번이 그 번호를 넘어간다.
                // 미리보기 커서도 같이 올려야 뒤따르는 자동부여 행의 표시 번호가 실제와 맞는다
                // (기존 최대 10에 수동 50을 저장하면 다음 자동번호는 11이 아니라 51이다).
                if (willBeSaved) {
                    const baseNum = parseInt(key, 10);
                    if (!Number.isNaN(baseNum)) {
                        if (isFill) { if (baseNum + 1 > nextFill) nextFill = baseNum + 1; }
                        else if (baseNum + 1 > nextNum) nextNum = baseNum + 1;
                    }
                }

                if (isDup) {
                    stats.dup++;
                    items.push({
                        status: 'dup', display: recNo, skip: dupPolicy === 'skip',
                        rec: { ...rec, receptionNumber: recNo },
                    });
                } else {
                    stats.new++;
                    items.push({ status: 'new', display: recNo, rec: { ...rec, receptionNumber: recNo } });
                }
            }
        });

        // 실제 등록될 건수 = new + (덮어쓰기 정책의 dup)
        const willImport = items.filter(it =>
            it.status === 'new' || (it.status === 'dup' && !it.skip)
        ).length;

        return { items, stats, willImport, landClass1, addrLookup };
    }

    function escapeHtml(s) {
        if (window.escapeHTML) return window.escapeHTML(String(s ?? ''));
        return String(s ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') return window.showToast(msg, type);
        if (window.toast && typeof window.toast.show === 'function') return window.toast.show(msg, type);
        (type === 'error' ? console.error : console.log)('[가져오기]', msg);
    }

    function logWarn(...args) { (window.logger?.warn || console.warn)(...args); }
    function logErr(...args) { (window.logger?.error || console.error)(...args); }

    // ============================================================
    // 스코프드 스타일 (1회 주입)
    // ============================================================
    const STYLE_ID = 'soil-importer-style';
    const SRI_STYLE_CSS = `
.sri-overlay{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;
  background:rgba(15,23,42,.55);backdrop-filter:blur(3px);padding:24px 14px;overflow-y:auto}
.sri-overlay[hidden]{display:none}
.sri-dialog{font-family:'Noto Sans KR','Inter',system-ui,sans-serif;width:100%;max-width:1040px;margin:auto;
  background:#fff;border-radius:18px;box-shadow:0 30px 90px rgba(15,23,42,.32);overflow:hidden;
  border:1px solid #e2e8f0;display:flex;flex-direction:column;max-height:calc(100vh - 48px)}
.sri-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 24px;
  border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg,#f0fdf4 0%,#eff6ff 100%);flex:0 0 auto}
.sri-header h2{margin:0;font-size:1.18rem;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:9px}
.sri-close{border:1px solid #e2e8f0;background:#fff;border-radius:10px;width:36px;height:36px;cursor:pointer;
  font-size:1rem;color:#64748b;transition:all .2s;display:flex;align-items:center;justify-content:center;line-height:1}
.sri-close:hover{background:#fef2f2;color:#ef4444;border-color:#fecaca}
.sri-body{padding:22px 24px;overflow-y:auto;flex:1 1 auto}
.sri-sec{margin-bottom:24px}
.sri-sec:last-child{margin-bottom:0}
.sri-sec>h3{font-size:.98rem;font-weight:600;margin:0 0 12px;color:#0f172a;display:flex;align-items:center;gap:8px}
.sri-stepnum{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;
  background:#22c55e;color:#fff;font-size:.74rem;font-weight:700;flex:0 0 auto}
.sri-help{font-size:.8rem;color:#64748b;margin:0 0 10px;line-height:1.5}
/* mode toggle */
.sri-mode{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.sri-mode label{flex:1;min-width:200px;display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px 16px;
  border:1.5px solid #e2e8f0;border-radius:12px;transition:all .2s;background:#fff}
.sri-mode label:hover{border-color:#bbf7d0}
.sri-mode label.active{border-color:#22c55e;background:#f0fdf4;box-shadow:0 2px 8px rgba(34,197,94,.12)}
.sri-mode input{accent-color:#22c55e;width:17px;height:17px;margin:0}
.sri-mt-title{font-weight:600;font-size:.92rem;color:#1e293b}
.sri-mt-sub{font-size:.76rem;color:#64748b;display:block;margin-top:1px}
/* dropzone */
.sri-dropzone{border:2px dashed #93c5fd;border-radius:14px;padding:28px 20px;text-align:center;
  background:linear-gradient(180deg,#f0f9ff,#fff);transition:all .2s;cursor:pointer}
.sri-dropzone:hover,.sri-dropzone.is-dragover{border-color:#3b82f6;background:#eff6ff}
.sri-dz-icon{font-size:2.2rem;display:block;margin-bottom:8px}
.sri-dz-main{font-weight:600;font-size:.94rem;margin-bottom:4px;color:#1e293b}
.sri-dz-sub{font-size:.8rem;color:#64748b}
.sri-dz-btn{margin-top:14px;border:none;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;
  padding:10px 22px;border-radius:10px;font-weight:600;cursor:pointer;font-size:.88rem;font-family:inherit}
.sri-dz-btn:hover{filter:brightness(1.05)}
/* 서식 다운로드 (SLS-1-225) — 모드 카드 2개와 경쟁하지 않게 낮은 채도로 둔다 */
.sri-tpl{margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sri-tpl-btn{border:1px solid #cbd5e1;background:#f8fafc;color:#334155;padding:7px 14px;
  border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit}
.sri-tpl-btn:hover{background:#f1f5f9;border-color:#94a3b8}
.sri-tpl-hint{font-size:.78rem;color:#94a3b8;flex:1;min-width:200px}
.sri-fileinfo{margin-top:12px;font-size:.84rem;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;
  border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:6px}
.sri-fileinfo[hidden]{display:none}
.sri-file-opts{display:flex;gap:12px;margin-top:14px;flex-wrap:wrap}
.sri-file-opts[hidden]{display:none}
.sri-fo{flex:1;min-width:150px}
.sri-fo label{font-size:.8rem;color:#475569;display:block;margin-bottom:5px;font-weight:500}
.sri-fo .sri-chk{display:flex;align-items:center;gap:7px;font-size:.84rem;color:#475569;cursor:pointer;margin-top:24px}
/* paste */
.sri-paste[hidden]{display:none}
.sri-paste textarea{width:100%;min-height:120px;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;
  font-family:'SF Mono',ui-monospace,Menlo,monospace;font-size:.82rem;resize:vertical;color:#1e293b;line-height:1.5}
.sri-paste textarea:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
.sri-paste .sri-chk{display:flex;align-items:center;gap:7px;font-size:.84rem;color:#475569;cursor:pointer;margin-top:10px}
/* selects/inputs */
.sri-dialog select,.sri-input{width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;
  font-family:inherit;font-size:.88rem;background:#fff;color:#1e293b;cursor:pointer}
.sri-dialog select:focus,.sri-input:focus{outline:none;border-color:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.12)}
.sri-chk input,.sri-radio input{accent-color:#22c55e;width:16px;height:16px;margin:0}
/* mapping */
.sri-maphead{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.sri-automap{border:1.5px solid #22c55e;background:#fff;color:#16a34a;padding:8px 16px;border-radius:10px;
  font-weight:600;cursor:pointer;font-size:.84rem;font-family:inherit;transition:all .2s;margin-left:auto}
.sri-automap:hover{background:#22c55e;color:#fff}
.sri-mapgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 16px}
.sri-maprow{display:flex;align-items:center;gap:8px}
/* 공익직불제 강조 (경지구분1차='공익직불제'일 때) */
.sri-mapgrid.gongik-active .sri-maprow--gongik{background:#ecfdf5;border:1.5px solid #22c55e;
  border-radius:10px;padding:8px 10px}
.sri-maprow--gongik .sri-gbadge{display:none;margin-left:6px;font-size:.66rem;font-weight:700;color:#fff;
  background:#22c55e;border-radius:8px;padding:1px 6px;white-space:nowrap}
.sri-mapgrid.gongik-active .sri-maprow--gongik .sri-gbadge{display:inline-flex;align-items:center}
.sri-maplabel{flex:0 0 78px;font-size:.83rem;color:#334155;font-weight:500}
.sri-maplabel .sri-opt{color:#94a3b8;font-weight:400;font-size:.74rem}
.sri-maparrow{color:#94a3b8;flex:0 0 auto}
.sri-maprow select{flex:1;min-width:0}
/* bulk landclass */
.sri-bulk{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#f0fdf4;border:1px solid #bbf7d0;
  border-radius:12px;padding:14px 18px}
.sri-bulk-label{font-weight:600;font-size:.9rem;flex:0 0 auto;color:#166534}
.sri-bulk select{flex:1;min-width:180px;max-width:240px}
.sri-bulk .sri-bulk-note{font-size:.8rem;color:#64748b}
/* options */
.sri-opts{display:flex;flex-direction:column;gap:10px}
.sri-chk,.sri-radio{display:flex;align-items:center;gap:9px;font-size:.88rem;cursor:pointer;color:#334155}
.sri-opt-sub{display:flex;gap:18px;padding-left:26px;margin-top:2px;flex-wrap:wrap}
.sri-muted{color:#64748b;font-size:.8rem}
/* preview */
.sri-pv-summary{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.sri-pill{padding:6px 14px;border-radius:20px;font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:6px}
.sri-pill.new{background:#dcfce7;color:#166534}
.sri-pill.dup{background:#fef3c7;color:#92400e}
.sri-pill.err{background:#fee2e2;color:#991b1b}
.sri-pv-empty{padding:18px;text-align:center;color:#94a3b8;font-size:.86rem;border:1px dashed #e2e8f0;border-radius:12px}
.sri-pv-wrap{border:1px solid #e2e8f0;border-radius:12px;overflow:auto;max-height:260px}
.sri-pv-table{margin:0;border-collapse:collapse;font-size:.8rem;min-width:640px;width:100%}
.sri-pv-table th{position:sticky;top:0;z-index:1;background:#f8fafc;font-weight:600;color:#334155;font-size:.76rem;
  padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.sri-pv-table td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155;white-space:nowrap}
.sri-pv-table tr:last-child td{border-bottom:0}
.sri-pv-table tr.is-dup td{background:#fffbeb}
.sri-pv-table tr.is-err td{background:#fef2f2}
.sri-pv-table td.is-addr-fail{color:#dc2626;font-weight:600}
.sri-btn-lookup{padding:9px 14px;border-radius:9px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;
  font-size:.86rem;font-weight:600;cursor:pointer}
.sri-btn-lookup:disabled{opacity:.5;cursor:not-allowed}
.sri-btn-lookup-cancel{border-color:#fecaca;background:#fef2f2;color:#b91c1c}
.sri-pv-table td.addr{white-space:normal;min-width:160px;max-width:240px}
.sri-status{padding:2px 9px;border-radius:12px;font-size:.72rem;font-weight:600;white-space:nowrap}
.sri-status.new{background:#dcfce7;color:#166534}
.sri-status.dup{background:#fef3c7;color:#92400e}
.sri-status.err{background:#fee2e2;color:#991b1b}
.sri-pv-overflow{padding:8px 10px;font-size:.78rem;color:#94a3b8;text-align:center}
/* footer */
.sri-footer{display:flex;align-items:center;gap:12px;padding:16px 24px;border-top:1px solid #e2e8f0;
  background:#f8fafc;flex:0 0 auto;flex-wrap:wrap}
.sri-footer-note{font-size:.83rem;color:#64748b}
.sri-spacer{flex:1}
.sri-btn-cancel{border:1.5px solid #e2e8f0;background:#fff;color:#475569;padding:10px 22px;border-radius:11px;
  font-weight:600;cursor:pointer;font-size:.9rem;font-family:inherit}
.sri-btn-cancel:hover{background:#f1f5f9}
.sri-btn-import{border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:10px 26px;
  border-radius:11px;font-weight:700;cursor:pointer;font-size:.9rem;font-family:inherit;
  box-shadow:0 4px 14px rgba(34,197,94,.3);display:flex;align-items:center;gap:7px}
.sri-btn-import:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 18px rgba(34,197,94,.4)}
.sri-btn-import:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.sri-btn-dlerr{border:1.5px solid #fca5a5;background:#fff1f2;color:#b91c1c;padding:10px 18px;border-radius:11px;
  font-weight:600;cursor:pointer;font-size:.88rem;font-family:inherit;transition:all .2s}
.sri-btn-dlerr:hover{background:#fee2e2;border-color:#f87171}
.sri-btn-dlerr[hidden]{display:none}
@media (max-width:880px){
  .sri-mapgrid{grid-template-columns:1fr 1fr}
}
@media (max-width:640px){
  .sri-mapgrid{grid-template-columns:1fr}
  .sri-body{padding:18px 16px}
  .sri-header,.sri-footer{padding:14px 16px}
  .sri-bulk select{max-width:none}
}
/* 다크 모드 */
[data-theme="dark"] .sri-dialog{background:#1c1917;border-color:rgba(148,163,184,.2)}
[data-theme="dark"] .sri-header{background:linear-gradient(135deg,rgba(34,197,94,.12),rgba(59,130,246,.1));
  border-bottom-color:rgba(148,163,184,.15)}
[data-theme="dark"] .sri-header h2{color:#f1f5f9}
[data-theme="dark"] .sri-close{background:#292524;border-color:#44403c;color:#a8a29e}
[data-theme="dark"] .sri-sec>h3{color:#e5e7eb}
[data-theme="dark"] .sri-help,[data-theme="dark"] .sri-muted,[data-theme="dark"] .sri-bulk-note{color:#a8a29e}
[data-theme="dark"] .sri-mode label{background:#292524;border-color:#44403c}
[data-theme="dark"] .sri-mode label.active{background:rgba(34,197,94,.12);border-color:#22c55e}
[data-theme="dark"] .sri-mt-title{color:#e5e7eb}
[data-theme="dark"] .sri-dropzone{background:linear-gradient(180deg,rgba(59,130,246,.08),#1c1917);border-color:#3b6ea5}
[data-theme="dark"] .sri-dz-main{color:#e5e7eb}
[data-theme="dark"] .sri-dialog select,[data-theme="dark"] .sri-input,[data-theme="dark"] .sri-paste textarea{
  background:#292524;color:#e5e7eb;border-color:#57534e}
[data-theme="dark"] .sri-maplabel,[data-theme="dark"] .sri-chk,[data-theme="dark"] .sri-radio,
[data-theme="dark"] .sri-fo label{color:#d6d3d1}
[data-theme="dark"] .sri-bulk{background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.25)}
[data-theme="dark"] .sri-bulk-label{color:#86efac}
[data-theme="dark"] .sri-pv-wrap{border-color:#44403c}
[data-theme="dark"] .sri-pv-table th{background:#292524;color:#d6d3d1;border-bottom-color:#44403c}
[data-theme="dark"] .sri-pv-table td{color:#d6d3d1;border-bottom-color:#332f2c}
[data-theme="dark"] .sri-pv-table tr.is-dup td{background:rgba(234,179,8,.08)}
[data-theme="dark"] .sri-pv-table tr.is-err td{background:rgba(239,68,68,.1)}
[data-theme="dark"] .sri-pv-table td.is-addr-fail{color:#f87171}
[data-theme="dark"] .sri-btn-lookup{border-color:#1e3a5f;background:#172554;color:#93c5fd}
[data-theme="dark"] .sri-btn-lookup-cancel{border-color:#7f1d1d;background:#450a0a;color:#fca5a5}
[data-theme="dark"] .sri-pv-empty{border-color:#44403c;color:#78716c}
[data-theme="dark"] .sri-footer{background:#231f1d;border-top-color:#44403c}
[data-theme="dark"] .sri-btn-cancel{background:#292524;color:#d6d3d1;border-color:#57534e}
[data-theme="dark"] .sri-btn-dlerr{background:#2d1515;border-color:#7f1d1d;color:#fca5a5}
[data-theme="dark"] .sri-btn-dlerr:hover{background:#3f1a1a;border-color:#ef4444}
[data-theme="dark"] .sri-mapgrid.gongik-active .sri-maprow--gongik{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.5)}
`;
    function injectStyle() {
        if (document.querySelector(`style[data-soil-importer]`)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.setAttribute('data-soil-importer', '');
        style.textContent = SRI_STYLE_CSS;
        document.head.appendChild(style);
    }

    // ============================================================
    // 모달 마크업 (1회 주입)
    // ============================================================
    const MODAL_ID = 'soilImporterModal';
    function soilModalInnerHtml(landOpts) {
        return `
<div class="sri-dialog" role="document">
  <header class="sri-header">
    <h2 id="sriTitle">📥 토양 시료 엑셀 가져오기</h2>
    <button type="button" class="sri-close" data-act="close" aria-label="닫기">✕</button>
  </header>
  <div class="sri-body">
    <!-- 1. 입력 방식 -->
    <section class="sri-sec">
      <h3><span class="sri-stepnum">1</span> 엑셀 데이터 입력</h3>
      <div class="sri-mode" role="radiogroup" aria-label="입력 방식">
        <label class="active" data-mode-label="file">
          <input type="radio" name="sriMode" value="file" checked>
          <span><span class="sri-mt-title">📤 엑셀 파일 업로드</span><span class="sri-mt-sub">권장 · .xlsx / .xls 드래그앤드롭</span></span>
        </label>
        <label data-mode-label="paste">
          <input type="radio" name="sriMode" value="paste">
          <span><span class="sri-mt-title">📋 텍스트 붙여넣기</span><span class="sri-mt-sub">엑셀 셀 복사 → 붙여넣기</span></span>
        </label>
      </div>
      <!-- file mode -->
      <div data-area="file">
        <div class="sri-dropzone" data-el="dropzone" tabindex="0" role="button" aria-label="엑셀 파일 선택">
          <input type="file" data-el="fileInput" accept=".xlsx,.xls,.csv" hidden>
          <span class="sri-dz-icon">⬆️</span>
          <div class="sri-dz-main">파일을 여기로 끌어다 놓으세요</div>
          <div class="sri-dz-sub">또는 아래 버튼으로 파일을 선택합니다 (.xlsx / .xls / .csv)</div>
          <button type="button" class="sri-dz-btn" data-act="pick">파일 선택</button>
        </div>
        <!-- 서식 다운로드 (SLS-1-225) — dropzone 아래, 파일 업로드 **전에** 보여야 한다.
             fileOpts는 파일 로드 후에야 hidden이 풀리므로 그 안에 두면 안 된다.
             문구는 구 모달(index.html:827)을 계승한다. -->
        <div class="sri-tpl">
          <button type="button" class="sri-tpl-btn" data-act="dlTemplate">📄 엑셀 서식 다운로드</button>
          <span class="sri-tpl-hint">서식에 맞춰 데이터를 입력하면 컬럼 매핑이 자동으로 됩니다. 경지구분별로 시트가 나뉘어 있습니다.</span>
        </div>
        <div class="sri-fileinfo" data-el="fileInfo" hidden></div>
        <div class="sri-file-opts" data-el="fileOpts" hidden>
          <div class="sri-fo">
            <label>시트 선택</label>
            <select data-el="sheetSelect"></select>
          </div>
          <div class="sri-fo">
            <label>헤더 행</label>
            <input type="number" class="sri-input" data-el="headerRow" min="1" value="1" title="헤더가 있는 행 번호">
          </div>
          <div class="sri-fo">
            <label class="sri-chk"><input type="checkbox" data-el="noHeader"> 헤더 없음</label>
          </div>
        </div>
      </div>
      <!-- paste mode -->
      <div class="sri-paste" data-area="paste" hidden>
        <textarea data-el="textarea" placeholder="엑셀에서 셀을 복사한 뒤 여기에 붙여넣으세요 (탭 구분)&#10;예) 성명&#9;연락처&#9;지번주소&#9;작물&#9;면적&#9;구분&#9;목적&#10;홍길동&#9;010-1234-5678&#9;봉화읍 내성리 123&#9;벼&#9;1200&#9;논&#9;일반재배"></textarea>
        <label class="sri-chk"><input type="checkbox" data-el="hasHeader" checked> 첫 행은 헤더입니다</label>
      </div>
    </section>

    <!-- 2. 컬럼 매핑 -->
    <section class="sri-sec">
      <div class="sri-maphead">
        <h3 style="margin:0"><span class="sri-stepnum">2</span> 컬럼 매핑</h3>
        <button type="button" class="sri-automap" data-act="automap">✨ 자동 매핑 추정</button>
      </div>
      <p class="sri-help">엑셀의 각 컬럼이 어느 접수 항목인지 지정하세요. 접수번호는 비우면 경지구분별 자동부여됩니다.</p>
      <div class="sri-mapgrid" data-el="mapGrid"></div>
    </section>

    <!-- 3. 경지구분 1차 -->
    <section class="sri-sec">
      <h3><span class="sri-stepnum">3</span> 경지구분 1차 일괄선택</h3>
      <div class="sri-bulk">
        <span class="sri-bulk-label">🏷️ 모든 행에 적용:</span>
        <select data-el="bulkLandClass" aria-label="경지구분 1차 일괄선택">${landOpts}</select>
        <span class="sri-bulk-note">가져오는 전체 행에 동일 적용됩니다</span>
      </div>
    </section>

    <!-- 4. 옵션 -->
    <section class="sri-sec">
      <h3><span class="sri-stepnum">4</span> 옵션</h3>
      <div class="sri-opts">
        <label class="sri-chk"><input type="checkbox" data-el="autoNumber" checked> 접수번호 자동부여 <span class="sri-muted">(경지구분별 독립 시퀀스)</span></label>
        <span class="sri-muted">중복 접수번호가 있을 때:</span>
        <div class="sri-opt-sub">
          <label class="sri-radio"><input type="radio" name="sriDup" value="skip" checked> 건너뛰기</label>
          <!-- '덮어쓰기'는 사실이 아니다 — _commit이 기존 레코드를 찾지 않고 추가만 한다 (SLS-1-222 리뷰) -->
          <label class="sri-radio"><input type="radio" name="sriDup" value="overwrite"> 그래도 추가 <span class="sri-muted">(같은 접수번호가 중복 등록됨)</span></label>
        </div>
      </div>
    </section>

    <!-- 5. 미리보기 -->
    <section class="sri-sec" style="margin-bottom:4px">
      <h3><span class="sri-stepnum">5</span> 미리보기</h3>
      <div class="sri-pv-summary" data-el="summary">
        <span class="sri-muted">데이터·컬럼 매핑을 지정하면 미리보기가 표시됩니다.</span>
      </div>
      <div data-el="previewBox"><div class="sri-pv-empty">아직 표시할 데이터가 없습니다.</div></div>
    </section>
  </div>
  <footer class="sri-footer">
    <span class="sri-footer-note" data-el="footerNote"></span>
    <span class="sri-spacer"></span>
    <button type="button" class="sri-btn-lookup" data-act="lookupAddr" hidden>📮 우편번호 자동조회</button>
    <button type="button" class="sri-btn-lookup sri-btn-lookup-cancel" data-act="lookupCancel" hidden>■ 조회 중지</button>
    <button type="button" class="sri-btn-dlerr" data-act="dlErrorCsv" hidden>⚠️ 오류 행 CSV</button>
    <button type="button" class="sri-btn-cancel" data-act="close">취소</button>
    <button type="button" class="sri-btn-import" data-act="import" disabled>📥 가져오기</button>
  </footer>
</div>`;
    }
    function buildModal() {
        let modal = document.getElementById(MODAL_ID);
        if (modal) return modal;

        const landOpts = LAND_CLASS1_OPTIONS.map(v =>
            `<option value="${v}"${v === LAND_CLASS1_DEFAULT ? ' selected' : ''}>${v}</option>`
        ).join('');

        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'sri-overlay';
        modal.hidden = true;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'sriTitle');
        modal.innerHTML = soilModalInnerHtml(landOpts);
        document.body.appendChild(modal);
        return modal;
    }

    // ============================================================
    // 클래스
    // ============================================================
    class SoilResultImporter {
        constructor() {
            this._els = null;
            this._built = false;
            this._state = this._initialState();
        }

        _initialState() {
            return {
                mode: 'file',
                // file
                fileName: '',
                sheets: {},
                sheetNames: [],
                activeSheet: '',
                headerRowIdx: 0,        // 0-based; -1 = 헤더 없음
                // paste
                rawText: '',
                hasHeader: true,
                // 공통
                fieldMapping: {},        // { fieldKey: colIdx }
                bulkLandClass: LAND_CLASS1_DEFAULT,
                autoNumber: true,
                dupPolicy: 'skip',       // 'skip' | 'overwrite'
                preview: null,
                // 주소 자동조회 결과 (SLS-1-227): 정규화 도로명 → { status, zip, road, reason }
                // ⚠️ preview 밖에 둔다. _recompute()가 preview를 통째로 다시 만들기 때문에
                //    item에 붙이면 구분·중복정책·매핑을 건드리는 순간 사라진다.
                //    캐시 역할도 겸한다 — 같은 주소를 두 번 조회하지 않는다.
                addrLookup: new Map(),
                addrLookupBusy: false,
            };
        }

        // ----------------------------------------------------------
        // 빌드 & 바인딩 (lazy)
        // ----------------------------------------------------------
        _ensureBuilt() {
            if (this._built) return;
            injectStyle();
            const modal = buildModal();
            const els = { modal };
            modal.querySelectorAll('[data-el]').forEach(node => {
                els[node.getAttribute('data-el')] = node;
            });
            this._els = els;
            this._bind();
            this._built = true;
        }

        _bind() {
            const m = this._els.modal;

            // 액션 버튼 (close/import/automap/pick) — 위임
            m.addEventListener('click', (e) => {
                const actEl = e.target.closest('[data-act]');
                if (!actEl || !m.contains(actEl)) return;
                const act = actEl.getAttribute('data-act');
                if (act === 'close') this.close();
                else if (act === 'import') this._commit();
                else if (act === 'automap') this._autoMap();
                else if (act === 'dlErrorCsv') this._downloadErrorCsv();
                else if (act === 'lookupAddr') this._lookupAddresses();
                else if (act === 'lookupCancel') this._state.addrLookupAbort?.abort();
                else if (act === 'dlTemplate') this._downloadTemplate();
                else if (act === 'pick') { e.stopPropagation(); this._els.fileInput?.click(); }
            });
            // 오버레이 클릭 → 닫기 (다이얼로그 내부 클릭은 무시)
            m.addEventListener('mousedown', (e) => { if (e.target === m) this.close(); });

            // 모드 토글
            m.querySelectorAll('input[name="sriMode"]').forEach(r => {
                r.addEventListener('change', () => { if (r.checked) this._switchMode(r.value); });
            });

            // 붙여넣기
            this._els.textarea?.addEventListener('input', () => {
                this._state.rawText = this._els.textarea.value;
                this._refresh();
            });
            this._els.hasHeader?.addEventListener('change', () => {
                this._state.hasHeader = this._els.hasHeader.checked;
                this._refresh();
            });

            // 파일 선택 / 드래그앤드롭
            this._els.fileInput?.addEventListener('change', (e) => {
                const f = e.target.files?.[0];
                if (f) this._handleFile(f);
                e.target.value = '';
            });
            const dz = this._els.dropzone;
            if (dz) {
                dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-dragover'); });
                dz.addEventListener('dragleave', () => dz.classList.remove('is-dragover'));
                dz.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dz.classList.remove('is-dragover');
                    const f = e.dataTransfer?.files?.[0];
                    if (f) this._handleFile(f);
                });
                dz.addEventListener('click', (e) => {
                    if (e.target.closest('[data-act="pick"]')) return; // 버튼이 별도 처리
                    this._els.fileInput?.click();
                });
                dz.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._els.fileInput?.click(); }
                });
            }

            // 시트 / 헤더 행 / 헤더 없음
            this._els.sheetSelect?.addEventListener('change', () => {
                this._state.activeSheet = this._els.sheetSelect.value;
                this._remapForNewHeaders();
            });
            this._els.headerRow?.addEventListener('input', () => {
                const v = parseInt(this._els.headerRow.value, 10);
                if (!Number.isNaN(v) && v >= 1) { this._state.headerRowIdx = v - 1; this._remapForNewHeaders(); }
            });
            this._els.noHeader?.addEventListener('change', () => {
                if (this._els.noHeader.checked) {
                    this._state.headerRowIdx = -1;
                    if (this._els.headerRow) this._els.headerRow.disabled = true;
                } else {
                    const v = parseInt(this._els.headerRow?.value || '1', 10);
                    this._state.headerRowIdx = Number.isNaN(v) ? 0 : Math.max(0, v - 1);
                    if (this._els.headerRow) this._els.headerRow.disabled = false;
                }
                // '헤더 없음'도 헤더를 바꾼다 — 실제 헤더 대신 '열 1, 열 2…'가 된다.
                // _refresh()만 하면 옛 매핑이 남아, 헤더 행이 데이터로 섞여 들어간
                // 상태에서 '성명'·'지번주소' 같은 글자가 접수 자료로 저장된다.
                this._remapForNewHeaders();
            });

            // 경지구분 1차 / 옵션
            this._els.bulkLandClass?.addEventListener('change', () => {
                this._state.bulkLandClass = this._els.bulkLandClass.value || LAND_CLASS1_DEFAULT;
                this._syncGongikHighlight();
                this._recompute(); this._renderPreview();
            });
            this._els.autoNumber?.addEventListener('change', () => {
                this._state.autoNumber = this._els.autoNumber.checked;
                this._refresh();
            });
            m.querySelectorAll('input[name="sriDup"]').forEach(r => {
                r.addEventListener('change', () => {
                    if (r.checked) { this._state.dupPolicy = r.value; this._recompute(); this._renderPreview(); }
                });
            });

            // ESC 닫기
            this._escHandler = (e) => {
                if (e.key === 'Escape' && !this._els.modal.hidden) this.close();
            };
        }

        // ----------------------------------------------------------
        // 열기/닫기
        // ----------------------------------------------------------
        open() {
            this._ensureBuilt();
            this._state = this._initialState();
            const e = this._els;
            // UI 리셋
            if (e.textarea) e.textarea.value = '';
            if (e.hasHeader) e.hasHeader.checked = true;
            if (e.fileInput) e.fileInput.value = '';
            if (e.fileInfo) { e.fileInfo.hidden = true; e.fileInfo.textContent = ''; }
            if (e.fileOpts) e.fileOpts.hidden = true;
            if (e.sheetSelect) e.sheetSelect.innerHTML = '';
            if (e.headerRow) { e.headerRow.value = '1'; e.headerRow.disabled = false; }
            if (e.noHeader) e.noHeader.checked = false;
            if (e.bulkLandClass) e.bulkLandClass.value = LAND_CLASS1_DEFAULT;
            if (e.autoNumber) e.autoNumber.checked = true;
            this._els.modal.querySelectorAll('input[name="sriMode"]').forEach(r => { r.checked = (r.value === 'file'); });
            this._els.modal.querySelectorAll('input[name="sriDup"]').forEach(r => { r.checked = (r.value === 'skip'); });
            this._switchMode('file');
            this._renderMapping();
            this._refresh();

            this._els.modal.hidden = false;
            document.addEventListener('keydown', this._escHandler);
            // 첫 포커스 → 닫기 버튼 (접근성)
            this._els.modal.querySelector('.sri-close')?.focus();
        }

        close() {
            if (!this._els?.modal) return;
            this._els.modal.hidden = true;
            document.removeEventListener('keydown', this._escHandler);
        }

        _switchMode(mode) {
            if (this._state.mode !== mode) {
                // 모드 전환 시 인덱스 기반 매핑 초기화 (의미가 다름)
                this._state.fieldMapping = {};
            }
            this._state.mode = mode;
            const m = this._els.modal;
            m.querySelector('[data-area="file"]').hidden = (mode !== 'file');
            m.querySelector('[data-area="paste"]').hidden = (mode !== 'paste');
            m.querySelectorAll('[data-mode-label]').forEach(lbl => {
                lbl.classList.toggle('active', lbl.getAttribute('data-mode-label') === mode);
            });
            if (mode === 'paste') this._els.textarea?.focus();
            this._refresh();
        }

        // ----------------------------------------------------------
        // 입력 파싱
        // ----------------------------------------------------------
        _parseInput() {
            return this._state.mode === 'file' ? this._parseFile() : this._parsePaste();
        }

        _parsePaste() {
            const text = this._state.rawText || '';
            if (!text.trim()) return { headers: [], rows: [], maxCol: 0 };
            const lines = text.split(/\r?\n/).filter(l => l.length > 0);
            const split = lines.map(l => l.split('\t'));
            const maxCol = split.reduce((mx, r) => Math.max(mx, r.length), 0);
            let headers, rows;
            if (this._state.hasHeader && split.length > 0) {
                headers = split[0].slice();
                rows = split.slice(1);
            } else {
                headers = Array.from({ length: maxCol }, (_, i) => `열 ${i + 1}`);
                rows = split;
            }
            rows = rows.map(r => {
                const padded = r.slice();
                while (padded.length < maxCol) padded.push('');
                return padded.slice(0, maxCol);
            });
            return { headers, rows, maxCol };
        }

        _parseFile() {
            const sheet = this._state.activeSheet ? this._state.sheets[this._state.activeSheet] : null;
            if (!sheet || !sheet.rows || sheet.rows.length === 0) return { headers: [], rows: [], maxCol: 0 };
            const allRows = sheet.rows;
            const maxCol = sheet.maxCol;
            const hIdx = this._state.headerRowIdx;
            let headers, rows;
            if (hIdx >= 0 && hIdx < allRows.length) {
                headers = (allRows[hIdx] || []).slice();
                rows = allRows.slice(hIdx + 1);
            } else {
                headers = Array.from({ length: maxCol }, (_, i) => `열 ${i + 1}`);
                rows = allRows;
            }
            rows = rows
                .map(r => {
                    const padded = (r || []).map(c => this._normalizeCell(c));
                    while (padded.length < maxCol) padded.push('');
                    return padded.slice(0, maxCol);
                })
                .filter(r => r.some(c => c !== '' && c != null));
            headers = headers.map(c => this._normalizeCell(c));
            while (headers.length < maxCol) headers.push('');
            headers = headers.slice(0, maxCol);
            return { headers, rows, maxCol };
        }

        _normalizeCell(value) {
            if (value == null) return '';
            if (value instanceof Date && !Number.isNaN(value.getTime())) {
                const y = value.getFullYear();
                const mo = String(value.getMonth() + 1).padStart(2, '0');
                const d = String(value.getDate()).padStart(2, '0');
                return `${y}-${mo}-${d}`;
            }
            return String(value);
        }

        // ----------------------------------------------------------
        // 파일 처리
        // ----------------------------------------------------------
        async _handleFile(file) {
            if (!file) return;
            const XLSX = window.XLSX;
            if (!XLSX) { toast('엑셀 라이브러리(XLSX)를 사용할 수 없습니다.', 'error'); return; }
            if (file.size > FILE_SIZE_HARD) {
                toast(`파일이 너무 큽니다 (${(file.size / 1048576).toFixed(0)}MB > 50MB 한계).`, 'error');
                return;
            }
            if (file.size > FILE_SIZE_WARN) {
                toast(`파일이 큰 편입니다 (${(file.size / 1048576).toFixed(1)}MB). 처리에 시간이 걸릴 수 있습니다.`, 'warning');
            }
            try {
                const buffer = await file.arrayBuffer();
                const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
                if (!wb.SheetNames || wb.SheetNames.length === 0) { toast('시트를 찾을 수 없습니다.', 'error'); return; }
                const sheets = {};
                const sheetNames = [];
                for (const name of wb.SheetNames) {
                    const ws = wb.Sheets[name];
                    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
                    const maxCol = aoa.reduce((mx, r) => Math.max(mx, (r || []).length), 0);
                    sheets[name] = { rows: aoa, maxCol };
                    sheetNames.push(name);
                }
                this._state.fileName = file.name;
                this._state.sheets = sheets;
                this._state.sheetNames = sheetNames;
                this._state.activeSheet = sheetNames[0];
                this._state.headerRowIdx = 0;
                this._state.fieldMapping = {};

                // paste 모드에서 파일 드롭 시 file 모드로 전환
                if (this._state.mode !== 'file') {
                    this._state.mode = 'file';
                    this._els.modal.querySelectorAll('input[name="sriMode"]').forEach(r => { r.checked = (r.value === 'file'); });
                    this._els.modal.querySelector('[data-area="file"]').hidden = false;
                    this._els.modal.querySelector('[data-area="paste"]').hidden = true;
                    this._els.modal.querySelectorAll('[data-mode-label]').forEach(lbl => {
                        lbl.classList.toggle('active', lbl.getAttribute('data-mode-label') === 'file');
                    });
                }

                if (this._els.fileInfo) {
                    this._els.fileInfo.innerHTML = `📄 <strong>${escapeHtml(file.name)}</strong> · 시트 ${sheetNames.length}개`;
                    this._els.fileInfo.hidden = false;
                }
                this._renderSheetSelect();
                if (this._els.headerRow) { this._els.headerRow.value = '1'; this._els.headerRow.disabled = false; }
                if (this._els.noHeader) this._els.noHeader.checked = false;
                if (this._els.fileOpts) this._els.fileOpts.hidden = false;

                this._refresh();
                // 자동 매핑 시도 (헤더가 있을 때 편의)
                this._autoMap(true);
                toast(`✅ ${file.name} 로드 완료 (시트 ${sheetNames.length}개)`, 'success');
            } catch (err) {
                logErr('엑셀 파일 파싱 실패:', err);
                toast('엑셀 파일을 읽을 수 없습니다.', 'error');
            }
        }

        _renderSheetSelect() {
            const sel = this._els.sheetSelect;
            if (!sel) return;
            sel.innerHTML = '';
            for (const name of this._state.sheetNames) {
                const opt = document.createElement('option');
                opt.value = name;
                const sheet = this._state.sheets[name];
                opt.textContent = `${name} (${sheet.rows.length}행)`;
                sel.appendChild(opt);
            }
            sel.value = this._state.activeSheet;
        }

        // ----------------------------------------------------------
        // 매핑 UI
        // ----------------------------------------------------------
        _renderMapping() {
            const grid = this._els.mapGrid;
            if (!grid) return;
            const { headers } = this._parseInput();
            grid.innerHTML = '';
            const frag = document.createDocumentFragment();
            for (const f of TARGET_FIELDS) {
                const row = document.createElement('div');
                row.className = 'sri-maprow' + (f.gongik ? ' sri-maprow--gongik' : '');
                const label = document.createElement('span');
                label.className = 'sri-maplabel';
                label.innerHTML = `${escapeHtml(f.label)}${f.optional ? '<span class="sri-opt"> (선택)</span>' : ''}` +
                    (f.gongik ? '<span class="sri-gbadge">공익직불제</span>' : '');
                const arrow = document.createElement('span');
                arrow.className = 'sri-maparrow';
                arrow.textContent = '→';
                const select = document.createElement('select');
                select.dataset.fieldKey = f.key;
                select.setAttribute('aria-label', `${f.label} 컬럼 매핑`);
                const emptyLabel = f.optional ? '(비움 · 자동부여)' : '(없음)';
                select.innerHTML = `<option value="-1">${emptyLabel}</option>` +
                    headers.map((h, i) =>
                        `<option value="${i}">${i + 1}열${h ? ` · ${escapeHtml(String(h).slice(0, 16))}` : ''}</option>`
                    ).join('');
                const cur = this._state.fieldMapping[f.key];
                select.value = (typeof cur === 'number' && cur >= 0) ? String(cur) : '-1';
                select.addEventListener('change', () => {
                    const v = parseInt(select.value, 10);
                    if (Number.isNaN(v) || v < 0) delete this._state.fieldMapping[f.key];
                    else this._state.fieldMapping[f.key] = v;
                    this._recompute(); this._renderPreview();
                });
                row.append(label, arrow, select);
                frag.appendChild(row);
            }
            grid.appendChild(frag);
            this._syncGongikHighlight();
        }

        /** 경지구분1차='공익직불제'면 매핑 그리드에 gongik-active 토글 */
        _syncGongikHighlight() {
            const grid = this._els?.mapGrid;
            if (!grid) return;
            const active = (this._state.bulkLandClass || LAND_CLASS1_DEFAULT) === '공익직불제';
            grid.classList.toggle('gongik-active', active);
        }

        _autoMap(silent) {
            const { headers } = this._parseInput();
            if (headers.length === 0) {
                if (!silent) toast('먼저 데이터를 입력/업로드하세요.', 'warning');
                return;
            }
            // 순수 매핑 로직은 computeAutoMapping()으로 분리(단위 테스트 대상).
            const mapping = computeAutoMapping(headers);
            this._state.fieldMapping = mapping;
            this._renderMapping();
            this._recompute(); this._renderPreview();
            const count = Object.keys(mapping).length;
            if (!silent) toast(`자동 매핑 ${count}건 적용`, count > 0 ? 'success' : 'warning');
        }

        // ----------------------------------------------------------
        // 미리보기 계산
        // ----------------------------------------------------------
        /**
         * 헤더가 달라졌으니 매핑을 새로 추정한다 (SLS-1-230).
         *
         * ⚠️ _autoMap()은 파일 로드 때 **한 번만** 돌고(:1305) 그때 헤더 행은 항상 1이다.
         *    시트나 헤더 행을 바꿔도 다시 돌지 않으면, 열 인덱스는 그대로인데 그 열의
         *    **의미가 달라져** 매핑이 엉뚱한 열을 가리킨다. 화면에는 매핑된 것처럼
         *    보이므로 조용하다 — 헤더가 몇 행인지 지정해야 하는 서식에서 특히 위험하다.
         *
         * ⚠️ 직접 고친 매핑이 지워진다. 그래도 이게 맞다 — 헤더가 바뀌면 그 매핑은
         *    어차피 다른 열을 가리킨다. 틀린 매핑을 남겨 두는 쪽이 더 나쁘다.
         */
        _remapForNewHeaders() {
            // ⚠️ _refresh() 뒤에 _autoMap()을 부르면 파싱·미리보기 계산이 **두 번** 돈다
            //    (_autoMap이 이미 _parseInput·_renderMapping·_recompute·_renderPreview를 한다).
            //    행이 수천 개인 파일에서 헤더 행을 한 칸 바꿀 때마다 두 배가 든다.
            const { headers } = this._parseInput();
            this._state.fieldMapping = headers.length ? computeAutoMapping(headers) : {};
            this._refresh();
        }

        _refresh() {
            this._renderMapping();
            this._recompute();
            this._renderPreview();
        }

        /** 현재 연도 범위의 기존 접수 레코드 (매니저 미준비 시 localStorage 폴백) */
        _existingLogs() {
            const mgr = window.soilManager;
            if (mgr && Array.isArray(mgr.sampleLogs)) return mgr.sampleLogs;
            const year = (mgr && mgr.selectedYear) || new Date().getFullYear();
            try {
                const raw = localStorage.getItem(`soilSampleLogs_${year}`);
                return raw ? JSON.parse(raw) : [];
            } catch (_) { return []; }
        }

        // 풀을 하나씩 뽑아 넘기는 진입점(_existingNumbers)은 두지 않는다.
        // computePreview가 logs에서 세 풀을 함께 도출한다 — 하나를 빠뜨리면
        // 그 검사가 조용히 사라지고, 그것이 이 티켓의 회귀 원인이었다.

        /**
         * 미리보기 재계산. 순수 계산은 computePreview()에 위임하고
         * 이 메서드는 매니저·상태에서 입력을 모으는 일만 한다.
         */
        _recompute() {
            const { rows } = this._parseInput();
            const landClass1 = this._state.bulkLandClass || LAND_CLASS1_DEFAULT;
            const mgr = window.soilManager;
            const year = (mgr && mgr.selectedYear) || new Date().getFullYear();

            // 일반과 성토(F 접두)는 완전히 분리된 채번이라 양쪽을 다 넘겨야 한다.
            // 한쪽만 넘기면 성토 행 미리보기가 실제 저장 번호와 어긋난다 (SLS-1-222).
            // 번호 풀은 computePreview가 이 로그에서 직접 도출한다 (하나를 빠뜨릴 수 없게)
            const logs = this._existingLogs();

            const nextNumber = (mgr && typeof mgr.getNextNumberForClass === 'function')
                ? mgr.getNextNumberForClass(year, landClass1)
                : null;
            // 매니저는 'F3' 문자열을 주므로 숫자만 뽑아 커서로 쓴다
            let nextFillNumber = null;
            if (mgr && typeof mgr.generateNextFillReceptionNumber === 'function') {
                const parsed = parseInt(String(mgr.generateNextFillReceptionNumber(landClass1)).replace('F', ''), 10);
                if (!Number.isNaN(parsed)) nextFillNumber = parsed;
            }

            this._state.preview = computePreview({
                rows,
                mapping: this._state.fieldMapping,
                landClass1,
                autoNumber: this._state.autoNumber,
                dupPolicy: this._state.dupPolicy,
                logs,
                nextNumber,
                nextFillNumber,
                addrLookup: this._state.addrLookup,
            });
        }

        // ----------------------------------------------------------
        // 미리보기 렌더
        // ----------------------------------------------------------
        _renderPreview() {
            const summary = this._els.summary;
            const box = this._els.previewBox;
            const importBtn = this._els.modal.querySelector('[data-act="import"]');
            const dlErrBtn = this._els.modal.querySelector('[data-act="dlErrorCsv"]');
            const note = this._els.footerNote;
            if (!summary || !box) return;

            const p = this._state.preview;
            if (!p) {
                summary.innerHTML = '<span class="sri-muted">데이터·컬럼 매핑을 지정하면 미리보기가 표시됩니다.</span>';
                box.innerHTML = '<div class="sri-pv-empty">성명 또는 지번주소 컬럼을 매핑하면 미리보기가 생성됩니다.</div>';
                if (importBtn) { importBtn.disabled = true; importBtn.textContent = '📥 가져오기'; }
                if (dlErrBtn) { dlErrBtn.hidden = true; dlErrBtn.textContent = '⚠️ 오류 행 CSV'; }
                // 미리보기가 없으면 조회 버튼도 감춘다 — 안 그러면 매핑 해제·모드 전환 후에도
                // 이전 버튼이 남아, 눌러도 아무 일이 없는 것처럼 보인다.
                this._updateLookupBtn(null);
                if (note) note.textContent = '';
                return;
            }

            summary.innerHTML =
                `<span class="sri-pill new">✅ 신규 ${p.stats.new}</span>` +
                `<span class="sri-pill dup">⚠️ 중복 ${p.stats.dup}</span>` +
                `<span class="sri-pill err">⛔ 오류 ${p.stats.err}</span>`;

            const shown = p.items.slice(0, PREVIEW_ROW_LIMIT);
            const labels = { new: '신규', dup: '중복', err: '오류' };
            const L = window.SoilAddressLookup;
            const lookupOf = (road) =>
                (p.addrLookup && L && road) ? p.addrLookup.get(L.normalizeRoad(road)) : null;
            const trs = shown.map(it => {
                const r = it.rec || {};
                const cls = it.status === 'dup' ? 'is-dup' : (it.status === 'err' ? 'is-err' : '');
                // 주소 자동조회 실패 → 그 셀만 붉게. 행 전체를 칠하지 않는다 —
                // tr.is-err(배경 붉음)과 뒤섞이면 "이 행은 안 들어간다"로 읽힌다.
                // 조회 실패는 가져오기를 막지 않는다.
                const la = lookupOf(r.addressRoad);
                const addrCls = (la && la.status !== 'ok') ? 'is-addr-fail' : '';
                const addrTitle = (la && la.status !== 'ok') ? ` title="${escapeHtml(la.reason)}"` : '';
                const statusBadge = `<span class="sri-status ${it.status}">${labels[it.status]}${it.skip ? ' · 건너뜀' : ''}</span>`;
                return `<tr class="${cls}">
                    <td>${statusBadge}</td>
                    <td>${escapeHtml(it.display ?? '')}</td>
                    <td>${escapeHtml(r.name ?? '')}</td>
                    <td>${escapeHtml(r.phoneNumber ?? '')}</td>
                    <td class="addr col-road ${addrCls}"${addrTitle}>${escapeHtml(r.addressRoad ?? '')}</td>
                    <td class="col-zip ${addrCls}">${escapeHtml(r.addressPostcode ?? '')}</td>
                    <td class="addr">${escapeHtml(r.lotAddress ?? '')}</td>
                    <td>${escapeHtml(r.cropsDisplay ?? '')}</td>
                    <td>${escapeHtml(r.area ?? '')}</td>
                    <td>${escapeHtml(p.landClass1 ?? '')}</td>
                    <td>${escapeHtml(r.subCategory ?? '')}</td>
                    <td>${escapeHtml(r.purpose ?? '')}</td>
                    <td>${escapeHtml(r.note ?? '')}</td>
                </tr>`;
            }).join('');

            const overflow = p.items.length > PREVIEW_ROW_LIMIT
                ? `<div class="sri-pv-overflow">… 외 ${p.items.length - PREVIEW_ROW_LIMIT}건 (전체 ${p.items.length}건은 가져오기 시 모두 처리)</div>`
                : '';

            box.innerHTML = trs
                ? `<div class="sri-pv-wrap"><table class="sri-pv-table">
                    <thead><tr><th>상태</th><th>접수번호</th><th>성명</th><th>연락처</th><th>농가주소</th><th>우편번호</th><th>지번주소</th><th>작물</th><th>면적</th><th>경지구분1차</th><th>구분</th><th>목적</th><th>비고</th></tr></thead>
                    <tbody>${trs}</tbody></table></div>${overflow}`
                : '<div class="sri-pv-empty">표시할 행이 없습니다.</div>';

            if (importBtn) {
                importBtn.disabled = p.willImport === 0;
                importBtn.textContent = p.willImport > 0 ? `📥 ${p.willImport}건 가져오기` : '📥 가져오기';
            }
            this._updateLookupBtn(p);
            if (dlErrBtn) {
                if (p.stats.err > 0) {
                    dlErrBtn.hidden = false;
                    dlErrBtn.textContent = `⚠️ 오류 행 CSV (${p.stats.err}건)`;
                } else {
                    dlErrBtn.hidden = true;
                    dlErrBtn.textContent = '⚠️ 오류 행 CSV';
                }
            }
            if (note) {
                const L2 = window.SoilAddressLookup;
                let addrNote = '';
                if (L2 && p.addrLookup?.size) {
                    const failed = p.items.filter(it => {
                        const h = it.rec?.addressRoad ? p.addrLookup.get(L2.normalizeRoad(it.rec.addressRoad)) : null;
                        return h && h.status !== 'ok';
                    }).length;
                    // 붉은색은 경고이지 차단이 아니다 — 그대로 가져와도 된다는 걸 분명히 적는다
                    if (failed > 0) addrNote = ` · 주소 확인 필요 ${failed}건(붉은 글자, 그대로 가져와도 됩니다)`;
                }
                note.textContent = `총 ${p.stats.total}건 중 ${p.willImport}건이 [${p.landClass1}]으로 등록됩니다${addrNote}`;
            }
        }

        // ----------------------------------------------------------
        // 저장 커밋
        // ----------------------------------------------------------
        _commit() {
            const p = this._state.preview;
            if (!p) return;
            const mgr = window.soilManager;
            if (!mgr || typeof mgr.addImportedRecord !== 'function') {
                toast('접수 매니저가 준비되지 않았습니다. 잠시 후 다시 시도하세요.', 'error');
                return;
            }

            let applied = 0, failed = 0;
            for (const it of p.items) {
                if (it.status === 'err') continue;
                if (it.status === 'dup' && it.skip) continue;
                try {
                    const rec = { ...it.rec };
                    // 자동부여 행은 receptionNumber 생략 → 매니저가 부여
                    if (it.auto) delete rec.receptionNumber;
                    mgr.addImportedRecord(rec);
                    applied++;
                } catch (err) {
                    failed++;
                    logErr('가져오기 레코드 저장 실패:', err, it.rec);
                }
            }

            const parts = [`✅ ${applied}건 가져오기 완료`];
            if (p.stats.dup > 0) parts.push(`중복 ${p.stats.dup}건`);
            if (p.stats.err > 0) parts.push(`오류 ${p.stats.err}건`);
            if (failed > 0) parts.push(`실패 ${failed}건`);
            toast(parts.join(' · '), failed > 0 ? 'warning' : 'success');
            this.close();
        }

        // ----------------------------------------------------------
        // 가져오기 기본 서식 다운로드 (SLS-1-225)
        // ----------------------------------------------------------
        _downloadTemplate() {
            // ⚠️ 이 파일은 IIFE라 XLSX 식별자가 스코프에 없다. _handleFile()(:1056-1057)과
            //    동일하게 지역 별칭 + 미존재 가드를 둔다. 없으면 ReferenceError로 죽는다.
            const XLSX = window.XLSX;
            if (!XLSX) { toast('엑셀 라이브러리를 사용할 수 없습니다.', 'error'); return; }
            try {
                const wb = XLSX.utils.book_new();
                for (const sheet of buildTemplateSheets()) {
                    // sanitizeExcelAoa: 수식 인젝션 방지. 셀이 전부 하드코딩 상수라 실제
                    // 위험은 낮지만 다른 내보내기 경로와 일관되게 둔다(구 구현도 동일).
                    const aoa = window.sanitizeExcelAoa
                        ? window.sanitizeExcelAoa([sheet.headers, ...sheet.rows])
                        : [sheet.headers, ...sheet.rows];
                    const ws = XLSX.utils.aoa_to_sheet(aoa);
                    ws['!cols'] = sheet.headers.map((h) => ({ wch: Math.max(12, h.length * 2 + 4) }));
                    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
                }
                XLSX.writeFile(wb, '토양_가져오기_서식.xlsx');
                toast('서식 파일을 다운로드했습니다.', 'success');
            } catch (err) {
                logErr('서식 다운로드 실패:', err);
                toast('서식 파일을 만들 수 없습니다.', 'error');
            }
        }

        // ----------------------------------------------------------
        // ----------------------------------------------------------
        // 우편번호 자동조회 (SLS-1-227)
        // ----------------------------------------------------------

        /** 조회 대상 도로명주소 목록 — 우편번호가 이미 있는 행은 제외한다 */
        _pendingAddrQueries(p) {
            const out = [];
            for (const it of (p?.items || [])) {
                const road = it.rec?.addressRoad;
                if (road && !it.rec.addressPostcode) out.push(road);
            }
            return out;
        }

        _updateLookupBtn(p) {
            const btn = this._els.modal.querySelector('[data-act="lookupAddr"]');
            const cancelBtn = this._els.modal.querySelector('[data-act="lookupCancel"]');
            if (!btn) return;
            const L = window.SoilAddressLookup;
            const busy = this._state.addrLookupBusy;
            if (cancelBtn) cancelBtn.hidden = !busy;

            // 농가주소를 매핑하지 않았으면 애초에 할 일이 없다 — 버튼도 숨긴다.
            const mapped = this._state.fieldMapping?.addressRoad != null;
            if (!mapped || !L) { btn.hidden = true; return; }
            btn.hidden = false;

            if (busy) { btn.disabled = true; return; }
            const blocked = L.unavailableReason();
            const pending = this._pendingAddrQueries(p).length;
            btn.disabled = !!blocked || pending === 0;
            btn.title = blocked || (pending === 0 ? '조회할 주소가 없습니다 (우편번호가 이미 채워져 있습니다).' : '');
            btn.textContent = pending > 0 ? `📮 우편번호 자동조회 (${pending}건)` : '📮 우편번호 자동조회';
        }

        async _lookupAddresses() {
            const L = window.SoilAddressLookup;
            if (!L || this._state.addrLookupBusy) return;

            const blocked = L.unavailableReason();
            if (blocked) { toast(blocked, 'error'); return; }

            const queries = this._pendingAddrQueries(this._state.preview);
            if (queries.length === 0) { toast('조회할 주소가 없습니다.', 'info'); return; }

            const note = this._els.footerNote;
            const abort = new AbortController();
            this._state.addrLookupAbort = abort;
            this._state.addrLookupBusy = true;
            this._updateLookupBtn(this._state.preview);

            let res;
            try {
                res = await L.lookupBatch(queries, {
                    cache: this._state.addrLookup,
                    signal: abort.signal,
                    onProgress: (done, total) => {
                        if (note) note.textContent = `우편번호 조회 중… ${done}/${total}`;
                    },
                });
            } catch (err) {
                logErr('[가져오기] 주소 조회 실패:', err);
                toast('주소 조회 중 오류가 발생했습니다.', 'error');
                res = null;
            } finally {
                this._state.addrLookupBusy = false;
                this._state.addrLookupAbort = null;
            }

            // 조회 결과를 rec에 반영하려면 다시 계산해야 한다 (computePreview가 읽는다)
            this._recompute();
            this._renderPreview();

            if (!res) return;
            if (res.fatal) { toast(res.fatal, 'error'); return; }

            // ⚠️ 진행률은 **주소 기준**(중복 제거)이다. 여기서 행을 세면
            //    "1/1 조회" 뒤에 "5건 채움"이 떠서 숫자가 서로 어긋나 보인다.
            const cache = this._state.addrLookup;
            let ok = 0, bad = 0;
            for (const key of new Set(queries.map((q) => L.normalizeRoad(q)))) {
                const hit = cache.get(key);
                if (!hit) continue;
                if (hit.status === 'ok') ok++; else bad++;
            }
            if (res.aborted) {
                toast(`조회를 중지했습니다. 주소 ${ok}건 채움 · ${bad}건 실패`, 'info');
            } else if (bad > 0) {
                toast(`주소 ${ok}건 채움 · ${bad}건은 확인이 필요합니다 (붉은 글자).`, 'warning');
            } else {
                toast(`주소 ${ok}건의 우편번호를 채웠습니다.`, 'success');
            }
        }

        // 오류 행 CSV 다운로드
        // ----------------------------------------------------------
        _downloadErrorCsv() {
            const items = this._state.preview?.items || [];
            const errs = items.filter(it => it.status === 'err');
            if (errs.length === 0) return;

            /** CSV 셀 이스케이프 (RFC 4180 + CSV 인젝션 방지) */
            function csvCell(val) {
                let s = String(val ?? '');
                // CSV 인젝션 방지: 수식 시작 문자 앞에 작은따옴표 삽입
                if (s.length > 0 && '=+-@|'.includes(s[0])) s = "'" + s;
                // 콤마·큰따옴표·개행이 포함되면 큰따옴표로 감싸고 내부 " → ""
                if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
                    s = '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }

            const header = ['성명', '연락처', '지번주소', '작물', '면적', '구분', '목적', '오류사유'];
            const lines = [header.map(csvCell).join(',')];
            for (const it of errs) {
                const r = it.rec || {};
                lines.push([
                    csvCell(r.name),
                    csvCell(r.phoneNumber),
                    csvCell(r.lotAddress),
                    csvCell(r.cropsDisplay),
                    csvCell(r.area),
                    csvCell(r.subCategory),
                    csvCell(r.purpose),
                    csvCell(it.reason),
                ].join(','));
            }

            const bom = '﻿';
            const csv = bom + lines.join('\r\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const a = document.createElement('a');
            a.href = url;
            a.download = `가져오기_오류행_${dateStr}.csv`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast(`오류 행 ${errs.length}건을 CSV로 저장했습니다.`, 'success');
        }
    }

    // ============================================================
    // 싱글턴 노출 + 버튼 연결
    // ============================================================
    function attachOpenButton() {
        const btn = document.getElementById('soilImportBtn');
        if (btn && !btn._sriBound) {
            btn._sriBound = true;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.SoilResultImporter.open();
            });
        }
    }

    const instance = new SoilResultImporter();
    window.SoilResultImporter = instance;

    // 단위 테스트용 순수 매핑 로직 노출 (DOM 비의존) — 외부 호출은 권장하지 않음
    instance._fns = {
        normalizeHeader, scoreFieldHeader, computeAutoMapping, auditDuplicateKeywords,
        // 접수번호 채번 (SLS-1-222) — 성토/일반 시퀀스 분리가 여기서 결정된다
        collectExistingNumbers, collectLiteralNumbers, computePreview,
        // 서식 생성 (SLS-1-225) — DOM·다운로드 부작용 없음
        buildTemplateSheets, fieldLabel,
        // 주소 조합 (SLS-1-226)
        buildRecord, buildAddressFields, splitPostcodePrefix, toAsciiDigits, applyAddrLookup,
    };

    // 로드 시 1회: 교차 필드 중복 키워드가 있으면 콘솔 경고(개발 보조)
    auditDuplicateKeywords();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachOpenButton);
    } else {
        attachOpenButton();
    }
})();
