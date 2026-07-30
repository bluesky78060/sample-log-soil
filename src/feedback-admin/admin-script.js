// ========================================
// 관리자 페이지 로직 (SLS-1-154)
// 이메일/비밀번호 로그인 → 전체 문의 답변/상태 + 공지 관리.
// 보안 규칙(firestore.rules)의 isAdmin(ADMIN_UID)으로 권한이 강제된다.
// ========================================

const $ = (id) => document.getElementById(id);
const INQUIRY_COL = 'feedbackInquiries';
const NOTICE_COL = 'feedbackNotices';
const STATUSES = ['접수', '처리중', '완료'];

function db() { return window.feedbackFirebase?.getDb?.(); }

function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function showAdmin() { $('loginSection').style.display = 'none'; $('adminSection').style.display = 'block'; }
function showLogin() { $('adminSection').style.display = 'none'; $('loginSection').style.display = 'block'; }

/** 로그인 */
async function onLogin(e) {
    e.preventDefault();
    const email = $('adminEmail').value.trim();
    const pw = $('adminPassword').value;
    if (!email || !pw) { window.showToast?.('이메일과 비밀번호를 입력하세요.', 'warning'); return; }
    const btn = $('loginBtn');
    btn.disabled = true;
    const r = await window.feedbackFirebase.signInAdmin(email, pw);
    btn.disabled = false;
    if (!r.ok) { window.showToast?.(r.error || '로그인에 실패했습니다.', 'error'); return; }
    $('adminPassword').value = '';
    showAdmin();
    window.showToast?.('로그인되었습니다.', 'success');
    await Promise.all([loadInquiries(), loadNotices()]);
}

/** 로그아웃 */
async function onLogout() {
    await window.feedbackFirebase.signOutAdmin();
    showLogin();
    window.showToast?.('로그아웃되었습니다.', 'success');
}

/** 전체 문의 조회 + 답변 UI 렌더 */
async function loadInquiries() {
    const wrap = $('inquiryList');
    wrap.innerHTML = '<div class="hint">불러오는 중...</div>';
    const docs = [];
    try {
        const snap = await db().collection(INQUIRY_COL).get();
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    } catch (e) {
        (window.logger?.error || console.error)('[admin] 문의 조회 실패:', e);
        window.setInnerHTML(wrap, '<div class="hint">조회 실패 — 보안 규칙의 ADMIN_UID가 이 계정 UID로 설정됐는지 확인하세요.</div>');
        $('inquiryCount').textContent = '0';
        return;
    }
    docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    $('inquiryCount').textContent = String(docs.length);
    if (!docs.length) { window.setInnerHTML(wrap, '<div class="hint">등록된 문의가 없습니다.</div>'); return; }

    const esc = window.escapeHTML;
    wrap.innerHTML = '';
    docs.forEach((q) => {
        const card = document.createElement('div');
        card.className = 'item';
        const meta = [fmtDate(q.createdAt), q.org, q.contact].filter(Boolean).map(esc).join(' · ');
        card.innerHTML = window.sanitizeHTML(`
            <div class="item-head">
                <span class="type">${esc(q.type)}</span>
                <span class="meta">${meta}</span>
            </div>
            <div class="title">${esc(q.title)}</div>
            <div class="body">${esc(q.body).replace(/\n/g, '<br>')}</div>
        `);

        // 답변/상태 입력 (이벤트 보존을 위해 DOM으로 생성)
        const area = document.createElement('div');
        area.className = 'reply-area';
        const sel = document.createElement('select');
        STATUSES.forEach((s) => {
            const o = document.createElement('option');
            o.value = s; o.textContent = s;
            if (s === q.status) o.selected = true;
            sel.appendChild(o);
        });
        const ta = document.createElement('textarea');
        ta.placeholder = '답변을 입력하세요';
        ta.value = q.reply || '';
        const btn = document.createElement('button');
        btn.className = 'btn-primary';
        btn.textContent = '답변 저장';
        btn.addEventListener('click', () => saveReply(q.id, ta.value, sel.value, btn));
        area.appendChild(sel);
        area.appendChild(ta);
        area.appendChild(btn);
        card.appendChild(area);
        wrap.appendChild(card);
    });
}

/** 답변/상태 저장 */
async function saveReply(id, reply, status, btn) {
    btn.disabled = true;
    try {
        await db().collection(INQUIRY_COL).doc(id).update({ reply: (reply || '').trim(), status });
        window.showToast?.('답변이 저장되었습니다.', 'success');
    } catch (e) {
        (window.logger?.error || console.error)('[admin] 답변 저장 실패:', e);
        window.showToast?.('저장 실패 — 관리자 권한을 확인하세요.', 'error');
    }
    btn.disabled = false;
}

/** 공지 조회 */
async function loadNotices() {
    const wrap = $('noticeList');
    wrap.innerHTML = '<div class="hint">불러오는 중...</div>';
    const docs = [];
    try {
        const snap = await db().collection(NOTICE_COL).get();
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    } catch (e) {
        window.setInnerHTML(wrap, '<div class="hint">조회 실패</div>');
        return;
    }
    docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (!docs.length) { window.setInnerHTML(wrap, '<div class="hint">등록된 공지가 없습니다.</div>'); return; }
    const esc = window.escapeHTML;
    wrap.innerHTML = '';
    docs.forEach((n) => {
        const card = document.createElement('div');
        card.className = 'item';
        // 팝업 여부·만료 상태 표시 (SLS-1-219) — 관리자가 목록에서 바로 알 수 있게
        // ⚠️ 여기서 직접 날짜를 만들지 말 것. UTC(toISOString)로 계산하면 KST에서
        //    매일 00:00~08:59에 팝업(로컬 기준)과 하루 어긋난다 — 코드리뷰 MAJOR.
        const expired = window.isNoticeExpired(n.until);
        const badges = [];
        if (n.popup === true) {
            badges.push(expired
                ? '<span class="meta">📢 팝업(종료됨)</span>'
                : '<span class="meta">📢 팝업</span>');
        }
        if (n.until) badges.push(`<span class="meta">~${esc(n.until)}</span>`);

        card.innerHTML = window.sanitizeHTML(`
            <div class="item-head">
                <span class="title">${esc(n.title)}</span>
                <span class="meta">${esc(fmtDate(n.createdAt))}</span>
            </div>
            ${badges.length ? `<div>${badges.join(' ')}</div>` : ''}
            <div class="body">${esc(n.body).replace(/\n/g, '<br>')}</div>
        `);
        const del = document.createElement('button');
        del.className = 'btn-danger';
        del.textContent = '삭제';
        del.addEventListener('click', () => deleteNotice(n.id));
        card.appendChild(del);
        wrap.appendChild(card);
    });
}

/** 공지 등록 */
async function addNotice(e) {
    e.preventDefault();
    const title = $('noticeTitle').value.trim();
    const body = $('noticeBody').value.trim();
    if (!title || !body) { window.showToast?.('제목과 내용을 입력하세요.', 'warning'); return; }
    // 팝업 알림 / 표시 종료일 (SLS-1-219)
    const popup = $('noticePopup')?.checked === true;
    const until = ($('noticeUntil')?.value || '').trim();
    try {
        await db().collection(NOTICE_COL).add({
            title,
            body,
            createdAt: new Date().toISOString(),
            // popup은 항상 boolean으로 저장한다. notice-popup.js가 `=== true`로 엄격
            // 비교하므로, 이 필드가 없는 기존 공지는 팝업에 나오지 않는다(의도).
            popup,
            ...(until ? { until } : {}),
        });
        $('noticeTitle').value = '';
        $('noticeBody').value = '';
        if ($('noticePopup')) $('noticePopup').checked = false;
        if ($('noticeUntil')) $('noticeUntil').value = '';
        window.showToast?.('공지가 등록되었습니다.', 'success');
        await loadNotices();
    } catch (e2) {
        (window.logger?.error || console.error)('[admin] 공지 등록 실패:', e2);
        window.showToast?.('등록 실패 — 관리자 권한을 확인하세요.', 'error');
    }
}

/** 공지 삭제 */
async function deleteNotice(id) {
    if (!window.confirm('이 공지를 삭제하시겠습니까?')) return;
    try {
        await db().collection(NOTICE_COL).doc(id).delete();
        window.showToast?.('삭제되었습니다.', 'success');
        await loadNotices();
    } catch (e) {
        window.showToast?.('삭제 실패', 'error');
    }
}

function init() {
    $('loginForm')?.addEventListener('submit', onLogin);
    $('noticeForm')?.addEventListener('submit', addNotice);
    $('logoutBtn')?.addEventListener('click', onLogout);
    $('refreshBtn')?.addEventListener('click', () => Promise.all([loadInquiries(), loadNotices()]));
    // 웹(데스크톱 아님)에서는 게시판 설정이 없어 로그인 불가 — 안내 노출
    if (!window.electronAPI?.isElectron) {
        const w = $('webWarn');
        if (w) w.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', init);
