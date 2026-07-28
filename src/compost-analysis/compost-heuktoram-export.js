/**
 * 흙토람 「성분검사결과 일괄입력 양식」 내보내기 (SLS-1-200)
 *
 * 2026-07-27 수령 실물 양식을 그대로 재현한다.
 *   시트 `검정정보일괄입력` · 36열(A~AJ) · 병합 34개 · 헤더 4행 · 데이터 5행부터
 *
 * ⚠️ XLSX를 import하지 않는다.
 *   import하면 모듈 바인딩이 고정되어 테스트의 window.XLSX 교체 가로채기가 무력화된다.
 *   (SLS-1-194가 이 함정으로 침묵했다) 자유 변수로 두면 호출 시점에 window에서 해석된다.
 */
(function () {
    'use strict';

    const SHEET_NAME = '검정정보일괄입력';
    const COLS = 36;

    /** 1회 권장 상한 (양식 안내문) */
    const RECOMMENDED_MAX = 300;

    const TITLE = '성분검사결과 일괄입력 양식';

    /** 3행 대분류 — 인덱스 → 값 (없는 인덱스는 병합으로 덮인다) */
    const HEADER3 = {
        0: '용도구분', 1: '접수일자', 2: '대상지 주소', 6: '지번 구분', 7: '지번',
        9: '기타주소', 10: '시료번호', 11: '사업자등록번호', 12: '법인명', 13: '면적(㎡)',
        14: '업체명', 15: '업체번호', 16: '농가여부', 17: '연계구분', 18: '비고',
        19: '채취일자', 20: '생산일자', 21: '검사일자', 22: '비료관리법\n해당여부',
        23: '시료종류', 24: '축종', 25: '축종_비고\n(축종이 기타인 경우에만 입력)',
        26: '용도', 27: '부숙도_성적', 28: '함수율_성적', 29: '구리_성적', 30: '아연_성적',
        31: '염분_성적', 32: '질소', 33: '인산', 34: '칼리', 35: '최종검토의견',
    };

    /** 4행 소분류 */
    const HEADER4 = { 2: '시도', 3: '시군구', 4: '읍면동', 5: '리', 7: '지번1', 8: '지번2' };

    /** 병합 34개 (실물 실측) */
    const MERGES = [
        'A1:AJ1', 'A2:AJ2', 'C3:F3', 'H3:I3',
        'A3:A4', 'B3:B4', 'G3:G4', 'J3:J4', 'K3:K4', 'L3:L4', 'M3:M4', 'N3:N4',
        'O3:O4', 'P3:P4', 'Q3:Q4', 'R3:R4', 'S3:S4', 'T3:T4', 'U3:U4', 'V3:V4',
        'W3:W4', 'X3:X4', 'Y3:Y4', 'Z3:Z4', 'AA3:AA4', 'AB3:AB4', 'AC3:AC4',
        'AD3:AD4', 'AE3:AE4', 'AF3:AF4', 'AG3:AG4', 'AH3:AH4', 'AI3:AI4', 'AJ3:AJ4',
    ];

    /** 열 너비 wpx (실물 실측 36개) */
    const COL_WIDTHS = [138, 118, 138, 138, 138, 118, 118, 78, 78, 118, 118, 178,
        118, 118, 118, 118, 118, 194, 208, 118, 118, 118, 118, 138, 118, 278, 208,
        108, 108, 108, 108, 108, 108, 108, 108, 208];

    /**
     * 행 높이 — 2행 330.6은 안내문 전문 때문이다.
     * 재현하지 않으면 안내문이 잘린다.
     */
    const ROW_HEIGHTS = [30, 330.6, 17.4];

    /**
     * A2 안내문 전문 — **실물에서 그대로 추출한 20줄**.
     * 처음에 손으로 옮겨 적었다가 4줄이 누락되고 1줄이 잘렸다(전자인계·연계구분 관련).
     * 안내문은 검사자가 읽는 입력 규칙이므로 누락되면 안 된다.
     * 테스트가 fixture와 직접 대조한다.
     */
    const GUIDE = [
        "5번 행은 예시를 나타내는 행 입니다.",
        "아래 형식과 같이 입력되어야만 일괄입력을 할 수 있습니다. ",
        "  - 검정 대상지는 시도, 시군구, 읍면동, 리를 나눠 입력 ",
        "  - 지번구분은 일반은 빈공백으로 산은 산이라고 명시하며 검정대상지번은 지번1과 지번2로 나눠 입력 (지번2가 없을 경우 비워놓음)",
        "  - 사업자등록번호는 60자 이내로 입력하고, 형식에 맞게 입력 (ex. 111-11-11111)",
        "  - 면적은 가축분뇨 부숙도 의무검사 안내를 위하여 가축분퇴비일 경우 면적을 숫자로 입력 필수. 액비는 입력하지 않아도 됩니다. ",
        "  - 농가여부는 해당, 미해당 혹은 Y, N으로 입력 (농가여부 및 농가여부코드)",
        "  - 시료종류는 가축분퇴비, 가축분뇨발효액 혹은 01, 02로 입력 (시료종류명 및 시료코드)",
        "  - 축종은 돼지, 소·젖소, 닭·오리 등, 기타 혹은 01, 02, 03, 04로 입력 (축종명 및 축종코드)",
        "  - 축종을 04 혹은 기타로 입력했을 경우에만 축종_비고란을 입력할 수 있습니다.",
        "  - 용도구분은 액비처방용, 검사결과통보용 혹은 P, R로 입력 (용도구분명 및 용도구분코드)",
        "  - 용도구분이 액비처방용인 경우 시료종류는 가축분뇨발효액, 축종은 돼지, 소·젖소, 기타만 입력 가능합니다.",
        "  - 부숙도_성적은 미부숙, 부숙초기, 부숙중기, 부숙후기, 부숙완료 혹은 01, 02, 03, 04, 05로 입력 (부숙도명 및 부숙도코드)",
        "  - 비료관리법 해당여부는 해당, 미해당 혹은 Y, N으로 입력 (해당여부 및 해당여부코드) (해당일 경우에는 '비료관리법'에 따른 기준 적용 / 미해당일 경우에는 '가축분뇨법'에 따른 기준 적용)",
        "  - 최종검토의견은 100자 이내로 작성을 권장드립니다.",
        "  - (필독) 가축분뇨전자인계시스템에 액비처방서를 연계할 경우는 업체명, 업체번호를 정확하게 입력해 주십시오. 업체정보가 다를 경우 연계가 되지 않습니다. 업체번호는 10자 입니다.",
        "  - 연계구분은 자가액비, 가축분뇨연계액비 혹은 1, 2로 입력 (연계구분명 및 연계구분코드)  ※ (필독) 가축분뇨전자인계시스템에 액비처방서를 연계할 경우는 반드시 가축분뇨연계액비 혹은 2로 입력하십시오. ",
        "  - 시료종류를 가축분퇴비 혹은 01로 입력하였을 경우, 연계구분은 입력하지 않아도 됩니다.",
        "5번 내용을 삭제 후 작성하시기 바랍니다.",
        "원활한 일괄입력을 위하여 1회당 300건 이하의 자료 입력을 권장드립니다.",
    ].join('\n');

    /**
     * 축종 매핑 — 앱의 값 → 양식 코드값.
     * 폼의 `소`가 양식에서는 `소·젖소`다. 이 매핑이 없으면 흙토람이 거부한다.
     */
    const ANIMAL_MAP = {
        '돼지': '돼지',
        '소': '소·젖소',
        '소·젖소': '소·젖소',
        '닭·오리 등': '닭·오리 등',
    };

    /**
     * 부숙도 정규화. `완전부숙`은 어느 법령에도 없고 양식 5종에도 없다.
     * ⚠️ MATURITY_ORDER 값을 코드(01~05) 파생에 쓰지 말 것 —
     *    `완전부숙`이 `부숙완료`와 같은 순번이라 비가역이다. 별도 매핑을 둔다.
     */
    const MATURITY_MAP = {
        '미부숙': '미부숙', '부숙초기': '부숙초기', '부숙중기': '부숙중기',
        '부숙후기': '부숙후기', '부숙완료': '부숙완료',
        '완전부숙': '부숙완료',
    };

    function animalFor(animalType) {
        if (!animalType) return '';
        return ANIMAL_MAP[animalType] || '기타';
    }

    /** 축종_비고 — 양식은 기타일 때만 입력 가능하다 */
    function animalNoteFor(log) {
        const at = log.animalType || '';
        if (!at) return '';
        if (ANIMAL_MAP[at]) return '';
        // 매핑에 없는 값 = 기타로 보내고 원문을 비고에 남긴다
        return log.animalTypeOther || at;
    }

    /** 데이터 1행 (36열) */
    function buildRow(log, result) {
        const F = window.CompostFields;
        const addr = window.parseLotAddress(log.farmAddress || '');
        const areaSqm = F.getAreaInSqm(log.farmArea, log.farmAreaUnit);
        const r = result || {};
        const row = new Array(COLS).fill('');

        row[0] = '검사결과통보용';                 // 전자인계 미사용 → 고정
        row[1] = log.date || '';
        row[2] = addr.sido;
        row[3] = addr.sigungu;
        row[4] = addr.eupmyeondong;
        row[5] = addr.ri;
        row[6] = addr.isMountain ? '산' : '';      // 일반은 빈 공백
        row[7] = addr.jibun1;
        row[8] = addr.jibun2;
        row[9] = '';                               // 기타주소
        row[10] = log.receptionNumber || '';
        row[11] = log.businessNumber || '';
        row[12] = log.applicantType === '법인' ? (log.farmName || '') : '';
        row[13] = areaSqm > 0 ? String(areaSqm) : '';   // 실물은 전 셀을 텍스트로 저장한다
        row[14] = '';                              // 업체명 — 전자인계 미사용
        row[15] = '';                              // 업체번호 — 전자인계 미사용
        row[16] = log.isFarm || '';
        row[17] = '';                              // 연계구분 — 전자인계 미사용
        row[18] = log.note || '';
        row[19] = log.samplingDate || '';
        row[20] = log.productionDate || '';
        row[21] = r.testDate || '';
        row[22] = log.fertilizerLawApplies || '';
        row[23] = log.sampleType || '';
        row[24] = animalFor(log.animalType);
        row[25] = animalNoteFor(log);
        row[26] = log.purpose || '';
        row[27] = MATURITY_MAP[r.maturity] || '';
        row[28] = r.moisture ?? '';
        row[29] = r.copper ?? '';
        row[30] = r.zinc ?? '';
        row[31] = r.salinity ?? '';
        row[32] = r.nitrogen ?? '';
        row[33] = r.phosphorus ?? '';
        row[34] = r.potassium ?? '';
        row[35] = r.finalOpinion || '';
        return row;
    }

    /** 헤더 4행 + 데이터 행 */
    function buildAoa(rows, results) {
        const h3 = new Array(COLS).fill('');
        const h4 = new Array(COLS).fill('');
        for (const [i, v] of Object.entries(HEADER3)) h3[Number(i)] = v;
        for (const [i, v] of Object.entries(HEADER4)) h4[Number(i)] = v;

        const aoa = [
            [TITLE, ...new Array(COLS - 1).fill('')],
            [GUIDE, ...new Array(COLS - 1).fill('')],
            h3,
            h4,
        ];
        for (const row of rows) {
            aoa.push(buildRow(row.log, results[row.key]));
        }
        return aoa;
    }

    /**
     * 실물 서식 재현.
     *
     * 실물은 **모든 셀을 텍스트(numFmtId 49)** 로 저장한다 — 접수번호 `0101`처럼
     * 앞자리 0이 있는 값이나 지번이 숫자로 해석되어 변형되는 것을 막기 위해서다.
     * SheetJS 기본값은 숫자를 그대로 숫자 셀로 쓰므로 명시적으로 맞춘다.
     *
     * A2 안내문은 wrapText가 없으면 20줄이 한 줄로 뭉개져 읽을 수 없다.
     */
    function applyStyles(ws, rowCount) {
        const TEXT_FMT = '@';   // numFmtId 49

        // A1 제목
        if (ws['A1']) ws['A1'].s = {
            font: { bold: true, sz: 20, name: '맑은 고딕' },
            alignment: { horizontal: 'left', vertical: 'center' },
        };
        // A2 안내문 — wrapText 없으면 잘린다
        if (ws['A2']) ws['A2'].s = {
            font: { bold: true, sz: 10, color: { rgb: 'FFFF0000' }, name: '맑은 고딕' },
            alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        };

        const headerStyle = {
            font: { bold: true, sz: 11, name: '맑은 고딕' },
            fill: { patternType: 'solid', fgColor: { rgb: 'FFD9D9D9' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' },
            },
        };
        const dataStyle = {
            numFmt: TEXT_FMT,
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' },
            },
        };

        for (let r = 2; r < rowCount; r++) {
            for (let c = 0; c < COLS; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref]) ws[ref] = { t: 's', v: '' };
                ws[ref].s = (r <= 3) ? headerStyle : dataStyle;
                // 데이터 셀은 전부 텍스트 — 앞자리 0·지번이 숫자로 변형되지 않게
                if (r >= 4) { ws[ref].t = 's'; ws[ref].z = TEXT_FMT; }
            }
        }
    }

    function buildWorkbook(rows, results) {
        // ⚠️ sanitizeExcelAoa 필수 — 비고·최종검토의견·주소·축종비고가 자유 입력이라
        //    수식 인젝션 벡터다. 저장소의 다른 모든 엑셀 경로가 이걸 통과한다.
        const aoa = window.sanitizeExcelAoa
            ? window.sanitizeExcelAoa(buildAoa(rows, results))
            : buildAoa(rows, results);

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!merges'] = MERGES.map(r => XLSX.utils.decode_range(r));
        ws['!cols'] = COL_WIDTHS.map(wpx => ({ wpx }));
        ws['!rows'] = ROW_HEIGHTS.map(hpt => ({ hpt }));
        applyStyles(ws, aoa.length);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
        return wb;
    }

    /**
     * Q(농가여부)·W(비료관리법 해당여부) 열 드롭다운.
     * 실물 양식의 sqref를 그대로 쓴다 — `Q5:Q1048576`, `W5:W1048576`.
     */
    function buildDataValidations() {
        return [
            { sqref: 'Q5:Q1048576', options: ['해당', '미해당', 'Y', 'N'] },
            { sqref: 'W5:W1048576', options: ['해당', '미해당', 'Y', 'N'] },
        ];
    }

    function buildDataValidationsXml(validations) {
        const parts = validations.map(v =>
            '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"'
            + ` sqref="${v.sqref}">`
            + `<formula1>&quot;${v.options.join(',')}&quot;</formula1>`
            + '</dataValidation>'
        );
        return `<dataValidations count="${validations.length}">${parts.join('')}</dataValidations>`;
    }

    /**
     * SheetJS는 dataValidation을 쓰지 못하므로 생성된 xlsx(zip)의 sheet XML에 직접 주입한다.
     * ⚠️ window.JSZip이 없으면 **조용히 건너뛴다** — entry에 JSZip을 넣어야 한다.
     */
    async function injectDataValidations(arrayBuffer, validations) {
        if (!validations || validations.length === 0) return arrayBuffer;
        const JSZip = window.JSZip;
        if (!JSZip) {
            (window.logger?.warn || console.warn)('JSZip 미사용 — 드롭다운 적용 생략');
            return arrayBuffer;
        }
        const zip = await JSZip.loadAsync(arrayBuffer);
        const p = 'xl/worksheets/sheet1.xml';
        const f = zip.file(p);
        if (!f) return arrayBuffer;

        let xml = await f.async('string');
        const dv = buildDataValidationsXml(validations);
        // Excel 스펙: dataValidations는 mergeCells 다음에 와야 한다
        // Excel 스펙: dataValidations는 mergeCells 뒤여야 한다.
        // sheetData 뒤에 넣으면 mergeCells보다 앞서 "복구가 필요합니다"가 뜬다 —
        // 잘못 넣느니 건너뛰는 편이 낫다(JSZip 부재 시와 같은 안전 실패).
        if (xml.indexOf('</mergeCells>') === -1) {
            (window.logger?.warn || console.warn)('mergeCells 없음 — 드롭다운 주입 생략');
            return arrayBuffer;
        }
        xml = xml.replace('</mergeCells>', '</mergeCells>' + dv);
        zip.file(p, xml);
        return await zip.generateAsync({ type: 'arraybuffer' });
    }

    function downloadBuffer(arrayBuffer, fileName) {
        const blob = new Blob([arrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /** 워크북 생성 → 유효성 주입 → 다운로드 */
    async function exportFile(rows, results, fileName) {
        const wb = buildWorkbook(rows, results);
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const patched = await injectDataValidations(buf, buildDataValidations());
        downloadBuffer(patched, fileName);
    }

    window.CompostHeuktoramExport = {
        SHEET_NAME, COLS, RECOMMENDED_MAX, MERGES, COL_WIDTHS, ROW_HEIGHTS,
        HEADER3, HEADER4, ANIMAL_MAP, MATURITY_MAP,
        animalFor, animalNoteFor, buildRow, buildAoa, buildWorkbook, applyStyles,
        buildDataValidations, buildDataValidationsXml, injectDataValidations,
        downloadBuffer, exportFile,
    };
})();
