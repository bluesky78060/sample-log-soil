import"./theme-BmPSn4YP.js";/* empty css                        */import"./storage-manager-D9yC3kZ2.js";import"./cache-manager-BxLSevb9.js";window.CacheManager&&CacheManager.checkAndAutoClean();(function(){const t=localStorage.getItem("app_org_name");if(t){const n=document.getElementById("orgNameDisplay");n&&(n.textContent=t)}})();(async function(){var n,s;const t=document.getElementById("appVersion");if((n=window.electronAPI)!=null&&n.getVersion)try{const e=await window.electronAPI.getVersion();e&&(t.textContent="v"+e)}catch(e){(((s=window.logger)==null?void 0:s.info)||console.info)("버전 정보 가져오기 실패:",e)}})();(async function(){const t=document.getElementById("syncStatus");window.storageManager&&await window.storageManager.init()==="cloud"&&(t.style.display="block",w())})();function w(){const t=document.getElementById("syncStatus");if(!t||!window.storageManager)return;const n=window.storageManager.getStatus(),s=t.querySelector(".sync-icon"),e=t.querySelector(".sync-text");n.isOnline?(s.textContent="☁️",e.textContent="클라우드 동기화",t.style.color="#22c55e"):(s.textContent="📴",e.textContent="오프라인 모드",t.style.color="#f59e0b")}window.addEventListener("online",w);window.addEventListener("offline",w);const u=[{type:"soil",name:"토양",icon:"🌱",storagePrefix:"soilSampleLogs"},{type:"water",name:"수질분석",icon:"💧",storagePrefix:"waterSampleLogs"},{type:"compost",name:"퇴·액비",icon:"🐄",storagePrefix:"compostSampleLogs"},{type:"heavyMetal",name:"토양 중금속",icon:"⚗️",storagePrefix:"heavyMetalSampleLogs"},{type:"pesticide",name:"잔류농약",icon:"🧪",storagePrefix:"pesticideSampleLogs"}],I=2020,m=document.getElementById("syncBtn"),d=document.getElementById("syncModal"),M=document.getElementById("syncModalBody"),p=document.getElementById("syncModalClose"),f=document.getElementById("syncModalOk");function v(){d.classList.remove("show")}p==null||p.addEventListener("click",v);f==null||f.addEventListener("click",v);d==null||d.addEventListener("click",t=>{t.target===d&&v()});async function x(){var o,c,y,h,E,S,L;if(!((o=window.firestoreDb)!=null&&o.isEnabled())&&(c=window.firebaseConfig)!=null&&c.initialize)try{await window.firebaseConfig.initialize()&&await((y=window.firestoreDb)==null?void 0:y.init())}catch(a){(((h=window.logger)==null?void 0:h.warn)||console.warn)("Firebase 초기화 실패:",a)}if(!((E=window.firestoreDb)!=null&&E.isEnabled())){alert(`Firebase가 설정되지 않았습니다.
설정 페이지에서 인증 파일을 등록해주세요.`);return}m.classList.add("syncing");const t=new Date().getFullYear(),n=[],s=u.length*(t-I+1);let e=0;B(u);try{for(let a=0;a<u.length;a++){const i=u[a];let g=0,$=[];P(a,"syncing","동기화 중...");for(let r=I;r<=t;r++){try{const l=await window.firestoreDb.getAll(i.type,r),b=`${i.storagePrefix}_${r}`;l&&l.length>0&&(localStorage.setItem(b,JSON.stringify(l)),g+=l.length,$.push({year:r,count:l.length}))}catch(l){(((S=window.logger)==null?void 0:S.error)||console.error)(`${i.name} ${r}년 동기화 오류:`,l)}e++,D(e,s,`${i.name} ${r}년...`)}const C=g>0?`${g}건 완료`:"데이터 없음";P(a,g>0?"success":"",C),n.push({type:i.type,name:i.name,icon:i.icon,totalCount:g,yearsWithData:$,success:!0})}T(n)}catch(a){(((L=window.logger)==null?void 0:L.error)||console.error)("동기화 오류:",a),alert("동기화 중 오류가 발생했습니다: "+a.message)}finally{m.classList.remove("syncing")}}function B(t){let n=`
        <div class="sync-progress">
            <div class="sync-progress-text">
                <span id="syncProgressLabel">준비 중...</span>
                <span id="syncProgressPercent">0%</span>
            </div>
            <div class="sync-progress-bar">
                <div class="sync-progress-fill" id="syncProgressFill"></div>
            </div>
        </div>
    `;t.forEach((s,e)=>{n+=`
            <div class="sync-result-item" id="syncItem${e}">
                <div class="sync-result-type">
                    <span>${escapeHTML(s.icon)}</span>
                    <span>${escapeHTML(s.name)}</span>
                </div>
                <div class="sync-result-count" id="syncStatus${e}">대기 중</div>
            </div>
        `}),M.innerHTML=n,d.classList.add("show")}function D(t,n,s){const e=Math.round(t/n*100),o=document.getElementById("syncProgressFill"),c=document.getElementById("syncProgressLabel"),y=document.getElementById("syncProgressPercent");o&&(o.style.width=`${e}%`),c&&(c.textContent=s),y&&(y.textContent=`${e}%`)}function P(t,n,s){const e=document.getElementById(`syncItem${t}`),o=document.getElementById(`syncStatus${t}`);e&&(e.className=`sync-result-item ${n}`),o&&(o.className=`sync-result-count ${n}`,o.textContent=s)}function T(t){let n=0,s="";t.forEach(e=>{n+=e.totalCount;const o=e.totalCount>0?"success":"";e.yearsWithData.length>0&&e.yearsWithData.map(c=>`${c.year}년: ${c.count}건`).join(", "),s+=`
            <div class="sync-result-item">
                <div class="sync-result-type">
                    <span>${escapeHTML(e.icon)}</span>
                    <span>${escapeHTML(e.name)}</span>
                </div>
                <div class="sync-result-count ${o}">
                    ${e.totalCount>0?`${e.totalCount}건 동기화`:"데이터 없음"}
                </div>
            </div>
        `}),s+=`
        <div class="sync-result-item" style="margin-top: 1rem; background: linear-gradient(135deg, #22c55e20, #3b82f620);">
            <div class="sync-result-type">
                <span>📊</span>
                <span><strong>총 동기화</strong></span>
            </div>
            <div class="sync-result-count success">
                <strong>${n}건</strong>
            </div>
        </div>
    `,M.innerHTML=s,d.classList.add("show")}m==null||m.addEventListener("click",x);
