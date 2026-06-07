import"./theme-D1BqTDsX.js";/* empty css                        */import"./storage-manager-BSrkTrn2.js";import"./cache-manager-nqFa1f2l.js";(function(){const n=new Date().getFullYear(),o=new Date().getMonth(),t=`soilSampleLogs_${n}`,c=document.getElementById("statsYear"),r=document.getElementById("statsRows"),m=document.getElementById("statsEmpty"),h=document.getElementById("statsTotal"),v=document.getElementById("statsMonth"),$=document.getElementById("statsCompleteRate"),S=document.getElementById("statsProgressBar"),i=document.getElementById("statsIncomplete");if(!c||!r||!m)return;c.textContent=`${n}년`;let a=[];try{const s=localStorage.getItem(t);a=s?JSON.parse(s):[],Array.isArray(a)||(a=[])}catch{a=[]}if(a.length===0){r.style.display="none",m.style.display="block";return}const y=s=>!(s&&s.receptionNumber?String(s.receptionNumber):"").replace(/^F/,"").includes("-"),f=a.length,M=a.filter(s=>{if(!s||!s.date)return!1;const w=new Date(s.date);return!isNaN(w)&&w.getFullYear()===n&&w.getMonth()===o}).length,d=a.filter(s=>s&&s.isComplete===!0).length,l=f===0?0:Math.round(d/f*100),B=a.filter(s=>s&&s.isComplete!==!0&&y(s)).length,C=s=>s.toLocaleString("ko-KR");h.innerHTML=`${C(f)}<span class="unit">건</span>`,v.innerHTML=`${C(M)}<span class="unit">건</span>`,$.innerHTML=`${l}<span class="unit">%</span>`,i.innerHTML=`${C(B)}<span class="unit">건</span>`;const Y="농가의뢰",F=document.getElementById("statsLandClass"),k=document.getElementById("statsLandClassRows");if(F&&k){const s=new Map;a.forEach(u=>{const g=String(u&&u.landClass1||Y);s.set(g,(s.get(g)||0)+1)}),[...s.entries()].sort((u,g)=>g[1]-u[1]||u[0].localeCompare(g[0],"ko")).forEach(([u,g])=>{const b=document.createElement("div");b.className="stats-landclass-row";const P=document.createElement("span");P.className="stats-landclass-label",P.textContent=u;const L=document.createElement("span");L.className="stats-landclass-value",L.textContent=C(g);const x=document.createElement("span");x.className="unit",x.textContent="건",L.appendChild(x),b.append(P,L),k.appendChild(b)}),F.style.display=""}requestAnimationFrame(()=>{S.style.width=`${l}%`})})();window.CacheManager&&CacheManager.checkAndAutoClean();(function(){const e=localStorage.getItem("app_org_name");if(e){const n=document.getElementById("orgNameDisplay");n&&(n.textContent=e)}})();(async function(){var n,o;const e=document.getElementById("appVersion");if((n=window.electronAPI)!=null&&n.getVersion)try{const t=await window.electronAPI.getVersion();t&&(e.textContent="v"+t)}catch(t){(((o=window.logger)==null?void 0:o.info)||console.info)("버전 정보 가져오기 실패:",t)}})();(async function(){const e=document.getElementById("syncStatus");window.storageManager&&await window.storageManager.init()==="cloud"&&(e.style.display="block",T())})();function T(){const e=document.getElementById("syncStatus");if(!e||!window.storageManager)return;const n=window.storageManager.getStatus(),o=e.querySelector(".sync-icon"),t=e.querySelector(".sync-text");n.isOnline?(o.textContent="☁️",t.textContent="클라우드 동기화",e.style.color="#22c55e"):(o.textContent="📴",t.textContent="오프라인 모드",e.style.color="#f59e0b")}window.addEventListener("online",T);window.addEventListener("offline",T);const I=[{type:"soil",name:"토양",icon:"🌱",storagePrefix:"soilSampleLogs"},{type:"water",name:"수질분석",icon:"💧",storagePrefix:"waterSampleLogs"},{type:"compost",name:"퇴·액비",icon:"🐄",storagePrefix:"compostSampleLogs"},{type:"heavyMetal",name:"토양 중금속",icon:"⚗️",storagePrefix:"heavyMetalSampleLogs"},{type:"pesticide",name:"잔류농약",icon:"🧪",storagePrefix:"pesticideSampleLogs"}],H=2020,E=document.getElementById("syncBtn"),p=document.getElementById("syncModal"),R=document.getElementById("syncModalBody"),D=document.getElementById("syncModalClose"),N=document.getElementById("syncModalOk");function A(){p.classList.remove("show")}D==null||D.addEventListener("click",A);N==null||N.addEventListener("click",A);p==null||p.addEventListener("click",e=>{e.target===p&&A()});async function z(){var c,r,m,h,v,$,S;if(!((c=window.firestoreDb)!=null&&c.isEnabled())&&(r=window.firebaseConfig)!=null&&r.initialize)try{await window.firebaseConfig.initialize()&&await((m=window.firestoreDb)==null?void 0:m.init())}catch(i){(((h=window.logger)==null?void 0:h.warn)||console.warn)("Firebase 초기화 실패:",i)}if(!((v=window.firestoreDb)!=null&&v.isEnabled())){alert(`Firebase가 설정되지 않았습니다.
설정 페이지에서 인증 파일을 등록해주세요.`);return}E.classList.add("syncing");const e=new Date().getFullYear(),n=[],o=I.length*(e-H+1);let t=0;O(I);try{for(let i=0;i<I.length;i++){const a=I[i];let y=0,f=[];_(i,"syncing","동기화 중...");for(let d=H;d<=e;d++){try{const l=await window.firestoreDb.getAll(a.type,d),B=`${a.storagePrefix}_${d}`;l&&l.length>0&&(localStorage.setItem(B,JSON.stringify(l)),y+=l.length,f.push({year:d,count:l.length}))}catch(l){((($=window.logger)==null?void 0:$.error)||console.error)(`${a.name} ${d}년 동기화 오류:`,l)}t++,W(t,o,`${a.name} ${d}년...`)}const M=y>0?`${y}건 완료`:"데이터 없음";_(i,y>0?"success":"",M),n.push({type:a.type,name:a.name,icon:a.icon,totalCount:y,yearsWithData:f,success:!0})}q(n)}catch(i){(((S=window.logger)==null?void 0:S.error)||console.error)("동기화 오류:",i),alert("동기화 중 오류가 발생했습니다: "+i.message)}finally{E.classList.remove("syncing")}}function O(e){let n=`
        <div class="sync-progress">
            <div class="sync-progress-text">
                <span id="syncProgressLabel">준비 중...</span>
                <span id="syncProgressPercent">0%</span>
            </div>
            <div class="sync-progress-bar">
                <div class="sync-progress-fill" id="syncProgressFill"></div>
            </div>
        </div>
    `;e.forEach((o,t)=>{n+=`
            <div class="sync-result-item" id="syncItem${t}">
                <div class="sync-result-type">
                    <span>${escapeHTML(o.icon)}</span>
                    <span>${escapeHTML(o.name)}</span>
                </div>
                <div class="sync-result-count" id="syncStatus${t}">대기 중</div>
            </div>
        `}),R.innerHTML=n,p.classList.add("show")}function W(e,n,o){const t=Math.round(e/n*100),c=document.getElementById("syncProgressFill"),r=document.getElementById("syncProgressLabel"),m=document.getElementById("syncProgressPercent");c&&(c.style.width=`${t}%`),r&&(r.textContent=o),m&&(m.textContent=`${t}%`)}function _(e,n,o){const t=document.getElementById(`syncItem${e}`),c=document.getElementById(`syncStatus${e}`);t&&(t.className=`sync-result-item ${n}`),c&&(c.className=`sync-result-count ${n}`,c.textContent=o)}function q(e){let n=0,o="";e.forEach(t=>{n+=t.totalCount;const c=t.totalCount>0?"success":"";t.yearsWithData.length>0&&t.yearsWithData.map(r=>`${r.year}년: ${r.count}건`).join(", "),o+=`
            <div class="sync-result-item">
                <div class="sync-result-type">
                    <span>${escapeHTML(t.icon)}</span>
                    <span>${escapeHTML(t.name)}</span>
                </div>
                <div class="sync-result-count ${c}">
                    ${t.totalCount>0?`${t.totalCount}건 동기화`:"데이터 없음"}
                </div>
            </div>
        `}),o+=`
        <div class="sync-result-item" style="margin-top: 1rem; background: linear-gradient(135deg, #22c55e20, #3b82f620);">
            <div class="sync-result-type">
                <span>📊</span>
                <span><strong>총 동기화</strong></span>
            </div>
            <div class="sync-result-count success">
                <strong>${n}건</strong>
            </div>
        </div>
    `,R.innerHTML=o,p.classList.add("show")}E==null||E.addEventListener("click",z);
