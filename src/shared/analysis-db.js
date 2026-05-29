/**
 * @fileoverview 분석결과 저장소 (IndexedDB / Dexie)
 *
 * 흙토람 분석결과 등 시료별 검사 결과를 영속 저장한다.
 * 기존 localStorage(`soilTestResults_${year}`)의 5MB 한계를 회피하고,
 * 부분 업데이트 시 직렬화 비용을 줄이며, 향후 인덱스 기반 통계의 토대를 마련한다.
 *
 * 데이터 형상:
 *   row = { type, year, sampleKey, ...fields }  (예: { type:'soil', year:'2026', sampleKey:'parcel-1', pH:6.5, ec:0.3, ... })
 *   복합 PK: [type+year+sampleKey], 인덱스: type, year, [type+year]
 *
 * 마이그레이션:
 *   - 앱 첫 가동(또는 키 부재) 시 localStorage의 'soilTestResults_${year}'를 스캔해 IDB로 일괄 이관.
 *   - 멱등: 마이그레이션 완료 마커(`localStorage.analysis_db_migrated_v1`)로 재실행 방지.
 *   - localStorage 원본은 그대로 보존(rollback 안전).
 *
 * 공개 API: window.AnalysisDB
 *   - init(): Promise<void>                          — DB 오픈 + 자동 마이그레이션
 *   - getMap(type, year): Promise<Object>            — { [sampleKey]: {fields...} } 맵 반환
 *   - saveMap(type, year, map): Promise<void>        — 맵 전체 저장(연도 단위 upsert)
 *   - saveOne(type, year, sampleKey, fields): Promise<void> — 단일 시료 부분 upsert
 *   - deleteYear(type, year): Promise<void>          — 해당 연도 데이터 제거
 *   - isReady(): boolean                             — init 완료 여부
 *   - migrateFromLocalStorage(): Promise<{migrated:number}> — 수동 트리거(테스트용)
 */

import Dexie from 'dexie';

const DB_NAME = 'SampleAnalysisDB';
const TABLE = 'analysisResults';
const MIGRATION_FLAG = 'analysis_db_migrated_v1';
// 마이그레이션 대상 localStorage 키 패턴: `${type}TestResults_${year}` (현재 type=soil만 사용)
const LS_KEY_PATTERN = /^([a-zA-Z][a-zA-Z0-9]*)TestResults_(\d{4})$/;

const db = new Dexie(DB_NAME);
db.version(1).stores({
    // 복합 PK + type/year 인덱스
    [TABLE]: '[type+year+sampleKey], type, year, [type+year]'
});

let _ready = false;

async function init() {
    if (_ready) return;
    try {
        await db.open();
        _ready = true;
        // 자동 마이그레이션(fire-and-forget의 await 버전 — init 흐름 일부)
        if (!localStorage.getItem(MIGRATION_FLAG)) {
            const { migrated } = await migrateFromLocalStorage();
            try { localStorage.setItem(MIGRATION_FLAG, String(Date.now())); } catch { /* quota 무시 */ }
            (window.logger?.info || console.log)(`[AnalysisDB] localStorage→IDB 마이그레이션: ${migrated}건`);
        }
    } catch (e) {
        _ready = false;
        (window.logger?.error || console.error)('[AnalysisDB] init 실패:', e);
        throw e;
    }
}

function isReady() { return _ready; }

/**
 * 단일 type+year의 결과 맵 조회
 * @returns { [sampleKey]: { ...fields } } 형태(기존 localStorage 호환)
 */
async function getMap(type, year) {
    if (!_ready) return {};
    const rows = await db.table(TABLE).where({ type: String(type), year: String(year) }).toArray();
    const map = {};
    for (const row of rows) {
        const { type: _t, year: _y, sampleKey, ...fields } = row;
        map[sampleKey] = fields;
    }
    return map;
}

/**
 * type+year의 결과 맵 전체 저장(연도 단위 upsert).
 * 입력 맵에 없는 sampleKey는 삭제(연도 단위 전체 동기화 의미).
 */
async function saveMap(type, year, map) {
    if (!_ready) return;
    const t = String(type), y = String(year);
    const rows = Object.entries(map || {}).map(([sampleKey, fields]) => ({
        type: t, year: y, sampleKey: String(sampleKey),
        ...(fields && typeof fields === 'object' ? fields : {})
    }));
    await db.transaction('rw', db.table(TABLE), async () => {
        // 기존 동일 (type, year) 모두 삭제 → 신규 일괄 삽입 (연도 단위 동기화)
        await db.table(TABLE).where('[type+year]').equals([t, y]).delete();
        if (rows.length > 0) await db.table(TABLE).bulkPut(rows);
    });
}

/**
 * 단일 시료 부분 upsert(필드 병합 아님 — 전체 교체).
 * 부분 병합이 필요하면 호출 측에서 기존 객체를 합쳐 넘길 것.
 */
async function saveOne(type, year, sampleKey, fields) {
    if (!_ready) return;
    await db.table(TABLE).put({
        type: String(type), year: String(year), sampleKey: String(sampleKey),
        ...(fields && typeof fields === 'object' ? fields : {})
    });
}

async function deleteYear(type, year) {
    if (!_ready) return;
    await db.table(TABLE).where('[type+year]').equals([String(type), String(year)]).delete();
}

/**
 * localStorage 'soilTestResults_${year}' 패턴을 IDB로 일괄 이관.
 * 멱등: 동일 [type+year+sampleKey]는 put으로 덮어쓴다. localStorage 원본은 유지.
 * @returns {Promise<{migrated:number, scanned:number}>}
 */
async function migrateFromLocalStorage() {
    let migrated = 0, scanned = 0;
    if (!_ready) return { migrated, scanned };
    // 1단계: 모든 LS 키를 먼저 수집(반복 중 LS 변경에 강건). localStorage.key(i) 순서는
    // 브라우저별 미정의이므로 스냅샷 후 처리.
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
    }
    const rowsToInsert = [];
    for (const key of allKeys) {
        const m = key.match(LS_KEY_PATTERN);
        if (!m) continue;
        scanned++;
        const [, type, year] = m;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') continue;
            for (const [sampleKey, fields] of Object.entries(data)) {
                rowsToInsert.push({
                    type: String(type), year: String(year), sampleKey: String(sampleKey),
                    ...(fields && typeof fields === 'object' ? fields : {})
                });
            }
        } catch (e) {
            (window.logger?.warn || console.warn)(`[AnalysisDB] ${key} 파싱 실패:`, e);
        }
    }
    // 2단계: 트랜잭션으로 일괄 삽입(중간 실패 시 일부만 들어가는 부분 상태 방지)
    if (rowsToInsert.length > 0) {
        await db.transaction('rw', db.table(TABLE), async () => {
            await db.table(TABLE).bulkPut(rowsToInsert);
        });
        migrated = rowsToInsert.length;
    }
    return { migrated, scanned };
}

// 전역 노출 (heuktoram-script.js 등 비-모듈 스크립트가 사용)
window.AnalysisDB = { init, isReady, getMap, saveMap, saveOne, deleteYear, migrateFromLocalStorage };
