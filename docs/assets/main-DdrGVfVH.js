import"./frame-guard-BIL41LH3.js";/* empty css                        */import"./logger-Bx3YsiDi.js";import"./storage-manager-NkZUqJOM.js";import"./cache-manager-ByTTmbN8.js";import"./index.esm-k5uDoaEq.js";function k({storageKey:e,ids:t,countIncompleteMainParcelOnly:o}){const n=new Date,a=n.getFullYear(),g=n.getMonth(),y=document.getElementById(t.year),f=document.getElementById(t.rows),w=document.getElementById(t.empty),h=document.getElementById(t.total),S=document.getElementById(t.month),E=document.getElementById(t.rate),r=document.getElementById(t.bar),i=document.getElementById(t.incomplete);if(!y||!f||!w||!h||!S||!E||!r||!i)return;y.textContent=`${a}년`;let c=[];try{const s=localStorage.getItem(`${e}_${a}`);c=s?JSON.parse(s):[],Array.isArray(c)||(c=[])}catch{c=[]}if(c.length===0){f.style.display="none",w.style.display="block";return}const M=s=>!(s&&s.receptionNumber?String(s.receptionNumber):"").replace(/^F/,"").includes("-"),I=c.length,d=c.filter(s=>{if(!s||!s.date)return!1;const $=new Date(s.date);return!isNaN($)&&$.getFullYear()===a&&$.getMonth()===g}).length,l=c.filter(s=>s&&s.isComplete===!0).length,p=I===0?0:Math.round(l/I*100),L=c.filter(s=>s&&s.isComplete!==!0&&(!o||M(s))).length,m=s=>s.toLocaleString("ko-KR");h.innerHTML=`${m(I)}<span class="unit">건</span>`,S.innerHTML=`${m(d)}<span class="unit">건</span>`,E.innerHTML=`${p}<span class="unit">%</span>`,i.innerHTML=`${m(L)}<span class="unit">건</span>`,requestAnimationFrame(()=>{r.style.width=`${p}%`})}function T(e){try{k(e)}catch(t){console.error(`[main-stats] ${e.storageKey} 통계 렌더 실패:`,t)}}T({storageKey:"soilSampleLogs",countIncompleteMainParcelOnly:!0,ids:{year:"statsYear",rows:"statsRows",empty:"statsEmpty",total:"statsTotal",month:"statsMonth",rate:"statsCompleteRate",bar:"statsProgressBar",incomplete:"statsIncomplete"}});T({storageKey:"compostSampleLogs",countIncompleteMainParcelOnly:!1,ids:{year:"compostStatsYear",rows:"compostStatsRows",empty:"compostStatsEmpty",total:"compostStatsTotal",month:"compostStatsMonth",rate:"compostStatsCompleteRate",bar:"compostStatsProgressBar",incomplete:"compostStatsIncomplete"}});window.CacheManager&&CacheManager.checkAndAutoClean();(function(){const e=localStorage.getItem("app_org_name");if(e){const t=document.getElementById("orgNameDisplay");t&&(t.textContent=e)}})();(async function(){var t,o;const e=document.getElementById("appVersion");if((t=window.electronAPI)!=null&&t.getVersion)try{const n=await window.electronAPI.getVersion();n&&(e.textContent="v"+n)}catch(n){(((o=window.logger)==null?void 0:o.info)||console.info)("버전 정보 가져오기 실패:",n)}})();(async function(){var t;const e=document.getElementById("syncStatus");window.storageManager&&await window.storageManager.init()==="cloud"&&(e.style.display="block",(t=document.getElementById("syncBtn"))==null||t.style.setProperty("display","flex"),P())})();function P(){const e=document.getElementById("syncStatus");if(!e||!window.storageManager)return;const t=window.storageManager.getStatus(),o=e.querySelector(".sync-icon"),n=e.querySelector(".sync-text");t.isOnline?(o.textContent="☁️",n.textContent="클라우드 동기화",e.style.color="#22c55e"):(o.textContent="📴",n.textContent="오프라인 모드",e.style.color="#f59e0b")}window.addEventListener("online",P);window.addEventListener("offline",P);const C=[{type:"soil",name:"토양",icon:"🌱",storagePrefix:"soilSampleLogs"},{type:"compost",name:"퇴·액비",icon:"🐄",storagePrefix:"compostSampleLogs"}],x=2020,v=document.getElementById("syncBtn"),u=document.getElementById("syncModal"),N=document.getElementById("syncModalBody"),B=document.getElementById("syncModalClose"),b=document.getElementById("syncModalOk");function D(){u.classList.remove("show")}B==null||B.addEventListener("click",D);b==null||b.addEventListener("click",D);u==null||u.addEventListener("click",e=>{e.target===u&&D()});async function H(){var a,g,y,f,w,h,S,E;if(!((a=window.firestoreDb)!=null&&a.isEnabled())&&(g=window.firebaseConfig)!=null&&g.initialize)try{await window.firebaseConfig.initialize()&&await((y=window.firestoreDb)==null?void 0:y.init())}catch(r){(((f=window.logger)==null?void 0:f.warn)||console.warn)("Firebase 초기화 실패:",r)}if(!((w=window.firestoreDb)!=null&&w.isEnabled())){alert(`클라우드가 설정되지 않았습니다.
설정 페이지에서 인증 파일을 등록해주세요.`);return}v.classList.add("syncing");const e=new Date().getFullYear(),t=[],o=C.length*(e-x+1);let n=0;F(C);try{for(let r=0;r<C.length;r++){const i=C[r];let c=0,M=[];A(r,"syncing","동기화 중...");for(let d=x;d<=e;d++){try{let l,p=!1;if(typeof window.firestoreDb.getAllWithMeta=="function"){const m=await window.firestoreDb.getAllWithMeta(i.type,d);l=m.documents,p=m.fromCache===!0}else l=await window.firestoreDb.getAll(i.type,d);const L=`${i.storagePrefix}_${d}`;if(l&&l.length>0){const m=(h=window.SyncUtils)!=null&&h.smartMerge?(()=>{let s;try{s=JSON.parse(localStorage.getItem(L)||"[]")}catch{s=[]}return Array.isArray(s)||(s=[]),(window.SyncUtils.mergeCloudData?window.SyncUtils.mergeCloudData(s,l,{fromCache:p}):{data:window.SyncUtils.smartMerge(s,l,{allowDeletions:!p}).data}).data})():l;localStorage.setItem(L,JSON.stringify(m)),c+=m.length,M.push({year:d,count:m.length})}}catch(l){(((S=window.logger)==null?void 0:S.error)||console.error)(`${i.name} ${d}년 동기화 오류:`,l)}n++,R(n,o,`${i.name} ${d}년...`)}const I=c>0?`${c}건 완료`:"데이터 없음";A(r,c>0?"success":"",I),t.push({type:i.type,name:i.name,icon:i.icon,totalCount:c,yearsWithData:M,success:!0})}Y(t)}catch(r){(((E=window.logger)==null?void 0:E.error)||console.error)("동기화 오류:",r),alert("동기화 중 오류가 발생했습니다: "+r.message)}finally{v.classList.remove("syncing")}}function F(e){let t=`
        <div class="sync-progress">
            <div class="sync-progress-text">
                <span id="syncProgressLabel">준비 중...</span>
                <span id="syncProgressPercent">0%</span>
            </div>
            <div class="sync-progress-bar">
                <div class="sync-progress-fill" id="syncProgressFill"></div>
            </div>
        </div>
    `;e.forEach((o,n)=>{t+=`
            <div class="sync-result-item" id="syncItem${n}">
                <div class="sync-result-type">
                    <span>${escapeHTML(o.icon)}</span>
                    <span>${escapeHTML(o.name)}</span>
                </div>
                <div class="sync-result-count" id="syncStatus${n}">대기 중</div>
            </div>
        `}),N.innerHTML=t,u.classList.add("show")}function R(e,t,o){const n=Math.round(e/t*100),a=document.getElementById("syncProgressFill"),g=document.getElementById("syncProgressLabel"),y=document.getElementById("syncProgressPercent");a&&(a.style.width=`${n}%`),g&&(g.textContent=o),y&&(y.textContent=`${n}%`)}function A(e,t,o){const n=document.getElementById(`syncItem${e}`),a=document.getElementById(`syncStatus${e}`);n&&(n.className=`sync-result-item ${t}`),a&&(a.className=`sync-result-count ${t}`,a.textContent=o)}function Y(e){let t=0,o="";e.forEach(n=>{t+=n.totalCount;const a=n.totalCount>0?"success":"";o+=`
            <div class="sync-result-item">
                <div class="sync-result-type">
                    <span>${escapeHTML(n.icon)}</span>
                    <span>${escapeHTML(n.name)}</span>
                </div>
                <div class="sync-result-count ${a}">
                    ${n.totalCount>0?`${n.totalCount}건 동기화`:"데이터 없음"}
                </div>
            </div>
        `}),o+=`
        <div class="sync-result-item" style="margin-top: 1rem; background: linear-gradient(135deg, #22c55e20, #3b82f620);">
            <div class="sync-result-type">
                <span>📊</span>
                <span><strong>총 동기화</strong></span>
            </div>
            <div class="sync-result-count success">
                <strong>${t}건</strong>
            </div>
        </div>
    `,N.innerHTML=o,u.classList.add("show")}v==null||v.addEventListener("click",H);document.addEventListener("DOMContentLoaded",()=>{var e;if((e=window.electronAPI)!=null&&e.isElectron){const t=document.getElementById("feedbackNavBtn");t&&(t.style.display="")}});
