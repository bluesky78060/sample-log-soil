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
    const LAND_CLASS1_OPTIONS = ['개량제', '전략', '직불', '자체', '기타', '친환경', '유기농', '무농약', 'GAP', '농가의뢰', '대표필지'];
    const LAND_CLASS1_DEFAULT = '농가의뢰';

    // 매핑 대상 접수 필드 (순서 = 매핑 UI 표시 순서)
    // key: record 필드명, label: UI 표시명, auto: 자동 매핑용 헤더 키워드(정규화)
    const TARGET_FIELDS = [
        { key: 'receptionNumber', label: '접수번호', optional: true, auto: ['접수번호', '번호', '연번', 'no'] },
        { key: 'name',            label: '성명',     auto: ['성명', '이름', '의뢰인', '농가명', '신청인', 'name'] },
        { key: 'phoneNumber',     label: '연락처',   auto: ['연락처', '전화', '휴대폰', '핸드폰', 'phone', 'tel', 'hp'] },
        { key: 'lotAddress',      label: '지번주소', auto: ['지번주소', '주소', '소재지', '필지', 'address', '지번'] },
        { key: 'cropsDisplay',    label: '작물',     auto: ['작물', '재배작물', '품목', 'crop'] },
        { key: 'area',            label: '면적',     auto: ['면적', '재배면적', '㎡', 'area'] },
        { key: 'subCategory',     label: '구분',     auto: ['구분', '지목', 'category'] },
        { key: 'purpose',         label: '목적',     auto: ['목적', '용도', 'purpose'] },
        { key: 'note',            label: '비고',     auto: ['비고', '메모', '참고', 'note', 'remark'] },
        // 공익직불제용 (선택)
        { key: 'businessRegNo',   label: '경영체등록번호', optional: true, auto: ['경영체등록번호', '경영체', '등록번호', 'businessregno', 'bizno', 'businessno'] },
        { key: 'basePnu',         label: 'BASEPNU',  optional: true, auto: ['basepnu', 'basepun', 'base_pnu', 'pnu', '필지고유번호', '직불신청pnu'] },
    ];

    // ============================================================
    // 헬퍼
    // ============================================================
    function normalizeHeader(text) {
        return String(text || '').replace(/[\s\r\n()㎡]/g, '').toLowerCase();
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
    function injectStyle() {
        if (document.querySelector(`style[data-soil-importer]`)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.setAttribute('data-soil-importer', '');
        style.textContent = `
.sri-overlay{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;
  background:rgba(15,23,42,.55);backdrop-filter:blur(3px);padding:24px 14px;overflow-y:auto}
.sri-overlay[hidden]{display:none}
.sri-dialog{font-family:'Noto Sans KR','Inter',system-ui,sans-serif;width:100%;max-width:780px;margin:auto;
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
.sri-mapgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}
.sri-maprow{display:flex;align-items:center;gap:8px}
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
[data-theme="dark"] .sri-pv-empty{border-color:#44403c;color:#78716c}
[data-theme="dark"] .sri-footer{background:#231f1d;border-top-color:#44403c}
[data-theme="dark"] .sri-btn-cancel{background:#292524;color:#d6d3d1;border-color:#57534e}
[data-theme="dark"] .sri-btn-dlerr{background:#2d1515;border-color:#7f1d1d;color:#fca5a5}
[data-theme="dark"] .sri-btn-dlerr:hover{background:#3f1a1a;border-color:#ef4444}
`;
        document.head.appendChild(style);
    }

    // ============================================================
    // 모달 마크업 (1회 주입)
    // ============================================================
    const MODAL_ID = 'soilImporterModal';
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
        modal.innerHTML = `
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
          <label class="sri-radio"><input type="radio" name="sriDup" value="overwrite"> 그래도 추가(덮어쓰기)</label>
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
    <button type="button" class="sri-btn-dlerr" data-act="dlErrorCsv" hidden>⚠️ 오류 행 CSV</button>
    <button type="button" class="sri-btn-cancel" data-act="close">취소</button>
    <button type="button" class="sri-btn-import" data-act="import" disabled>📥 가져오기</button>
  </footer>
</div>`;
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
            };
        }

        // ----------------------------------------------------------
        // 빌드 & 바인딩 (lazy)
        // ----------------------------------------------------------
        _ensureBuilt() {
            if (this._built) return;
            injectStyle();
            const modal = buildModal();
            const $ = (sel) => modal.querySelector(sel);
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
                this._refresh();
            });
            this._els.headerRow?.addEventListener('input', () => {
                const v = parseInt(this._els.headerRow.value, 10);
                if (!Number.isNaN(v) && v >= 1) { this._state.headerRowIdx = v - 1; this._refresh(); }
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
                this._refresh();
            });

            // 경지구분 1차 / 옵션
            this._els.bulkLandClass?.addEventListener('change', () => {
                this._state.bulkLandClass = this._els.bulkLandClass.value || LAND_CLASS1_DEFAULT;
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
                row.className = 'sri-maprow';
                const label = document.createElement('span');
                label.className = 'sri-maplabel';
                label.innerHTML = `${escapeHtml(f.label)}${f.optional ? '<span class="sri-opt"> (선택)</span>' : ''}`;
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
        }

        _autoMap(silent) {
            const { headers } = this._parseInput();
            if (headers.length === 0) {
                if (!silent) toast('먼저 데이터를 입력/업로드하세요.', 'warning');
                return;
            }
            const mapping = {};
            const usedCols = new Set();
            for (const f of TARGET_FIELDS) {
                let foundIdx = -1;
                // 1) 정확 일치 우선
                headers.forEach((h, i) => {
                    if (foundIdx >= 0 || usedCols.has(i)) return;
                    const norm = normalizeHeader(h);
                    if (norm && f.auto.some(k => norm === normalizeHeader(k))) foundIdx = i;
                });
                // 2) 부분 포함 (3자 이상 키워드만)
                if (foundIdx < 0) {
                    headers.forEach((h, i) => {
                        if (foundIdx >= 0 || usedCols.has(i)) return;
                        const norm = normalizeHeader(h);
                        if (norm && f.auto.some(k => { const nk = normalizeHeader(k); return nk.length >= 2 && norm.includes(nk); })) foundIdx = i;
                    });
                }
                if (foundIdx >= 0) { mapping[f.key] = foundIdx; usedCols.add(foundIdx); }
            }
            this._state.fieldMapping = mapping;
            this._renderMapping();
            this._recompute(); this._renderPreview();
            const count = Object.keys(mapping).length;
            if (!silent) toast(`자동 매핑 ${count}건 적용`, count > 0 ? 'success' : 'warning');
        }

        // ----------------------------------------------------------
        // 미리보기 계산
        // ----------------------------------------------------------
        _refresh() {
            this._renderMapping();
            this._recompute();
            this._renderPreview();
        }

        /** 현재 연도 + 경지구분1차 범위의 기존 접수번호 집합 */
        _existingNumbers(landClass1) {
            const set = new Set();
            const mgr = window.soilManager;
            let logs = [];
            if (mgr && Array.isArray(mgr.sampleLogs)) {
                logs = mgr.sampleLogs;
            } else {
                // 매니저 미준비 시 localStorage 직접 읽기
                const year = (mgr && mgr.selectedYear) || new Date().getFullYear();
                try {
                    const raw = localStorage.getItem(`soilSampleLogs_${year}`);
                    logs = raw ? JSON.parse(raw) : [];
                } catch (_) { logs = []; }
            }
            for (const log of (logs || [])) {
                if (!log || !log.receptionNumber) continue;
                if ((log.landClass1 || LAND_CLASS1_DEFAULT) !== landClass1) continue;
                // 매니저 getNextNumberForClass와 동일한 제외 조건 (성토·F접두 번호 제외)
                if (log.subCategory === '성토') continue;
                const base = String(log.receptionNumber).split('-')[0].trim();
                if (base.startsWith('F')) continue;
                set.add(base);
            }
            return set;
        }

        _recompute() {
            const { rows } = this._parseInput();
            const mapping = this._state.fieldMapping;
            const mappedKeys = Object.keys(mapping);
            // 최소 1개 식별 필드(성명 또는 지번주소)가 매핑돼야 의미 있음
            const hasIdentity = mapping.name != null || mapping.lotAddress != null || mapping.receptionNumber != null;
            if (rows.length === 0 || mappedKeys.length === 0 || !hasIdentity) {
                this._state.preview = null;
                return;
            }

            const landClass1 = this._state.bulkLandClass || LAND_CLASS1_DEFAULT;
            const existing = this._existingNumbers(landClass1);
            const mgr = window.soilManager;
            const year = (mgr && mgr.selectedYear) || new Date().getFullYear();

            // 자동부여 미리보기용 다음번호 시뮬레이션
            let nextNum = null;
            if (this._state.autoNumber || mapping.receptionNumber == null) {
                if (mgr && typeof mgr.getNextNumberForClass === 'function') {
                    nextNum = mgr.getNextNumberForClass(year, landClass1);
                } else {
                    let maxN = 0;
                    existing.forEach(n => { const v = parseInt(n, 10); if (!Number.isNaN(v) && v > maxN) maxN = v; });
                    nextNum = maxN + 1;
                }
            }
            const seenInBatch = new Set();

            const items = [];
            const stats = { total: rows.length, new: 0, dup: 0, err: 0 };

            rows.forEach((row) => {
                const get = (key) => {
                    const idx = mapping[key];
                    if (idx == null || idx < 0) return '';
                    return String(row[idx] ?? '').trim();
                };
                const rec = {
                    name: get('name'),
                    phoneNumber: get('phoneNumber'),
                    lotAddress: get('lotAddress'),
                    cropsDisplay: get('cropsDisplay'),
                    area: get('area'),
                    subCategory: get('subCategory'),
                    purpose: get('purpose'),
                    note: get('note'),
                    businessRegNo: get('businessRegNo'),
                    basePnu: get('basePnu'),
                    landClass1,
                };

                // 식별 정보 없는 빈 행 → 오류
                if (!rec.name && !rec.lotAddress) {
                    stats.err++;
                    items.push({ status: 'err', reason: '성명·주소 없음', display: '(빈 행)', rec });
                    return;
                }

                // 접수번호 결정
                let recNo;
                let useAuto = this._state.autoNumber || mapping.receptionNumber == null;
                if (!useAuto) {
                    recNo = get('receptionNumber');
                    if (!recNo) useAuto = true;
                }
                if (useAuto) {
                    // 배치 내 자동 증가 시뮬레이션
                    let candidate = nextNum;
                    while (existing.has(String(candidate)) || seenInBatch.has(String(candidate))) candidate++;
                    recNo = String(candidate);
                    nextNum = candidate + 1;
                    seenInBatch.add(recNo);
                    stats.new++;
                    items.push({ status: 'new', display: recNo, rec: { ...rec, receptionNumber: undefined }, auto: true });
                } else {
                    const base = String(recNo).split('-')[0].trim();
                    const isDup = existing.has(base) || seenInBatch.has(base);
                    seenInBatch.add(base);
                    if (isDup) {
                        if (this._state.dupPolicy === 'skip') {
                            stats.dup++;
                            items.push({ status: 'dup', display: recNo, skip: true, rec: { ...rec, receptionNumber: recNo } });
                        } else {
                            stats.dup++;
                            items.push({ status: 'dup', display: recNo, skip: false, rec: { ...rec, receptionNumber: recNo } });
                        }
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

            this._state.preview = { items, stats, willImport, landClass1 };
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
                if (note) note.textContent = '';
                return;
            }

            summary.innerHTML =
                `<span class="sri-pill new">✅ 신규 ${p.stats.new}</span>` +
                `<span class="sri-pill dup">⚠️ 중복 ${p.stats.dup}</span>` +
                `<span class="sri-pill err">⛔ 오류 ${p.stats.err}</span>`;

            const shown = p.items.slice(0, PREVIEW_ROW_LIMIT);
            const labels = { new: '신규', dup: '중복', err: '오류' };
            const trs = shown.map(it => {
                const r = it.rec || {};
                const cls = it.status === 'dup' ? 'is-dup' : (it.status === 'err' ? 'is-err' : '');
                const statusBadge = `<span class="sri-status ${it.status}">${labels[it.status]}${it.skip ? ' · 건너뜀' : ''}</span>`;
                return `<tr class="${cls}">
                    <td>${statusBadge}</td>
                    <td>${escapeHtml(it.display ?? '')}</td>
                    <td>${escapeHtml(r.name ?? '')}</td>
                    <td>${escapeHtml(r.phoneNumber ?? '')}</td>
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
                    <thead><tr><th>상태</th><th>접수번호</th><th>성명</th><th>연락처</th><th>지번주소</th><th>작물</th><th>면적</th><th>경지구분1차</th><th>구분</th><th>목적</th><th>비고</th></tr></thead>
                    <tbody>${trs}</tbody></table></div>${overflow}`
                : '<div class="sri-pv-empty">표시할 행이 없습니다.</div>';

            if (importBtn) {
                importBtn.disabled = p.willImport === 0;
                importBtn.textContent = p.willImport > 0 ? `📥 ${p.willImport}건 가져오기` : '📥 가져오기';
            }
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
                note.textContent = `총 ${p.stats.total}건 중 ${p.willImport}건이 [${p.landClass1}]으로 등록됩니다`;
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachOpenButton);
    } else {
        attachOpenButton();
    }
})();
