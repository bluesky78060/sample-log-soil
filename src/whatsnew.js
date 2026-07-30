// 새 버전 첫 실행 시 주요 수정사항 팝업 (SLS-1-218)
//
// 왜 필요한가: 버전이 올라가도 사용자는 무엇이 바뀌었는지 모른다. 릴리스 노트 페이지는
// 따로 들어가야 보이므로, SLS-1-217처럼 데이터 유실을 막은 중요한 수정도 그냥 지나친다.
// 이 팝업이 그 창구다.
//
// ⚠️ 이 주석의 초안은 "자동 업데이트가 무음으로 동작하지 않는다"를 근거로 들었으나
//    **사실이 아니다**(2026-07-30 사용자 확인: 자동 업데이트는 되고 있다).
//    당시 조사에서 setup.exe 다운로드 수를 "수동 설치"로 오해했는데, latest.yml의
//    path가 setup.exe이므로 그 숫자가 곧 **업데이터가 받아간 것**이었다.
//    Windows 실기 검증 없이 단정한 오류다. 이 기능의 정당성은 위 문장만으로 충분하다.
//
// 내용은 src/shared/whatsnew-data.js(빌드 생성물)에서 온다.
// 작성자가 릴리스 노트에 data-popup을 붙인 항목만 담긴다 — scripts/extract-whatsnew.js 참조.
//
// ⚠️ CSP가 인라인 스크립트를 금지하므로 이 파일은 반드시 별도 모듈이어야 한다
//    (src/main-stats.js가 같은 이유로 분리돼 있다).

const SEEN_KEY = 'lastSeenVersion';

// 이 팝업이 닫히면(또는 애초에 안 뜨면) resolve된다. 공지 팝업(SLS-1-219)이 기다린다.
let _markClosed;
const closedPromise = new Promise((resolve) => { _markClosed = resolve; });
/** 여러 번 불려도 안전하다 (Promise는 한 번만 resolve된다) */
function markClosed() { _markClosed?.(); }

/**
 * '1.9.0' vs '1.14.0' 을 문자열로 비교하면 틀린다 ('1.9' > '1.14').
 * 자리별 숫자로 비교한다.
 * @returns {number} a>b: 1, a<b: -1, 같으면 0
 */
function compareVersions(a, b) {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d > 0 ? 1 : -1;
    }
    return 0;
}

/**
 * 마지막으로 본 버전 이후 ~ 현재 버전 이하 구간의 항목을 최신순으로 모은다.
 *
 * 여러 버전을 한 번에 올린 사용자(오래 방치했다 재설치)가 이 기능의 주 대상이다.
 * 최신 버전 하나만 보여주면 중간 버전의 중요 수정을 영원히 못 본다.
 */
function pickEntries(entries, seenVersion, currentVersion) {
    return (entries || [])
        .filter((e) => e && e.version)
        .filter((e) => compareVersions(e.version, seenVersion) > 0)
        .filter((e) => compareVersions(e.version, currentVersion) <= 0)
        .sort((a, b) => compareVersions(b.version, a.version));
}

/** 기록 실패가 다른 동작을 막지 않도록 항상 감싼다 */
function rememberVersion(version) {
    try {
        // 기록을 뒤로 밀지 않는다. 낮은 버전을 재설치하면 기준점이 내려가고,
        // 나중에 다시 올릴 때 이미 본 항목이 또 뜬다.
        const prev = localStorage.getItem(SEEN_KEY);
        if (prev && compareVersions(version, prev) < 0) return;
        localStorage.setItem(SEEN_KEY, version);
    } catch (e) {
        // localStorage 용량 초과 등. 팝업이 다시 뜨는 것은 감수한다 (SLS-1-198 참조).
        (window.logger?.warn || console.warn)('[whatsnew] 버전 기록 실패:', e?.message || e);
    }
}

/** 모달 본문을 그린다. items는 textContent로만 넣는다 — innerHTML 미사용 */
function renderBody(container, entries) {
    container.textContent = '';
    for (const entry of entries) {
        const block = document.createElement('div');
        block.className = 'whatsnew-entry';

        const head = document.createElement('div');
        head.className = 'whatsnew-entry-head';
        const ver = document.createElement('span');
        ver.className = 'whatsnew-version';
        ver.textContent = `v${entry.version}`;
        const date = document.createElement('span');
        date.className = 'whatsnew-date';
        date.textContent = entry.date || '';
        head.append(ver, date);

        const title = document.createElement('div');
        title.className = 'whatsnew-title';
        title.textContent = entry.title || '';

        const list = document.createElement('ul');
        list.className = 'whatsnew-items';
        for (const item of entry.items || []) {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        }

        block.append(head, title, list);
        container.appendChild(block);
    }
}

/**
 * 실행 중인 앱 버전.
 *
 * ⚠️ 메인 페이지에서는 window.APP_VERSION을 쓸 수 없다 — main-entry.js가 constants.js를
 *    import하지 않는다(빌드본 확인: main 번들에 APP_VERSION 0회). 그래서 생성물의
 *    generatedFor를 쓴다. 이 값은 빌드 시 package.json에서 온 것이므로 곧 앱 버전이다.
 *    다른 페이지에서 재사용할 때를 위해 APP_VERSION이 있으면 그쪽을 우선한다.
 */
function resolveCurrentVersion() {
    return window.APP_VERSION || window.WHATS_NEW?.generatedFor || null;
}

function initWhatsNew() {
    const current = resolveCurrentVersion();
    if (!current) return;

    const seen = localStorage.getItem(SEEN_KEY);

    // 첫 설치 — 바뀐 게 없으니 띄우지 않는다. 조용히 기준점만 잡는다.
    if (!seen) {
        rememberVersion(current);
        return;
    }

    if (seen === current) return;

    const data = window.WHATS_NEW;
    if (!data || !Array.isArray(data.entries)) return;

    const picked = pickEntries(data.entries, seen, current);

    // 이 구간에 지정된 중요 항목이 없었다 — 띄울 것이 없으니 기준점만 옮긴다.
    if (picked.length === 0) {
        rememberVersion(current);
        return;
    }

    const modal = document.getElementById('whatsnewModal');
    const body = document.getElementById('whatsnewBody');
    const okBtn = document.getElementById('whatsnewOk');
    if (!modal || !body || !okBtn) return;

    renderBody(body, picked);

    // ⚠️ 닫기 순서를 바꾸지 말 것.
    //    setItem을 먼저 하면 용량 초과 시 예외가 닫기를 막아 모달이 안 닫히고,
    //    기록도 안 됐으니 새로고침해도 또 뜬다 → 앱을 못 쓴다.
    // 노출은 .sync-modal.show 클래스로 한다 (index.html:823의 기존 관행)
    const close = () => {
        modal.classList.remove('show');   // ① UI 먼저
        rememberVersion(current);          // ② 기록은 try/catch 안에서
        markClosed();                      // ③ 뒤따르는 팝업을 풀어준다
    };

    okBtn.addEventListener('click', close);
    modal.querySelector('.whatsnew-close')?.addEventListener('click', close);
    // 배경(오버레이) 클릭으로도 닫는다 — syncModal과 같은 동작(main-init.js:96-98).
    // e.target 검사가 없으면 카드 안을 눌러도 닫혀 읽는 중에 사라진다.
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    modal.classList.add('show');
    return true;   // 띄웠다 — whenClosed()는 닫힐 때까지 대기한다
}

// 팝업 때문에 앱이 안 켜지면 본말이 전도된다. 실패는 콘솔에만 남긴다.
// 띄우지 못했거나(대다수 경로) 실패했으면 즉시 markClosed() — 뒤따르는 팝업이
// 영원히 기다리지 않게 한다(SLS-1-219).
try {
    if (!initWhatsNew()) markClosed();
} catch (e) {
    (window.logger?.warn || console.warn)('[whatsnew] 초기화 실패:', e?.message || e);
    markClosed();
}

// 이 팝업이 닫힌(또는 애초에 안 뜬) 뒤에 다른 팝업을 띄우기 위한 프로덕션 API (SLS-1-219).
// 두 팝업이 같은 .sync-modal z-index를 공유해 동시에 뜨면 겹쳐 깨진다.
//
// ⚠️ 아래 __whatsnew(테스트 전용)에 얹지 않는다. 거기에 프로덕션 API를 넣으면
//    "프로덕션 동작에는 쓰이지 않는다"는 주석이 거짓이 되어, 후임자가 그 객체를
//    마음대로 바꿔도 된다고 오판한다.
window.whatsNewPopup = { whenClosed: () => closedPromise };

// 테스트용 노출 (프로덕션 동작에는 쓰이지 않는다)
window.__whatsnew = { compareVersions, pickEntries, initWhatsNew, resolveCurrentVersion, SEEN_KEY };
