/**
 * 토양 시료 로그 레코드 빌더 (순수 팩토리 · 단위 테스트 대상)
 *
 * submitForm의 4개 분기(그룹수정/신규 × 작물분할/단일)에 거의 동일하게 중복되던
 * 레코드 객체 리터럴을 단일화한다. 모드별 차이는 opts로 흡수해 동작을 그대로 보존:
 *   - isGroupEdit=true  : 그룹 수정 — existingLog에서 id/createdAt/isComplete/
 *                         businessRegNo/gongikOrder/gongikBaseYear/basePnu 보존
 *   - isGroupEdit=false : 신규 등록 — gongik/createdAt 등은 호출측 commonData에 포함
 *   - crop 지정         : 한 필지 다중작물 분할 모드(작물별 1건, subLots 미복제)
 *   - crop 미지정       : 필지 단위 1건(작물 전체 합산)
 *
 * @global window.SoilLogRecord
 */
(function () {
    'use strict';

    function newId(fallback) {
        return (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : fallback;
    }

    /**
     * 레코드 1건 생성.
     * @param {Object} parcel - 필지 { lotAddress, isMountain, subLots, crops, category, purpose, note }
     * @param {Object} opts
     * @param {string} opts.receptionNumber
     * @param {Object} opts.commonData     - 폼 공통 데이터(모드별 구성 다름, 그대로 spread)
     * @param {string} opts.groupId
     * @param {number} opts.index          - 0-based 필지 인덱스
     * @param {number} opts.totalParcels
     * @param {Object} [opts.crop]         - 분할 모드의 단일 작물 (없으면 필지 단위)
     * @param {number} [opts.cropIndex]    - 0-based 작물 인덱스 (분할 모드)
     * @param {boolean} [opts.isGroupEdit] - 그룹 수정 모드 여부
     * @param {Object} [opts.existingLog]  - 그룹 수정 시 보존할 기존 레코드(없을 수 있음)
     * @param {string} [opts.now]          - 생성 시각 ISO(미지정 시 호출 시점)
     * @returns {Object} 시료 로그 레코드
     */
    function buildSoilLogRecord(parcel, opts) {
        const o = opts || {};
        const common = o.commonData || {};
        const crop = o.crop || null;
        const isSplit = crop != null;
        const existingLog = o.existingLog;
        const nowISO = o.now || new Date().toISOString();

        const rec = {
            id: (existingLog && existingLog.id) || newId(nowISO),
            receptionNumber: o.receptionNumber,
            ...common,
            subCategory: parcel.category || common.subCategory,
            purpose: parcel.purpose || common.purpose,
            groupId: o.groupId,
            parcelIndex: o.index + 1,
            totalParcels: o.totalParcels,
            parcels: [{
                id: newId(nowISO),
                lotAddress: parcel.lotAddress,
                isMountain: parcel.isMountain || false,
                subLots: isSplit ? [] : [...parcel.subLots],
                crops: isSplit ? [{ ...crop }] : parcel.crops.map(c => ({ ...c })),
                category: parcel.category || '',
                purpose: parcel.purpose || '',
                note: parcel.note || ''
            }],
            lotAddress: parcel.lotAddress,
            area: isSplit
                ? (parseFloat(crop.area) || 0).toString()
                : parcel.crops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0).toString(),
            cropsDisplay: isSplit
                ? (crop.name || '-')
                : (parcel.crops.map(c => c.name).join(', ') || '-')
        };

        if (isSplit) rec.cropIndex = o.cropIndex + 1;

        // 그룹 수정 모드: 기존 레코드에서 보존해야 하는 필드 (없으면 기본값)
        if (o.isGroupEdit) {
            rec.createdAt = (existingLog && existingLog.createdAt) || nowISO;
            rec.isComplete = (existingLog && existingLog.isComplete) || false;
            rec.businessRegNo = (existingLog && existingLog.businessRegNo) || '';
            rec.gongikOrder = (existingLog && existingLog.gongikOrder) || '1';
            rec.gongikBaseYear = (existingLog && existingLog.gongikBaseYear) || '';
            rec.basePnu = (existingLog && existingLog.basePnu) || '';
        }

        return rec;
    }

    /**
     * 필지 구분(category) 폴백 해석. 필지별 값 우선, 없으면 최상위 권위필드(subCategory).
     * 빌더 비대칭(parcels[0].category는 폼레벨 폴백이 없어 stub 가능)으로 생긴 빈 값을
     * 읽기측에서 복원한다. SLS-1-164의 검증된 1차 수정 대상.
     * @param {string} parcelCategory - parcels[0].category
     * @param {Object} log - 권위필드 보유 레코드(log.subCategory)
     * @returns {string}
     */
    function resolveParcelCategory(parcelCategory, log) {
        const v = (parcelCategory || '').trim();
        if (v) return v;
        const top = ((log && log.subCategory) || '').trim();
        return (top && top !== '-') ? top : '';
    }

    /**
     * 필지 용도(purpose) 폴백 해석. 필지별 값 우선, 없으면 최상위 권위필드(purpose).
     * @param {string} parcelPurpose - parcels[0].purpose
     * @param {Object} log - 권위필드 보유 레코드(log.purpose)
     * @returns {string}
     */
    function resolveParcelPurpose(parcelPurpose, log) {
        const v = (parcelPurpose || '').trim();
        if (v) return v;
        const top = ((log && log.purpose) || '').trim();
        return (top && top !== '-') ? top : '';
    }

    /**
     * 최상위 cropsDisplay/area로부터 작물 배열 복원(방어적 — 현재 정상 producer 없음).
     * 레거시/크로스프로젝트 on-disk stub(parcels[0].crops가 비었으나 최상위엔 값 존재)에서만
     * 발동. 면적은 합산값이라 단위 미보존·첫 작물 집중(best-effort).
     * @param {Object} log - log.cropsDisplay(쉼표구분 또는 '-'), log.area(숫자 문자열)
     * @returns {Array<{name:string, area:string}>}
     */
    function cropsFromDisplay(log) {
        const disp = ((log && log.cropsDisplay) || '').trim();
        if (!disp || disp === '-') return [];
        const names = disp.split(',').map(s => s.trim()).filter(Boolean);
        return names.map((name, i) => ({ name, area: i === 0 ? ((log && log.area) || '') : '' }));
    }

    window.SoilLogRecord = { buildSoilLogRecord, resolveParcelCategory, resolveParcelPurpose, cropsFromDisplay };
})();
