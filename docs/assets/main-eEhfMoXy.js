import"./theme-D1BqTDsX.js";/* empty css                        */import"./storage-manager-D5rVvuGK.js";import"./cache-manager-nqFa1f2l.js";(function(){const n=new Date().getFullYear(),s=new Date().getMonth(),t=`soilSampleLogs_${n}`,c=document.getElementById("statsYear"),r=document.getElementById("statsRows"),y=document.getElementById("statsEmpty"),f=document.getElementById("statsTotal"),w=document.getElementById("statsMonth"),h=document.getElementById("statsCompleteRate"),E=document.getElementById("statsProgressBar"),i=document.getElementById("statsIncomplete");if(!c||!r||!y)return;c.textContent=`${n}년`;let a=[];try{const o=localStorage.getItem(t);a=o?JSON.parse(o):[],Array.isArray(a)||(a=[])}catch{a=[]}if(a.length===0){r.style.display="none",y.style.display="block";return}const m=o=>!(o&&o.receptionNumber?String(o.receptionNumber):"").replace(/^F/,"").includes("-"),u=a.length,S=a.filter(o=>{if(!o||!o.date)return!1;const $=new Date(o.date);return!isNaN($)&&$.getFullYear()===n&&$.getMonth()===s}).length,d=a.filter(o=>o&&o.isComplete===!0).length,l=u===0?0:Math.round(d/u*100),I=a.filter(o=>o&&o.isComplete!==!0&&m(o)).length,L=o=>o.toLocaleString("ko-KR");f.innerHTML=`${L(u)}<span class="unit">건</span>`,w.innerHTML=`${L(S)}<span class="unit">건</span>`,h.innerHTML=`${l}<span class="unit">%</span>`,i.innerHTML=`${L(I)}<span class="unit">건</span>`,requestAnimationFrame(()=>{E.style.width=`${l}%`})})();window.CacheManager&&CacheManager.checkAndAutoClean();(function(){const e=localStorage.getItem("app_org_name");if(e){const n=document.getElementById("orgNameDisplay");n&&(n.textContent=e)}})();(async function(){var n,s;const e=document.getElementById("appVersion");if((n=window.electronAPI)!=null&&n.getVersion)try{const t=await window.electronAPI.getVersion();t&&(e.textContent="v"+t)}catch(t){(((s=window.logger)==null?void 0:s.info)||console.info)("버전 정보 가져오기 실패:",t)}})();(async function(){const e=document.getElementById("syncStatus");window.storageManager&&await window.storageManager.init()==="cloud"&&(e.style.display="block",B())})();function B(){const e=document.getElementById("syncStatus");if(!e||!window.storageManager)return;const n=window.storageManager.getStatus(),s=e.querySelector(".sync-icon"),t=e.querySelector(".sync-text");n.isOnline?(s.textContent="☁️",t.textContent="클라우드 동기화",e.style.color="#22c55e"):(s.textContent="📴",t.textContent="오프라인 모드",e.style.color="#f59e0b")}window.addEventListener("online",B);window.addEventListener("offline",B);const v=[{type:"soil",name:"토양",icon:"🌱",storagePrefix:"soilSampleLogs"},{type:"water",name:"수질분석",icon:"💧",storagePrefix:"waterSampleLogs"},{type:"compost",name:"퇴·액비",icon:"🐄",storagePrefix:"compostSampleLogs"},{type:"heavyMetal",name:"토양 중금속",icon:"⚗️",storagePrefix:"heavyMetalSampleLogs"},{type:"pesticide",name:"잔류농약",icon:"🧪",storagePrefix:"pesticideSampleLogs"}],b=2020,p=document.getElementById("syncBtn"),g=document.getElementById("syncModal"),D=document.getElementById("syncModalBody"),M=document.getElementById("syncModalClose"),C=document.getElementById("syncModalOk");function P(){g.classList.remove("show")}M==null||M.addEventListener("click",P);C==null||C.addEventListener("click",P);g==null||g.addEventListener("click",e=>{e.target===g&&P()});async function T(){var c,r,y,f,w,h,E;if(!((c=window.firestoreDb)!=null&&c.isEnabled())&&(r=window.firebaseConfig)!=null&&r.initialize)try{await window.firebaseConfig.initialize()&&await((y=window.firestoreDb)==null?void 0:y.init())}catch(i){(((f=window.logger)==null?void 0:f.warn)||console.warn)("Firebase 초기화 실패:",i)}if(!((w=window.firestoreDb)!=null&&w.isEnabled())){alert(`Firebase가 설정되지 않았습니다.
설정 페이지에서 인증 파일을 등록해주세요.`);return}p.classList.add("syncing");const e=new Date().getFullYear(),n=[],s=v.length*(e-b+1);let t=0;A(v);try{for(let i=0;i<v.length;i++){const a=v[i];let m=0,u=[];x(i,"syncing","동기화 중...");for(let d=b;d<=e;d++){try{const l=await window.firestoreDb.getAll(a.type,d),I=`${a.storagePrefix}_${d}`;l&&l.length>0&&(localStorage.setItem(I,JSON.stringify(l)),m+=l.length,u.push({year:d,count:l.length}))}catch(l){(((h=window.logger)==null?void 0:h.error)||console.error)(`${a.name} ${d}년 동기화 오류:`,l)}t++,N(t,s,`${a.name} ${d}년...`)}const S=m>0?`${m}건 완료`:"데이터 없음";x(i,m>0?"success":"",S),n.push({type:a.type,name:a.name,icon:a.icon,totalCount:m,yearsWithData:u,success:!0})}F(n)}catch(i){(((E=window.logger)==null?void 0:E.error)||console.error)("동기화 오류:",i),alert("동기화 중 오류가 발생했습니다: "+i.message)}finally{p.classList.remove("syncing")}}function A(e){let n=`
        <div class="sync-progress">
            <div class="sync-progress-text">
                <span id="syncProgressLabel">준비 중...</span>
                <span id="syncProgressPercent">0%</span>
            </div>
            <div class="sync-progress-bar">
                <div class="sync-progress-fill" id="syncProgressFill"></div>
            </div>
        </div>
    `;e.forEach((s,t)=>{n+=`
            <div class="sync-result-item" id="syncItem${t}">
                <div class="sync-result-type">
                    <span>${escapeHTML(s.icon)}</span>
                    <span>${escapeHTML(s.name)}</span>
                </div>
                <div class="sync-result-count" id="syncStatus${t}">대기 중</div>
            </div>
        `}),D.innerHTML=n,g.classList.add("show")}function N(e,n,s){const t=Math.round(e/n*100),c=document.getElementById("syncProgressFill"),r=document.getElementById("syncProgressLabel"),y=document.getElementById("syncProgressPercent");c&&(c.style.width=`${t}%`),r&&(r.textContent=s),y&&(y.textContent=`${t}%`)}function x(e,n,s){const t=document.getElementById(`syncItem${e}`),c=document.getElementById(`syncStatus${e}`);t&&(t.className=`sync-result-item ${n}`),c&&(c.className=`sync-result-count ${n}`,c.textContent=s)}function F(e){let n=0,s="";e.forEach(t=>{n+=t.totalCount;const c=t.totalCount>0?"success":"";t.yearsWithData.length>0&&t.yearsWithData.map(r=>`${r.year}년: ${r.count}건`).join(", "),s+=`
            <div class="sync-result-item">
                <div class="sync-result-type">
                    <span>${escapeHTML(t.icon)}</span>
                    <span>${escapeHTML(t.name)}</span>
                </div>
                <div class="sync-result-count ${c}">
                    ${t.totalCount>0?`${t.totalCount}건 동기화`:"데이터 없음"}
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
    `,D.innerHTML=s,g.classList.add("show")}p==null||p.addEventListener("click",T);
