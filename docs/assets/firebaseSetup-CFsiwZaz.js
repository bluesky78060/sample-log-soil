import"./frame-guard-BIL41LH3.js";function n(t,e){document.querySelectorAll(".tab").forEach(c=>c.classList.remove("active")),document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active")),t.classList.add("active"),document.getElementById(e).classList.add("active")}function i(t){t.parentElement.classList.toggle("open")}function l(t){t.classList.toggle("checked");const e=t.closest(".checklist");if(e&&e===document.querySelector("#section-checklist .checklist")){const c=e.querySelectorAll("li").length,a=e.querySelectorAll("li.checked").length,s=document.getElementById("checklist-complete");s&&(s.style.display=a===c?"block":"none")}}function d(t,e){navigator.clipboard.writeText(e).then(()=>{t.textContent="복사됨!",t.classList.add("copied"),setTimeout(()=>{t.textContent="복사",t.classList.remove("copied")},2e3)})}function r(t){navigator.clipboard.writeText(`{
    "apiKey": "여기에_apiKey_값",
    "authDomain": "여기에_authDomain_값",
    "projectId": "여기에_projectId_값",
    "storageBucket": "여기에_storageBucket_값",
    "messagingSenderId": "여기에_messagingSenderId_값",
    "appId": "여기에_appId_값"
}`).then(()=>{t.textContent="복사됨!",t.classList.add("copied"),setTimeout(()=>{t.textContent="복사",t.classList.remove("copied")},2e3)})}function u(t){navigator.clipboard.writeText(`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`).then(()=>{t.textContent="복사됨!",t.classList.add("copied"),setTimeout(()=>{t.textContent="복사",t.classList.remove("copied")},2e3)})}const o={"switch-tab":t=>n(t,t.dataset.tab),"toggle-faq":t=>i(t),"toggle-check":t=>l(t),"copy-text":t=>d(t,t.dataset.text),"copy-json":t=>r(t),"copy-rules":t=>u(t)};document.addEventListener("click",t=>{var c;const e=t.target.closest("[data-action]");e&&((c=o[e.dataset.action])==null||c.call(o,e))});
