// ========================================
// 새 문의 알림 — Telegram + EmailJS (SLS-1-153)
// ----------------------------------------
// 문의가 Firestore에 등록되면 관리자에게 알림을 보낸다.
// 자격증명은 feedback-auth.json 의 notify 블록(비공개, Electron 동봉)에서 읽는다.
//   notify: {
//     telegram: { botToken, chatId },
//     emailjs:  { serviceId, templateId, publicKey, toEmail }
//   }
// 정책: fire-and-forget. 알림 전송이 실패해도 문의 등록 자체에는 영향을 주지 않는다.
//       (호출부는 await 하지 않거나, 실패를 삼킨다.)
// ⚠️ 자격증명은 설치본에 동봉되므로 추출 가능(공개는 아님). 닫힌 배포 기준 허용 위험.
// ========================================

/** 알림 페이로드 안정성을 위해 긴 값을 자른다 (Telegram text 4096자 제한 등) */
function cut(v, max) {
    const s = String(v == null ? '' : v);
    return s.length > max ? s.slice(0, max) + '…' : s;
}

/** 문의 내용을 사람이 읽기 좋은 텍스트로 (본문은 길이 제한) */
function formatInquiry(inq) {
    return [
        '📨 새 문의가 등록되었습니다',
        `유형: ${inq.type || '-'}`,
        `기관: ${inq.org || '-'}`,
        `제목: ${cut(inq.title || '-', 200)}`,
        `내용: ${cut(inq.body || '-', 3500)}`,
        `연락처: ${inq.contact || '-'}`
    ].join('\n');
}

/** Telegram 봇으로 전송 */
async function sendTelegram(cfg, inquiry) {
    if (!cfg || !cfg.botToken || !cfg.chatId) return;
    const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cfg.chatId, text: formatInquiry(inquiry) })
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Telegram HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
}

/** EmailJS로 전송 (REST API). strict mode 계정은 accessToken(private key) 필요할 수 있음. */
async function sendEmailJS(cfg, inquiry) {
    if (!cfg || !cfg.serviceId || !cfg.templateId || !cfg.publicKey) return;
    const url = 'https://api.emailjs.com/api/v1.0/email/send';
    const payload = {
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: {
            type: inquiry.type || '-',
            org: inquiry.org || '-',
            title: cut(inquiry.title || '-', 200),
            body: cut(inquiry.body || '-', 4000),
            contact: inquiry.contact || '-',
            to_email: cfg.toEmail || ''
        }
    };
    // strict mode(비브라우저 호출 허용)일 때 private key 사용
    if (cfg.accessToken) payload.accessToken = cfg.accessToken;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`EmailJS HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
}

/**
 * 새 문의 알림 전송 (Telegram + EmailJS 병렬, 실패 무해).
 * @param {Object} inquiry - 등록된 문의 레코드
 */
async function notifyNewInquiry(inquiry) {
    const notify = window.feedbackFirebase?.getNotifyConfig?.();
    if (!notify) return; // 알림 미설정
    const tasks = [];
    if (notify.telegram) {
        tasks.push(sendTelegram(notify.telegram, inquiry)
            .catch((e) => (window.logger?.warn || console.warn)('[notify] Telegram 전송 실패:', e.message)));
    }
    if (notify.emailjs) {
        tasks.push(sendEmailJS(notify.emailjs, inquiry)
            .catch((e) => (window.logger?.warn || console.warn)('[notify] EmailJS 전송 실패:', e.message)));
    }
    await Promise.allSettled(tasks);
}

window.notifyNewInquiry = notifyNewInquiry;
