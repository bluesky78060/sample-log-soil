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
                // 🚨 분할이어도 **주작물 레코드에는 하위 지번을 보존한다** (SLS-1-265).
                //    예전에는 분할이면 무조건 `[]`이라, 한 지번에 작물을 2개 넣고
                //    하위 지번도 넣으면 **입력한 지번이 경고 없이 사라졌다.**
                //    하위 지번은 접수대장 내보내기와 흙토람 업로드에도 행으로 나가므로
                //    흙토람에도 그 지번이 안 올라갔다.
                //    형제 레코드(503-1…)에는 붙이지 않는다 — 같은 지번이 두 번 나간다.
                subLots: (isSplit && o.cropIndex !== 0) ? [] : [...parcel.subLots],
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

        if (isSplit) {
            rec.cropIndex = o.cropIndex + 1;
            // 그 필지가 작물 몇 개로 나뉘었는지. 하위 지번 번호를 이만큼 밀어
            // 형제 레코드 번호와 겹치지 않게 한다 (SLS-1-265).
            rec.cropSplitCount = o.cropSplitCount;
        }

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
     * 그 레코드의 작물 분할 수 (SLS-1-265).
     *
     * 하위 지번 번호는 이 수만큼 밀어야 형제 레코드와 안 겹친다.
     * 작물 2개로 나뉜 503이면 형제가 503-1을 쓰므로 하위 지번은 503-2부터다.
     *
     * ⚠️ **없거나 이상한 값은 1로 본다.** 이 필드가 없는 레코드가 대부분이다
     *    (이 티켓 이전에 만들어진 것 전부). 1이면 예전 계산과 완전히 같아진다.
     * @param {Object} log
     * @returns {number} 1 이상의 정수
     */
    function cropSplitCountOf(log) {
        const n = Number(log && log.cropSplitCount);
        return Number.isInteger(n) && n >= 1 ? n : 1;
    }

    /**
     * 하위 지번의 표시 번호 (SLS-1-265).
     *
     * 목록·접수대장 내보내기·흙토람이 **이 함수 하나를 공유한다.**
     * 세 곳에서 각각 계산하면 화면마다 번호가 달라진다 — 접수번호는 성적서와
     * 흙토람으로 나가는 대외 식별자라 그러면 안 된다.
     *
     * @param {Object} log - 하위 지번을 가진 레코드
     * @param {number} subLotIdx - 0-based 하위 지번 순번
     * @returns {string} 예: 작물 1개면 `503-1`, 작물 2개로 나뉘었으면 `503-2`
     */
    function subLotDisplayNumber(log, subLotIdx) {
        const idx = Number(subLotIdx);
        const safeIdx = Number.isInteger(idx) && idx >= 0 ? idx : 0;
        return `${log.receptionNumber}-${cropSplitCountOf(log) + safeIdx}`;
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

    window.SoilLogRecord = { buildSoilLogRecord, resolveParcelCategory, resolveParcelPurpose,
        cropsFromDisplay, cropSplitCountOf, subLotDisplayNumber };
})();
