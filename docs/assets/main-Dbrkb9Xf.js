import"./frame-guard-BIL41LH3.js";/* empty css                        */import"./theme-2kqPfXg0.js";import"./storage-manager-CiSlsDsY.js";import"./cache-manager-nqFa1f2l.js";(function(){const n=new Date().getFullYear(),a=new Date().getMonth(),t=`soilSampleLogs_${n}`,c=document.getElementById("statsYear"),m=document.getElementById("statsRows"),u=document.getElementById("statsEmpty"),h=document.getElementById("statsTotal"),E=document.getElementById("statsMonth"),S=document.getElementById("statsCompleteRate"),$=document.getElementById("statsProgressBar"),v=document.getElementById("statsIncomplete");if(!c||!m||!u)return;c.textContent=`${n}년`;let o=[];try{const s=localStorage.getItem(t);o=s?JSON.parse(s):[],Array.isArray(o)||(o=[])}catch{o=[]}if(o.length===0){m.style.display="none",u.style.display="block";return}const d=s=>!(s&&s.receptionNumber?String(s.receptionNumber):"").replace(/^F/,"").includes("-"),y=o.length,I=o.filter(s=>{if(!s||!s.date)return!1;const l=new Date(s.date);return!isNaN(l)&&l.getFullYear()===n&&l.getMonth()===a}).length,C=o.filter(s=>s&&s.isComplete===!0).length,r=y===0?0:Math.round(C/y*100),i=o.filter(s=>s&&s.isComplete!==!0&&d(s)).length,g=s=>s.toLocaleString("ko-KR");h.innerHTML=`${g(y)}<span class="unit">건</span>`,E.innerHTML=`${g(I)}<span class="unit">건</span>`,S.innerHTML=`${r}<span class="unit">%</span>`,v.innerHTML=`${g(i)}<span class="unit">건</span>`,requestAnimationFrame(()=>{$.style.width=`${r}%`})})();window.CacheManager&&CacheManager.checkAndAutoClean();(function(){const e=localStorage.getItem("app_org_name");if(e){const n=document.getElementById("orgNameDisplay");n&&(n.textContent=e)}})();(async function(){var n,a;const e=document.getElementById("appVersion");if((n=window.electronAPI)!=null&&n.getVersion)try{const t=await window.electronAPI.getVersion();t&&(e.textContent="v"+t)}catch(t){(((a=window.logger)==null?void 0:a.info)||console.info)("버전 정보 가져오기 실패:",t)}})();(async function(){const e=document.getElementById("syncStatus");window.storageManager&&await window.storageManager.init()==="cloud"&&(e.style.display="block",b())})();function b(){const e=document.getElementById("syncStatus");if(!e||!window.storageManager)return;const n=window.storageManager.getStatus(),a=e.querySelector(".sync-icon"),t=e.querySelector(".sync-text");n.isOnline?(a.textContent="☁️",t.textContent="클라우드 동기화",e.style.color="#22c55e"):(a.textContent="📴",t.textContent="오프라인 모드",e.style.color="#f59e0b")}window.addEventListener("online",b);window.addEventListener("offline",b);const M=[{type:"soil",name:"토양",icon:"🌱",storagePrefix:"soilSampleLogs"}],P=2020,f=document.getElementById("syncBtn"),p=document.getElementById("syncModal"),T=document.getElementById("syncModalBody"),L=document.getElementById("syncModalClose"),B=document.getElementById("syncModalOk");function D(){p.classList.remove("show")}L==null||L.addEventListener("click",D);B==null||B.addEventListener("click",D);p==null||p.addEventListener("click",e=>{e.target===p&&D()});async function x(){var c,m,u,h,E,S,$,v;if(!((c=window.firestoreDb)!=null&&c.isEnabled())&&(m=window.firebaseConfig)!=null&&m.initialize)try{await window.firebaseConfig.initialize()&&await((u=window.firestoreDb)==null?void 0:u.init())}catch(o){(((h=window.logger)==null?void 0:h.warn)||console.warn)("Firebase 초기화 실패:",o)}if(!((E=window.firestoreDb)!=null&&E.isEnabled())){alert(`Firebase가 설정되지 않았습니다.
설정 페이지에서 인증 파일을 등록해주세요.`);return}f.classList.add("syncing");const e=new Date().getFullYear(),n=[],a=M.length*(e-P+1);let t=0;N(M);try{for(let o=0;o<M.length;o++){const d=M[o];let y=0,I=[];A(o,"syncing","동기화 중...");for(let r=P;r<=e;r++){try{let i,g=!1;if(typeof window.firestoreDb.getAllWithMeta=="function"){const l=await window.firestoreDb.getAllWithMeta(d.type,r);i=l.documents,g=l.fromCache===!0}else i=await window.firestoreDb.getAll(d.type,r);const s=`${d.storagePrefix}_${r}`;if(i&&i.length>0){const l=(S=window.SyncUtils)!=null&&S.smartMerge?(()=>{let w;try{w=JSON.parse(localStorage.getItem(s)||"[]")}catch{w=[]}return Array.isArray(w)||(w=[]),(window.SyncUtils.mergeCloudData?window.SyncUtils.mergeCloudData(w,i,{fromCache:g}):{data:window.SyncUtils.smartMerge(w,i,{allowDeletions:!g}).data}).data})():i;localStorage.setItem(s,JSON.stringify(l)),y+=l.length,I.push({year:r,count:l.length})}}catch(i){((($=window.logger)==null?void 0:$.error)||console.error)(`${d.name} ${r}년 동기화 오류:`,i)}t++,F(t,a,`${d.name} ${r}년...`)}const C=y>0?`${y}건 완료`:"데이터 없음";A(o,y>0?"success":"",C),n.push({type:d.type,name:d.name,icon:d.icon,totalCount:y,yearsWithData:I,success:!0})}H(n)}catch(o){(((v=window.logger)==null?void 0:v.error)||console.error)("동기화 오류:",o),alert("동기화 중 오류가 발생했습니다: "+o.message)}finally{f.classList.remove("syncing")}}function N(e){let n=`
        <div class="sync-progress">
            <div class="sync-progress-text">
                <span id="syncProgressLabel">준비 중...</span>
                <span id="syncProgressPercent">0%</span>
            </div>
            <div class="sync-progress-bar">
                <div class="sync-progress-fill" id="syncProgressFill"></div>
            </div>
        </div>
    `;e.forEach((a,t)=>{n+=`
            <div class="sync-result-item" id="syncItem${t}">
                <div class="sync-result-type">
                    <span>${escapeHTML(a.icon)}</span>
                    <span>${escapeHTML(a.name)}</span>
                </div>
                <div class="sync-result-count" id="syncStatus${t}">대기 중</div>
            </div>
        `}),T.innerHTML=n,p.classList.add("show")}function F(e,n,a){const t=Math.round(e/n*100),c=document.getElementById("syncProgressFill"),m=document.getElementById("syncProgressLabel"),u=document.getElementById("syncProgressPercent");c&&(c.style.width=`${t}%`),m&&(m.textContent=a),u&&(u.textContent=`${t}%`)}function A(e,n,a){const t=document.getElementById(`syncItem${e}`),c=document.getElementById(`syncStatus${e}`);t&&(t.className=`sync-result-item ${n}`),c&&(c.className=`sync-result-count ${n}`,c.textContent=a)}function H(e){let n=0,a="";e.forEach(t=>{n+=t.totalCount;const c=t.totalCount>0?"success":"";a+=`
            <div class="sync-result-item">
                <div class="sync-result-type">
                    <span>${escapeHTML(t.icon)}</span>
                    <span>${escapeHTML(t.name)}</span>
                </div>
                <div class="sync-result-count ${c}">
                    ${t.totalCount>0?`${t.totalCount}건 동기화`:"데이터 없음"}
                </div>
            </div>
        `}),a+=`
        <div class="sync-result-item" style="margin-top: 1rem; background: linear-gradient(135deg, #22c55e20, #3b82f620);">
            <div class="sync-result-type">
                <span>📊</span>
                <span><strong>총 동기화</strong></span>
            </div>
            <div class="sync-result-count success">
                <strong>${n}건</strong>
            </div>
        </div>
    `,T.innerHTML=a,p.classList.add("show")}f==null||f.addEventListener("click",x);
