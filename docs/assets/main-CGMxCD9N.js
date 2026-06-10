import"./theme-D1BqTDsX.js";/* empty css                        */import"./storage-manager-CiSlsDsY.js";import"./cache-manager-nqFa1f2l.js";(function(){const n=new Date().getFullYear(),a=new Date().getMonth(),t=`soilSampleLogs_${n}`,c=document.getElementById("statsYear"),i=document.getElementById("statsRows"),g=document.getElementById("statsEmpty"),h=document.getElementById("statsTotal"),E=document.getElementById("statsMonth"),S=document.getElementById("statsCompleteRate"),$=document.getElementById("statsProgressBar"),v=document.getElementById("statsIncomplete");if(!c||!i||!g)return;c.textContent=`${n}년`;let o=[];try{const s=localStorage.getItem(t);o=s?JSON.parse(s):[],Array.isArray(o)||(o=[])}catch{o=[]}if(o.length===0){i.style.display="none",g.style.display="block";return}const y=s=>!(s&&s.receptionNumber?String(s.receptionNumber):"").replace(/^F/,"").includes("-"),m=o.length,I=o.filter(s=>{if(!s||!s.date)return!1;const d=new Date(s.date);return!isNaN(d)&&d.getFullYear()===n&&d.getMonth()===a}).length,M=o.filter(s=>s&&s.isComplete===!0).length,r=m===0?0:Math.round(M/m*100),l=o.filter(s=>s&&s.isComplete!==!0&&y(s)).length,u=s=>s.toLocaleString("ko-KR");h.innerHTML=`${u(m)}<span class="unit">건</span>`,E.innerHTML=`${u(I)}<span class="unit">건</span>`,S.innerHTML=`${r}<span class="unit">%</span>`,v.innerHTML=`${u(l)}<span class="unit">건</span>`,requestAnimationFrame(()=>{$.style.width=`${r}%`})})();window.CacheManager&&CacheManager.checkAndAutoClean();(function(){const e=localStorage.getItem("app_org_name");if(e){const n=document.getElementById("orgNameDisplay");n&&(n.textContent=e)}})();(async function(){var n,a;const e=document.getElementById("appVersion");if((n=window.electronAPI)!=null&&n.getVersion)try{const t=await window.electronAPI.getVersion();t&&(e.textContent="v"+t)}catch(t){(((a=window.logger)==null?void 0:a.info)||console.info)("버전 정보 가져오기 실패:",t)}})();(async function(){const e=document.getElementById("syncStatus");window.storageManager&&await window.storageManager.init()==="cloud"&&(e.style.display="block",b())})();function b(){const e=document.getElementById("syncStatus");if(!e||!window.storageManager)return;const n=window.storageManager.getStatus(),a=e.querySelector(".sync-icon"),t=e.querySelector(".sync-text");n.isOnline?(a.textContent="☁️",t.textContent="클라우드 동기화",e.style.color="#22c55e"):(a.textContent="📴",t.textContent="오프라인 모드",e.style.color="#f59e0b")}window.addEventListener("online",b);window.addEventListener("offline",b);const L=[{type:"soil",name:"토양",icon:"🌱",storagePrefix:"soilSampleLogs"},{type:"water",name:"수질분석",icon:"💧",storagePrefix:"waterSampleLogs"},{type:"compost",name:"퇴·액비",icon:"🐄",storagePrefix:"compostSampleLogs"},{type:"heavyMetal",name:"토양 중금속",icon:"⚗️",storagePrefix:"heavyMetalSampleLogs"},{type:"pesticide",name:"잔류농약",icon:"🧪",storagePrefix:"pesticideSampleLogs"}],D=2020,w=document.getElementById("syncBtn"),p=document.getElementById("syncModal"),A=document.getElementById("syncModalBody"),C=document.getElementById("syncModalClose"),B=document.getElementById("syncModalOk");function P(){p.classList.remove("show")}C==null||C.addEventListener("click",P);B==null||B.addEventListener("click",P);p==null||p.addEventListener("click",e=>{e.target===p&&P()});async function T(){var c,i,g,h,E,S,$,v;if(!((c=window.firestoreDb)!=null&&c.isEnabled())&&(i=window.firebaseConfig)!=null&&i.initialize)try{await window.firebaseConfig.initialize()&&await((g=window.firestoreDb)==null?void 0:g.init())}catch(o){(((h=window.logger)==null?void 0:h.warn)||console.warn)("Firebase 초기화 실패:",o)}if(!((E=window.firestoreDb)!=null&&E.isEnabled())){alert(`Firebase가 설정되지 않았습니다.
설정 페이지에서 인증 파일을 등록해주세요.`);return}w.classList.add("syncing");const e=new Date().getFullYear(),n=[],a=L.length*(e-D+1);let t=0;N(L);try{for(let o=0;o<L.length;o++){const y=L[o];let m=0,I=[];x(o,"syncing","동기화 중...");for(let r=D;r<=e;r++){try{let l,u=!1;if(typeof window.firestoreDb.getAllWithMeta=="function"){const d=await window.firestoreDb.getAllWithMeta(y.type,r);l=d.documents,u=d.fromCache===!0}else l=await window.firestoreDb.getAll(y.type,r);const s=`${y.storagePrefix}_${r}`;if(l&&l.length>0){const d=(S=window.SyncUtils)!=null&&S.smartMerge?(()=>{let f;try{f=JSON.parse(localStorage.getItem(s)||"[]")}catch{f=[]}return Array.isArray(f)||(f=[]),(window.SyncUtils.mergeCloudData?window.SyncUtils.mergeCloudData(f,l,{fromCache:u}):{data:window.SyncUtils.smartMerge(f,l,{allowDeletions:!u}).data}).data})():l;localStorage.setItem(s,JSON.stringify(d)),m+=d.length,I.push({year:r,count:d.length})}}catch(l){((($=window.logger)==null?void 0:$.error)||console.error)(`${y.name} ${r}년 동기화 오류:`,l)}t++,F(t,a,`${y.name} ${r}년...`)}const M=m>0?`${m}건 완료`:"데이터 없음";x(o,m>0?"success":"",M),n.push({type:y.type,name:y.name,icon:y.icon,totalCount:m,yearsWithData:I,success:!0})}H(n)}catch(o){(((v=window.logger)==null?void 0:v.error)||console.error)("동기화 오류:",o),alert("동기화 중 오류가 발생했습니다: "+o.message)}finally{w.classList.remove("syncing")}}function N(e){let n=`
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
        `}),A.innerHTML=n,p.classList.add("show")}function F(e,n,a){const t=Math.round(e/n*100),c=document.getElementById("syncProgressFill"),i=document.getElementById("syncProgressLabel"),g=document.getElementById("syncProgressPercent");c&&(c.style.width=`${t}%`),i&&(i.textContent=a),g&&(g.textContent=`${t}%`)}function x(e,n,a){const t=document.getElementById(`syncItem${e}`),c=document.getElementById(`syncStatus${e}`);t&&(t.className=`sync-result-item ${n}`),c&&(c.className=`sync-result-count ${n}`,c.textContent=a)}function H(e){let n=0,a="";e.forEach(t=>{n+=t.totalCount;const c=t.totalCount>0?"success":"";t.yearsWithData.length>0&&t.yearsWithData.map(i=>`${i.year}년: ${i.count}건`).join(", "),a+=`
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
    `,A.innerHTML=a,p.classList.add("show")}w==null||w.addEventListener("click",T);
