class h{constructor(e){this.searchBtn=e.searchBtn,this.postcodeInput=e.postcodeInput,this.roadInput=e.roadInput,this.detailInput=e.detailInput,this.hiddenInput=e.hiddenInput,this.modal=e.modal,this.closeBtn=e.closeBtn,this.container=e.container,this._page=1,this._pageSize=10,this._lastKeyword="",this._total=0,this._items=[],this._searching=!1,this._uiReady=!1,this.init()}init(){if(this.closeBtn&&this.closeBtn.addEventListener("click",()=>this.closeModal()),this.modal){const e=this.modal.querySelector(".modal-overlay");e&&e.addEventListener("click",()=>this.closeModal())}if(this.searchBtn&&this.searchBtn.addEventListener("click",()=>this.openSearch()),!this._delegateBound){this._delegateBound=!0;const e=this.searchBtn,s=e&&e.id||"searchAddressBtn";document.addEventListener("click",t=>{t.target&&t.target.closest&&t.target.closest("#"+s)&&(this.modal&&!this.modal.classList.contains("hidden")||this.openSearch())})}this.detailInput&&this.detailInput.addEventListener("input",()=>this.updateFullAddress())}openSearch(){var e;if(!this.container){alert("주소 검색 컨테이너가 존재하지 않습니다.");return}if(!window.JusoService||!((e=window.electronAPI)!=null&&e.jusoSearch)){alert("juso 주소 검색은 데스크톱(Electron) 환경에서만 사용 가능합니다.");return}this.modal&&this.modal.classList.remove("hidden"),this._renderSearchUI(),setTimeout(()=>{const s=this.container.querySelector(".juso-search-input");s&&s.focus()},50)}_renderSearchUI(){if(this._uiReady&&this.container.querySelector(".juso-search-input"))return;const e="juso-"+Math.random().toString(36).slice(2,8);this.container.innerHTML=`
            <div class="juso-search-wrap" data-id="${e}">
                <div class="juso-search-row">
                    <input type="text" class="juso-search-input"
                        placeholder="도로명/지번/건물명 검색"
                        autocomplete="off" maxlength="80">
                    <button type="button" class="juso-search-btn">검색</button>
                </div>
                <div class="juso-search-hint">예: <em>○○로 12</em>, <em>○○읍 ○○리</em>, <em>○○초등학교</em></div>
                <div class="juso-search-status" aria-live="polite"></div>
                <ul class="juso-search-results"></ul>
                <div class="juso-search-pager">
                    <button type="button" class="juso-page-prev" disabled>← 이전</button>
                    <span class="juso-page-info">0 건</span>
                    <button type="button" class="juso-page-next" disabled>다음 →</button>
                </div>
            </div>
        `;const s=this.container.querySelector(".juso-search-input"),t=this.container.querySelector(".juso-search-btn"),n=this.container.querySelector(".juso-search-results"),i=this.container.querySelector(".juso-page-prev"),r=this.container.querySelector(".juso-page-next"),o=(a=1)=>{const d=(s.value||"").trim();d&&(this._lastKeyword=d,this._page=a,this._runSearch())};t.addEventListener("click",()=>o(1)),s.addEventListener("keydown",a=>{a.key==="Enter"&&(a.preventDefault(),o(1))}),i.addEventListener("click",()=>{this._page>1&&o(this._page-1)}),r.addEventListener("click",()=>{const a=Math.max(1,Math.ceil(this._total/this._pageSize));this._page<a&&o(this._page+1)}),n.addEventListener("click",a=>{const d=a.target.closest("li[data-idx]");if(!d)return;const c=Number(d.dataset.idx),u=this._items[c];u&&this._onJusoSelected(u)}),n.addEventListener("keydown",a=>{if(a.key!=="Enter")return;const d=document.activeElement;if(d&&d.dataset&&d.dataset.idx!==void 0){a.preventDefault();const c=Number(d.dataset.idx),u=this._items[c];u&&this._onJusoSelected(u)}}),this._uiReady=!0}async _runSearch(){if(this._searching)return;const e=this.container.querySelector(".juso-search-status"),s=this.container.querySelector(".juso-search-results"),t=this.container.querySelector(".juso-page-prev"),n=this.container.querySelector(".juso-page-next"),i=this.container.querySelector(".juso-page-info"),r=this.container.querySelector(".juso-search-btn");this._searching=!0,r&&(r.disabled=!0),e.textContent="검색 중...",s.innerHTML="",t.disabled=!0,n.disabled=!0;try{const o=await window.JusoService.search(this._lastKeyword,{page:this._page,size:this._pageSize});if(!o.ok){e.textContent=`오류: ${o.error||"검색 실패"}`,i.textContent="0 건",this._items=[],this._total=0;return}if(this._items=o.items||[],this._total=Number(o.total)||0,this._items.length===0){e.textContent="검색 결과가 없습니다.",i.textContent="0 건";return}e.textContent="",this._renderResults(s);const a=Math.max(1,Math.ceil(this._total/this._pageSize));i.textContent=`${this._total.toLocaleString()} 건 (${this._page}/${a})`,t.disabled=this._page<=1,n.disabled=this._page>=a}catch(o){e.textContent=`오류: ${(o==null?void 0:o.message)||"알 수 없는 오류"}`}finally{this._searching=!1,r&&(r.disabled=!1)}}_renderResults(e){var n;const s=((n=window.sanitize)==null?void 0:n.escapeHTML)||(i=>String(i??"").replace(/[&<>"']/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[r])),t=this._items.map((i,r)=>{const o=s(i.roadAddr||i.roadAddrPart1||""),a=s(i.jibunAddr||""),d=s(i.zipNo||""),c=s(i.bdNm||"");return`
                <li data-idx="${r}" tabindex="0">
                    <div class="juso-item-road">
                        <span class="juso-zip">[${d}]</span>
                        <strong>${o}</strong>
                        ${c?`<span class="juso-bdnm">(${c})</span>`:""}
                    </div>
                    <div class="juso-item-jibun">지번: ${a}</div>
                </li>
            `}).join("");e.innerHTML=t}_onJusoSelected(e){const s=String(e.bdKdcd||"")==="1",t={zonecode:e.zipNo||"",roadAddress:e.roadAddr||e.roadAddrPart1||"",jibunAddress:e.jibunAddr||"",bname:e.liNm||e.emdNm||"",buildingName:e.bdNm||"",apartment:s?"Y":"N",sido:e.siNm||"",sigungu:e.sggNm||""};this.onAddressSelected(t)}onAddressSelected(e){const s=e.roadAddress||"";let t="";e.bname&&/[동로가]$/.test(e.bname)&&(t+=e.bname),e.buildingName&&e.apartment==="Y"&&(t+=t!==""?", "+e.buildingName:e.buildingName),t!==""&&(t=" ("+t+")"),this.postcodeInput&&(this.postcodeInput.value=e.zonecode||""),this.roadInput&&(this.roadInput.value=s+t),this.detailInput&&this.detailInput.focus(),this.updateFullAddress(),this.closeModal()}closeModal(){this.modal&&this.modal.classList.add("hidden"),setTimeout(()=>{this.container&&(this.container.innerHTML=""),this._uiReady=!1,this._items=[],this._page=1,this._total=0,this._lastKeyword=""},100)}updateFullAddress(){var n,i,r;if(!this.hiddenInput)return;const e=((n=this.postcodeInput)==null?void 0:n.value)||"",s=((i=this.roadInput)==null?void 0:i.value)||"",t=((r=this.detailInput)==null?void 0:r.value)||"";e&&s?this.hiddenInput.value=`(${e}) ${s}${t?" "+t:""}`:this.hiddenInput.value=""}clear(){this.postcodeInput&&(this.postcodeInput.value=""),this.roadInput&&(this.roadInput.value=""),this.detailInput&&(this.detailInput.value=""),this.hiddenInput&&(this.hiddenInput.value="")}setValue(e,s,t){this.postcodeInput&&(this.postcodeInput.value=e||""),this.roadInput&&(this.roadInput.value=s||""),this.detailInput&&(this.detailInput.value=t||""),this.updateFullAddress()}}(function(){if(typeof document>"u"||document.getElementById("juso-search-style"))return;const e=document.createElement("style");e.id="juso-search-style",e.textContent=`
        .juso-search-wrap { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
        .juso-search-row { display: flex; gap: 6px; }
        .juso-search-input { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; }
        .juso-search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
        .juso-search-btn { padding: 8px 14px; background: #2563eb; color: #fff; border: 0; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .juso-search-btn:hover { background: #1d4ed8; }
        .juso-search-hint { font-size: 12px; color: #6b7280; }
        .juso-search-hint em { font-style: normal; color: #2563eb; }
        .juso-search-status { min-height: 18px; font-size: 12px; color: #6b7280; }
        .juso-search-results { list-style: none; padding: 0; margin: 0; max-height: 360px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; }
        .juso-search-results:empty { border: 0; }
        .juso-search-results li { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; cursor: pointer; outline: none; }
        .juso-search-results li:last-child { border-bottom: 0; }
        .juso-search-results li:hover, .juso-search-results li:focus { background: #eff6ff; }
        .juso-item-road { font-size: 14px; color: #111827; }
        .juso-item-road strong { font-weight: 600; }
        .juso-zip { display: inline-block; min-width: 50px; color: #2563eb; font-size: 12px; margin-right: 4px; }
        .juso-bdnm { color: #6b7280; font-size: 12px; margin-left: 4px; }
        .juso-item-jibun { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .juso-search-pager { display: flex; justify-content: space-between; align-items: center; padding-top: 4px; font-size: 13px; }
        .juso-search-pager button { padding: 4px 10px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; }
        .juso-search-pager button:disabled { opacity: 0.4; cursor: not-allowed; }
        .juso-page-info { color: #6b7280; }
        /* 다크 모드 */
        [data-theme="dark"] .juso-search-input { background: #1f2937; color: #f9fafb; border-color: #374151; }
        [data-theme="dark"] .juso-search-input:focus { border-color: #60a5fa; }
        [data-theme="dark"] .juso-search-hint, [data-theme="dark"] .juso-search-status, [data-theme="dark"] .juso-page-info, [data-theme="dark"] .juso-item-jibun, [data-theme="dark"] .juso-bdnm { color: #9ca3af; }
        [data-theme="dark"] .juso-search-results { border-color: #374151; }
        [data-theme="dark"] .juso-search-results li { border-color: #1f2937; color: #e5e7eb; }
        [data-theme="dark"] .juso-search-results li:hover, [data-theme="dark"] .juso-search-results li:focus { background: #1e3a8a; }
        [data-theme="dark"] .juso-item-road { color: #f9fafb; }
        [data-theme="dark"] .juso-search-pager button { background: #1f2937; border-color: #374151; color: #e5e7eb; }
        [data-theme="dark"] .juso-zip { color: #60a5fa; }
    `,document.head.appendChild(e)})();window.AddressManager=h;
