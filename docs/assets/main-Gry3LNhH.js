import"./frame-guard-BIL41LH3.js";/* empty css                        */import"./theme-2kqPfXg0.js";import"./storage-manager-7f1scv_V.js";import"./cache-manager-nqFa1f2l.js";import"./index.esm-k5uDoaEq.js";(function(){const e=new Date().getFullYear(),a=new Date().getMonth(),n=`soilSampleLogs_${e}`,c=document.getElementById("statsYear"),m=document.getElementById("statsRows"),u=document.getElementById("statsEmpty"),h=document.getElementById("statsTotal"),E=document.getElementById("statsMonth"),v=document.getElementById("statsCompleteRate"),S=document.getElementById("statsProgressBar"),$=document.getElementById("statsIncomplete");if(!c||!m||!u)return;c.textContent=`${e}년`;let o=[];try{const s=localStorage.getItem(n);o=s?JSON.parse(s):[],Array.isArray(o)||(o=[])}catch{o=[]}if(o.length===0){m.style.display="none",u.style.display="block";return}const d=s=>!(s&&s.receptionNumber?String(s.receptionNumber):"").replace(/^F/,"").includes("-"),y=o.length,I=o.filter(s=>{if(!s||!s.date)return!1;const l=new Date(s.date);return!isNaN(l)&&l.getFullYear()===e&&l.getMonth()===a}).length,C=o.filter(s=>s&&s.isComplete===!0).length,i=y===0?0:Math.round(C/y*100),r=o.filter(s=>s&&s.isComplete!==!0&&d(s)).length,g=s=>s.toLocaleString("ko-KR");h.innerHTML=`${g(y)}<span class="unit">건</span>`,E.innerHTML=`${g(I)}<span class="unit">건</span>`,v.innerHTML=`${i}<span class="unit">%</span>`,$.innerHTML=`${g(r)}<span class="unit">건</span>`,requestAnimationFrame(()=>{S.style.width=`${i}%`})})();window.CacheManager&&CacheManager.checkAndAutoClean();(function(){const t=localStorage.getItem("app_org_name");if(t){const e=document.getElementById("orgNameDisplay");e&&(e.textContent=t)}})();(async function(){var e,a;const t=document.getElementById("appVersion");if((e=window.electronAPI)!=null&&e.getVersion)try{const n=await window.electronAPI.getVersion();n&&(t.textContent="v"+n)}catch(n){(((a=window.logger)==null?void 0:a.info)||console.info)("버전 정보 가져오기 실패:",n)}})();(async function(){const t=document.getElementById("syncStatus");window.storageManager&&await window.storageManager.init()==="cloud"&&(t.style.display="block",b())})();function b(){const t=document.getElementById("syncStatus");if(!t||!window.storageManager)return;const e=window.storageManager.getStatus(),a=t.querySelector(".sync-icon"),n=t.querySelector(".sync-text");e.isOnline?(a.textContent="☁️",n.textContent="클라우드 동기화",t.style.color="#22c55e"):(a.textContent="📴",n.textContent="오프라인 모드",t.style.color="#f59e0b")}window.addEventListener("online",b);window.addEventListener("offline",b);const M=[{type:"soil",name:"토양",icon:"🌱",storagePrefix:"soilSampleLogs"}],P=2020,w=document.getElementById("syncBtn"),p=document.getElementById("syncModal"),T=document.getElementById("syncModalBody"),L=document.getElementById("syncModalClose"),B=document.getElementById("syncModalOk");function D(){p.classList.remove("show")}L==null||L.addEventListener("click",D);B==null||B.addEventListener("click",D);p==null||p.addEventListener("click",t=>{t.target===p&&D()});async function x(){var c,m,u,h,E,v,S,$;if(!((c=window.firestoreDb)!=null&&c.isEnabled())&&(m=window.firebaseConfig)!=null&&m.initialize)try{await window.firebaseConfig.initialize()&&await((u=window.firestoreDb)==null?void 0:u.init())}catch(o){(((h=window.logger)==null?void 0:h.warn)||console.warn)("Firebase 초기화 실패:",o)}if(!((E=window.firestoreDb)!=null&&E.isEnabled())){alert(`Firebase가 설정되지 않았습니다.
설정 페이지에서 인증 파일을 등록해주세요.`);return}w.classList.add("syncing");const t=new Date().getFullYear(),e=[],a=M.length*(t-P+1);let n=0;N(M);try{for(let o=0;o<M.length;o++){const d=M[o];let y=0,I=[];A(o,"syncing","동기화 중...");for(let i=P;i<=t;i++){try{let r,g=!1;if(typeof window.firestoreDb.getAllWithMeta=="function"){const l=await window.firestoreDb.getAllWithMeta(d.type,i);r=l.documents,g=l.fromCache===!0}else r=await window.firestoreDb.getAll(d.type,i);const s=`${d.storagePrefix}_${i}`;if(r&&r.length>0){const l=(v=window.SyncUtils)!=null&&v.smartMerge?(()=>{let f;try{f=JSON.parse(localStorage.getItem(s)||"[]")}catch{f=[]}return Array.isArray(f)||(f=[]),(window.SyncUtils.mergeCloudData?window.SyncUtils.mergeCloudData(f,r,{fromCache:g}):{data:window.SyncUtils.smartMerge(f,r,{allowDeletions:!g}).data}).data})():r;localStorage.setItem(s,JSON.stringify(l)),y+=l.length,I.push({year:i,count:l.length})}}catch(r){(((S=window.logger)==null?void 0:S.error)||console.error)(`${d.name} ${i}년 동기화 오류:`,r)}n++,k(n,a,`${d.name} ${i}년...`)}const C=y>0?`${y}건 완료`:"데이터 없음";A(o,y>0?"success":"",C),e.push({type:d.type,name:d.name,icon:d.icon,totalCount:y,yearsWithData:I,success:!0})}F(e)}catch(o){((($=window.logger)==null?void 0:$.error)||console.error)("동기화 오류:",o),alert("동기화 중 오류가 발생했습니다: "+o.message)}finally{w.classList.remove("syncing")}}function N(t){let e=`
        <div class="sync-progress">
            <div class="sync-progress-text">
                <span id="syncProgressLabel">준비 중...</span>
                <span id="syncProgressPercent">0%</span>
            </div>
            <div class="sync-progress-bar">
                <div class="sync-progress-fill" id="syncProgressFill"></div>
            </div>
        </div>
    `;t.forEach((a,n)=>{e+=`
            <div class="sync-result-item" id="syncItem${n}">
                <div class="sync-result-type">
                    <span>${escapeHTML(a.icon)}</span>
                    <span>${escapeHTML(a.name)}</span>
                </div>
                <div class="sync-result-count" id="syncStatus${n}">대기 중</div>
            </div>
        `}),T.innerHTML=e,p.classList.add("show")}function k(t,e,a){const n=Math.round(t/e*100),c=document.getElementById("syncProgressFill"),m=document.getElementById("syncProgressLabel"),u=document.getElementById("syncProgressPercent");c&&(c.style.width=`${n}%`),m&&(m.textContent=a),u&&(u.textContent=`${n}%`)}function A(t,e,a){const n=document.getElementById(`syncItem${t}`),c=document.getElementById(`syncStatus${t}`);n&&(n.className=`sync-result-item ${e}`),c&&(c.className=`sync-result-count ${e}`,c.textContent=a)}function F(t){let e=0,a="";t.forEach(n=>{e+=n.totalCount;const c=n.totalCount>0?"success":"";a+=`
            <div class="sync-result-item">
                <div class="sync-result-type">
                    <span>${escapeHTML(n.icon)}</span>
                    <span>${escapeHTML(n.name)}</span>
                </div>
                <div class="sync-result-count ${c}">
                    ${n.totalCount>0?`${n.totalCount}건 동기화`:"데이터 없음"}
                </div>
            </div>
        `}),a+=`
        <div class="sync-result-item" style="margin-top: 1rem; background: linear-gradient(135deg, #22c55e20, #3b82f620);">
            <div class="sync-result-type">
                <span>📊</span>
                <span><strong>총 동기화</strong></span>
            </div>
            <div class="sync-result-count success">
                <strong>${e}건</strong>
            </div>
        </div>
    `,T.innerHTML=a,p.classList.add("show")}w==null||w.addEventListener("click",x);document.addEventListener("DOMContentLoaded",()=>{var t;if((t=window.electronAPI)!=null&&t.isElectron){const e=document.getElementById("feedbackNavBtn");e&&(e.style.display="")}});
