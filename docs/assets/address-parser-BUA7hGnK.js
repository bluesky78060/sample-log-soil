class f{constructor(t){this.searchBtn=t.searchBtn,this.postcodeInput=t.postcodeInput,this.roadInput=t.roadInput,this.detailInput=t.detailInput,this.hiddenInput=t.hiddenInput,this.modal=t.modal,this.closeBtn=t.closeBtn,this.container=t.container,this._page=1,this._pageSize=10,this._lastKeyword="",this._total=0,this._items=[],this._searching=!1,this._uiReady=!1,this.init()}init(){if(this.closeBtn&&this.closeBtn.addEventListener("click",()=>this.closeModal()),this.modal){const t=this.modal.querySelector(".modal-overlay");t&&t.addEventListener("click",()=>this.closeModal())}if(this.searchBtn&&this.searchBtn.addEventListener("click",()=>this.openSearch()),!this._delegateBound){this._delegateBound=!0;const t=this.searchBtn,s=t&&t.id||"searchAddressBtn";document.addEventListener("click",i=>{i.target&&i.target.closest&&i.target.closest("#"+s)&&(this.modal&&!this.modal.classList.contains("hidden")||this.openSearch())})}this.detailInput&&this.detailInput.addEventListener("input",()=>this.updateFullAddress())}openSearch(){var t;if(!this.container){alert("주소 검색 컨테이너가 존재하지 않습니다.");return}if(!window.JusoService||!((t=window.electronAPI)!=null&&t.jusoSearch)){alert("juso 주소 검색은 데스크톱(Electron) 환경에서만 사용 가능합니다.");return}this.modal&&this.modal.classList.remove("hidden"),this._renderSearchUI(),setTimeout(()=>{const s=this.container.querySelector(".juso-search-input");s&&s.focus()},50)}_renderSearchUI(){if(this._uiReady&&this.container.querySelector(".juso-search-input"))return;const t="juso-"+Math.random().toString(36).slice(2,8);this.container.innerHTML=`
            <div class="juso-search-wrap" data-id="${t}">
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
        `;const s=this.container.querySelector(".juso-search-input"),i=this.container.querySelector(".juso-search-btn"),a=this.container.querySelector(".juso-search-results"),e=this.container.querySelector(".juso-page-prev"),o=this.container.querySelector(".juso-page-next"),r=(n=1)=>{const u=(s.value||"").trim();u&&(this._lastKeyword=u,this._page=n,this._runSearch())};i.addEventListener("click",()=>r(1)),s.addEventListener("keydown",n=>{n.key==="Enter"&&(n.preventDefault(),r(1))}),e.addEventListener("click",()=>{this._page>1&&r(this._page-1)}),o.addEventListener("click",()=>{const n=Math.max(1,Math.ceil(this._total/this._pageSize));this._page<n&&r(this._page+1)}),a.addEventListener("click",n=>{const u=n.target.closest("li[data-idx]");if(!u)return;const c=Number(u.dataset.idx),l=this._items[c];l&&this._onJusoSelected(l)}),a.addEventListener("keydown",n=>{if(n.key!=="Enter")return;const u=document.activeElement;if(u&&u.dataset&&u.dataset.idx!==void 0){n.preventDefault();const c=Number(u.dataset.idx),l=this._items[c];l&&this._onJusoSelected(l)}}),this._uiReady=!0}async _runSearch(){if(this._searching)return;const t=this.container.querySelector(".juso-search-status"),s=this.container.querySelector(".juso-search-results"),i=this.container.querySelector(".juso-page-prev"),a=this.container.querySelector(".juso-page-next"),e=this.container.querySelector(".juso-page-info"),o=this.container.querySelector(".juso-search-btn");this._searching=!0,o&&(o.disabled=!0),t.textContent="검색 중...",s.innerHTML="",i.disabled=!0,a.disabled=!0;try{const r=await window.JusoService.search(this._lastKeyword,{page:this._page,size:this._pageSize});if(!r.ok){t.textContent=`오류: ${r.error||"검색 실패"}`,e.textContent="0 건",this._items=[],this._total=0;return}if(this._items=r.items||[],this._total=Number(r.total)||0,this._items.length===0){t.textContent="검색 결과가 없습니다.",e.textContent="0 건";return}t.textContent="",this._renderResults(s);const n=Math.max(1,Math.ceil(this._total/this._pageSize));e.textContent=`${this._total.toLocaleString()} 건 (${this._page}/${n})`,i.disabled=this._page<=1,a.disabled=this._page>=n}catch(r){t.textContent=`오류: ${(r==null?void 0:r.message)||"알 수 없는 오류"}`}finally{this._searching=!1,o&&(o.disabled=!1)}}_renderResults(t){var a;const s=((a=window.sanitize)==null?void 0:a.escapeHTML)||(e=>String(e??"").replace(/[&<>"']/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[o])),i=this._items.map((e,o)=>{const r=s(e.roadAddr||e.roadAddrPart1||""),n=s(e.jibunAddr||""),u=s(e.zipNo||""),c=s(e.bdNm||"");return`
                <li data-idx="${o}" tabindex="0">
                    <div class="juso-item-road">
                        <span class="juso-zip">[${u}]</span>
                        <strong>${r}</strong>
                        ${c?`<span class="juso-bdnm">(${c})</span>`:""}
                    </div>
                    <div class="juso-item-jibun">지번: ${n}</div>
                </li>
            `}).join("");t.innerHTML=i}_onJusoSelected(t){const s=String(t.bdKdcd||"")==="1",i={zonecode:t.zipNo||"",roadAddress:t.roadAddr||t.roadAddrPart1||"",jibunAddress:t.jibunAddr||"",bname:t.liNm||t.emdNm||"",buildingName:t.bdNm||"",apartment:s?"Y":"N",sido:t.siNm||"",sigungu:t.sggNm||""};this.onAddressSelected(i)}onAddressSelected(t){const s=t.roadAddress||"";let i="";t.bname&&/[동로가]$/.test(t.bname)&&(i+=t.bname),t.buildingName&&t.apartment==="Y"&&(i+=i!==""?", "+t.buildingName:t.buildingName),i!==""&&(i=" ("+i+")"),this.postcodeInput&&(this.postcodeInput.value=t.zonecode||""),this.roadInput&&(this.roadInput.value=s+i),this.detailInput&&this.detailInput.focus(),this.updateFullAddress(),this.closeModal()}closeModal(){this.modal&&this.modal.classList.add("hidden"),setTimeout(()=>{this.container&&(this.container.innerHTML=""),this._uiReady=!1,this._items=[],this._page=1,this._total=0,this._lastKeyword=""},100)}updateFullAddress(){var a,e,o;if(!this.hiddenInput)return;const t=((a=this.postcodeInput)==null?void 0:a.value)||"",s=((e=this.roadInput)==null?void 0:e.value)||"",i=((o=this.detailInput)==null?void 0:o.value)||"";t&&s?this.hiddenInput.value=`(${t}) ${s}${i?" "+i:""}`:this.hiddenInput.value=""}clear(){this.postcodeInput&&(this.postcodeInput.value=""),this.roadInput&&(this.roadInput.value=""),this.detailInput&&(this.detailInput.value=""),this.hiddenInput&&(this.hiddenInput.value="")}setValue(t,s,i){this.postcodeInput&&(this.postcodeInput.value=t||""),this.roadInput&&(this.roadInput.value=s||""),this.detailInput&&(this.detailInput.value=i||""),this.updateFullAddress()}}(function(){if(typeof document>"u"||document.getElementById("juso-search-style"))return;const t=document.createElement("style");t.id="juso-search-style",t.textContent=`
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
    `,document.head.appendChild(t)})();window.AddressManager=f;const p=["서울특별시","부산광역시","대구광역시","인천광역시","광주광역시","대전광역시","울산광역시","세종특별자치시","경기도","강원특별자치도","강원도","충청북도","충청남도","전라북도","전북특별자치도","전라남도","경상북도","경상남도","제주특별자치도"],h={서울:"서울특별시",부산:"부산광역시",대구:"대구광역시",인천:"인천광역시",광주:"광주광역시",대전:"대전광역시",울산:"울산광역시",세종:"세종특별자치시",경기:"경기도",강원:"강원특별자치도",충북:"충청북도",충남:"충청남도",전북:"전북특별자치도",전남:"전라남도",경북:"경상북도",경남:"경상남도",제주:"제주특별자치도"};function m(d){return d?p.includes(d)?d:h[d]||d:""}function g(d){if(!d||d==="-")return{sido:"",sigungu:"",eupmyeondong:"",rest:""};d=d.replace(/^\(\d{5}\)\s*/,"").trim();let t="",s="",i="",a="";const e=d.split(/\s+/);if(e.length>0){const o=e[0];p.includes(o)?(t=o,e.shift()):h[o]&&(t=h[o],e.shift())}return e.length>0&&/(시|군|구)$/.test(e[0])&&(s=e.shift(),e.length>0&&/구$/.test(e[0])&&(s+=" "+e.shift())),e.length>0&&/(읍|면|동|리|가)$/.test(e[0])&&(i=e.shift()),a=e.join(" "),{sido:t,sigungu:s,eupmyeondong:i,rest:a}}window.parseAddressParts=g;window.SIDO_LIST=p;window.SIDO_SHORT_MAP=h;window.expandSido=m;
