/**
 * @fileoverview Firebase 설정 안내 페이지 동작 (SLS-1-295)
 * 인라인 <script> 와 onclick= 속성이던 것을 옮겼다: 설치본 CSP(script-src 'self' file:)가 둘 다 막는다.
 * 요소의 `data-action` 으로 가리키고 document 에서 클릭을 한 번에 받는다.
 */
// 클릭재킹 방어는 다른 페이지처럼 맨 처음에 로드한다(SLS-1-132). 이 import 가 있어야 vite 가 modulepreload
// polyfill 을 frame-guard 청크에 그대로 두어 다른 진입 청크의 해시·import 순서가 바뀌지 않는다
import '../shared/frame-guard.js';

// 탭 전환
function switchTab(tabEl, tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tabEl.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// FAQ 토글
function toggleFaq(el) {
    el.parentElement.classList.toggle('open');
}

// 체크리스트 토글
function toggleCheck(el) {
    el.classList.toggle('checked');
    // 완료 메시지 체크
    const checklist = el.closest('.checklist');
    if (checklist && checklist === document.querySelector('#section-checklist .checklist')) {
        const total = checklist.querySelectorAll('li').length;
        const checked = checklist.querySelectorAll('li.checked').length;
        const completeDiv = document.getElementById('checklist-complete');
        if (completeDiv) {
            completeDiv.style.display = (checked === total) ? 'block' : 'none';
        }
    }
}

// 텍스트 복사
function copyText(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '복사됨!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '복사';
            btn.classList.remove('copied');
        }, 2000);
    });
}

// JSON 템플릿 복사
function copyJson(btn) {
    const text = '{\n    "apiKey": "여기에_apiKey_값",\n    "authDomain": "여기에_authDomain_값",\n    "projectId": "여기에_projectId_값",\n    "storageBucket": "여기에_storageBucket_값",\n    "messagingSenderId": "여기에_messagingSenderId_값",\n    "appId": "여기에_appId_값"\n}';
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '복사됨!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '복사';
            btn.classList.remove('copied');
        }, 2000);
    });
}

// 보안 규칙 복사
function copyRules(btn) {
    const text = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}";
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '복사됨!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '복사';
            btn.classList.remove('copied');
        }, 2000);
    });
}

const ACTIONS = {
    'switch-tab': (el) => switchTab(el, el.dataset.tab),
    'toggle-faq': (el) => toggleFaq(el),
    'toggle-check': (el) => toggleCheck(el),
    'copy-text': (el) => copyText(el, el.dataset.text),
    'copy-json': (el) => copyJson(el),
    'copy-rules': (el) => copyRules(el),
};

document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (el) ACTIONS[el.dataset.action]?.(el);
});
