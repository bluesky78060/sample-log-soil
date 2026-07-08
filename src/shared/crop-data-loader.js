/**
 * @fileoverview 작물 데이터 자체 업로드/로딩 모듈 (SLS-1-179, 메인 SAMPL-1-126 이식)
 * @description 흙토람 작물정보 .xlsx를 클라이언트에서 파싱 → 로컬 JSON(envelope) +
 *              Firestore 백업으로 저장하고, 앱 기동 시 우선순위(Firestore 최신 → 로컬 파일 →
 *              번들 기본값 src/cropData.js)에 따라 window.CROP_DATA 를 교체한다.
 *
 * 로컬 파일 스키마(envelope): { data: [{code,name,category}], updatedAt: ISO8601, version: string }
 * - envelope 구조여야 "Firestore가 로컬보다 최신인지" 비교가 가능(여러 PC 자동 동기화의 전제).
 *
 * 순수 로직(parseCropRows / mapGroupToCategory)은 XLSX 없이 단위 테스트 가능하도록 분리했다.
 * soil은 파서에 `xlsx`(SheetJS)를 쓴다(soil-entry/settings-entry가 window.XLSX에 주입).
 */

const CROP_LOCAL_FILE = 'crop-data.json';

/**
 * 흙토람 작물구분(그룹) → src/cropData.js 카테고리 축약 매핑.
 * cropData.js 생성 시점(SLS-1-177 검증본)에 적용된 규칙과 동일하게 복제(드리프트 방지).
 * @param {string} group - 원본 작물구분
 * @returns {string} 축약된 카테고리
 */
function mapGroupToCategory(group) {
    const g = (group == null ? '' : String(group)).trim();
    const MAP = {
        '곡류(벼)': '곡류',
        '곡류(기타)': '곡류',
        '유지류': '유지작물',
        '인경채류': '양념채소',
        '경엽채류': '엽경채류',
        '기타': '기타',
        '미분류': '기타',
    };
    if (Object.prototype.hasOwnProperty.call(MAP, g)) return MAP[g];
    return g || '기타';
}

/**
 * sheet_to_json(header:1) 형태의 2차원 배열을 파싱 → [{code,name,category}].
 * 헤더 행은 내용으로 탐지(고정 행 수 스킵보다 견고). 표시여부 === '표시'만 채택.
 * @param {Array<Array<*>>} rows - 행 배열(각 행은 셀 배열)
 * @returns {Array<{code:string,name:string,category:string}>}
 * @throws {Error} 빈 파일 / 필수 컬럼 누락 / 표시 대상 없음
 */
function parseCropRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('엑셀 파일이 비어 있습니다.');
    }

    // 컬럼 매칭: 정확일치가 아닌 부분포함(substring)으로 탐지한다.
    // 실제 농진청 작물정보 파일 헤더가 '작물목록 표시여부'/'비료사용추천 발급여부'처럼
    // 접두어가 붙어 있어, 핵심 키워드 포함 여부로 매칭한다(메인 SAMPL-1-128 교훈 선반영).
    const COLS = {
        code: ['작물코드'],
        name: ['작물명'],
        show: ['표시여부'],
        group: ['작물구분'], // 선택(없으면 카테고리는 '기타' 폴백)
    };

    /** 행에서 각 논리 컬럼의 인덱스 해석. 미발견은 -1. */
    function resolveHeader(row) {
        const cells = (Array.isArray(row) ? row : []).map(c => (c == null ? '' : String(c)).trim());
        const findIdx = (cands) => cells.findIndex(cell => cell && cands.some(k => cell.includes(k)));
        return {
            code: findIdx(COLS.code),
            name: findIdx(COLS.name),
            show: findIdx(COLS.show),
            group: findIdx(COLS.group),
        };
    }

    let headerIdx = -1;
    let cols = null;
    const scanLimit = Math.min(rows.length, 10);
    for (let i = 0; i < scanLimit; i++) {
        const idx = resolveHeader(rows[i]);
        if (idx.code !== -1 && idx.name !== -1 && idx.show !== -1) {
            headerIdx = i;
            cols = idx;
            break;
        }
    }

    if (headerIdx === -1) {
        throw new Error('필수 컬럼(작물코드/작물명/표시여부)을 찾을 수 없습니다.');
    }

    const { code: codeCol, name: nameCol, show: showCol, group: groupCol } = cols;

    const result = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = Array.isArray(rows[i]) ? rows[i] : [];
        const show = (row[showCol] == null ? '' : String(row[showCol])).trim();
        if (show !== '표시') continue;

        const code = (row[codeCol] == null ? '' : String(row[codeCol])).trim();
        const name = (row[nameCol] == null ? '' : String(row[nameCol])).trim();
        if (!code || !name) continue;

        const group = groupCol !== -1 ? (row[groupCol] == null ? '' : String(row[groupCol])).trim() : '';
        result.push({ code, name, category: mapGroupToCategory(group) });
    }

    if (result.length === 0) {
        throw new Error('표시 대상 작물이 없습니다. 파일 형식을 확인하세요.');
    }
    return result;
}

/**
 * .xlsx ArrayBuffer → [{code,name,category}]. window.XLSX 필요.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Array<{code:string,name:string,category:string}>}
 */
function parseCropExcelFile(arrayBuffer) {
    if (!window.XLSX) {
        throw new Error('XLSX 모듈이 로드되지 않았습니다.');
    }
    const wb = window.XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames && wb.SheetNames[0];
    const sheet = sheetName && wb.Sheets[sheetName];
    if (!sheet) {
        throw new Error('엑셀 시트를 찾을 수 없습니다.');
    }
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return parseCropRows(rows);
}

// ========================================
// 로컬 파일 I/O (Electron 전용 — 웹 환경은 skip)
// ========================================

/** userData 하위 crop-data.json 절대 경로. 웹 환경이면 null. */
async function getLocalCropPath() {
    if (!window.electronAPI?.getAppPath) return null;
    const base = await window.electronAPI.getAppPath();
    if (!base) return null;
    return String(base).replace(/[\\/]+$/, '') + '/' + CROP_LOCAL_FILE;
}

/**
 * 로컬 envelope 읽기. 파일 없음/파싱 실패/웹 환경이면 null.
 * @returns {Promise<{data:Array,updatedAt:string,version:string}|null>}
 */
async function readLocalEnvelope() {
    try {
        const p = await getLocalCropPath();
        if (!p) return null;
        const res = await window.electronAPI.readFile(p);
        if (!res?.success) return null;
        const parsed = JSON.parse(res.content);
        return parsed && Array.isArray(parsed.data) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * 로컬 envelope 쓰기. 웹 환경이면 skip(에러 아님). 실패 시 throw.
 * @param {{data:Array,updatedAt:string,version:string}} envelope
 */
async function writeLocalEnvelope(envelope) {
    const p = await getLocalCropPath();
    if (!p) return { skipped: true };
    const res = await window.electronAPI.writeFile(p, JSON.stringify(envelope, null, 2));
    if (!res?.success) {
        throw new Error(res?.error || '파일 저장 실패');
    }
    return { success: true };
}

// ========================================
// 로딩 / 저장 오케스트레이션
// ========================================

/** envelope.data 로 window.CROP_DATA / CROP_CATEGORIES 교체 */
function applyCropData(data) {
    if (!Array.isArray(data) || data.length === 0) return;
    window.CROP_DATA = data;
    window.CROP_CATEGORIES = [...new Set(data.map(c => c.category))];
}

/**
 * 앱 기동 시 호출(fire-and-forget). 우선순위:
 *   Firestore(더 최신) → 로컬 파일 → 번들 기본값(아무것도 안 함).
 * 실패는 조용히 폴백하며 절대 앱 기동을 막지 않는다.
 */
async function loadCropDataOnStartup() {
    try {
        let effective = await readLocalEnvelope();

        // Firestore 조회(온라인/설정 시). isEnabled 가드는 firestore-db 내부 처리.
        try {
            const remote = await window.firestoreDb?.getCropDataConfig?.();
            if (remote && remote.updatedAt && Array.isArray(remote.data)) {
                const remoteNewer = !effective
                    || String(remote.updatedAt) > String(effective.updatedAt || '');
                if (remoteNewer) {
                    effective = remote;
                    // 로컬에도 반영(가능하면). 실패는 무시.
                    try { await writeLocalEnvelope(remote); } catch { /* noop */ }
                }
            }
        } catch { /* Firestore 실패는 조용히 폴백 */ }

        if (effective && Array.isArray(effective.data) && effective.data.length) {
            applyCropData(effective.data);
        }
        // 아무것도 없으면 번들 기본값(cropData.js) 그대로 유지.
    } catch {
        // 절대 기동을 막지 않음.
    }
}

/**
 * 파싱된 작물 배열을 envelope로 저장(로컬 + Firestore 백업) 후 즉시 반영.
 * 로컬 저장 실패는 에러(throw), Firestore 실패는 경고만.
 * @param {Array<{code,name,category}>} parsedArray
 * @param {string} versionLabel - 업로드 시각 기준 라벨(예: '2026-07-07')
 * @returns {Promise<{data:Array,updatedAt:string,version:string}>}
 */
async function saveCropDataUpload(parsedArray, versionLabel) {
    if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
        throw new Error('저장할 작물 데이터가 없습니다.');
    }
    const envelope = {
        data: parsedArray,
        updatedAt: new Date().toISOString(),
        version: versionLabel,
    };

    // 로컬 저장(실패 시 중단 — 부분 적용 방지)
    try {
        await writeLocalEnvelope(envelope);
    } catch (e) {
        throw new Error(`로컬 파일 저장에 실패했습니다: ${e.message}`);
    }

    // Firestore 백업(best-effort). 로컬과 동일 updatedAt을 넘겨, 업로드한 PC에서
    // 다음 기동 시 remote>local 로 오판정되어 로컬을 재기록하는 낭비를 막는다(리뷰 MINOR-1).
    try {
        await window.firestoreDb?.saveCropDataConfig?.(parsedArray, versionLabel, envelope.updatedAt);
    } catch (e) {
        (window.logger?.warn || console.warn)('작물 데이터 Firestore 백업 실패(무시 가능):', e);
    }

    // 즉시 반영(재시작 없이)
    applyCropData(parsedArray);
    return envelope;
}

window.CropDataLoader = {
    mapGroupToCategory,
    parseCropRows,
    parseCropExcelFile,
    getLocalCropPath,
    readLocalEnvelope,
    writeLocalEnvelope,
    applyCropData,
    loadCropDataOnStartup,
    saveCropDataUpload,
};
