// 메인 페이지 시료 통계 패널 (토양 / 가축분뇨 퇴비)
// localStorage({storageKey}_{year}) 기반 즉시 표시
// CSP 정책상 인라인 <script>가 차단되므로 ES 모듈로 분리
// SLS-1-195: 퇴비 추가에 따라 시료 종별로 파라미터화

/**
 * 통계 패널 1개를 렌더링한다.
 * @param {Object} opts
 * @param {string} opts.storageKey - 연도 접미사 제외한 localStorage 키 (예: 'soilSampleLogs')
 * @param {Object} opts.ids - DOM id 모음 (year/rows/empty/total/month/rate/bar/incomplete)
 * @param {boolean} opts.countIncompleteMainParcelOnly - 미완료 집계를 본필지로 한정할지
 *        (토양만 true — 하위필지 '503-1'은 본필지 '503'에 종속되므로 중복 집계를 피한다)
 */
function renderStats({ storageKey, ids, countIncompleteMainParcelOnly }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  const $year = document.getElementById(ids.year);
  const $rows = document.getElementById(ids.rows);
  const $empty = document.getElementById(ids.empty);
  const $total = document.getElementById(ids.total);
  const $month = document.getElementById(ids.month);
  const $rate = document.getElementById(ids.rate);
  const $bar = document.getElementById(ids.bar);
  const $incomplete = document.getElementById(ids.incomplete);

  // 8개 전부 검사한다 — 일부만 검사하면 뒤쪽 innerHTML 대입에서 던진다
  if (!$year || !$rows || !$empty || !$total || !$month || !$rate || !$bar || !$incomplete) return;

  $year.textContent = `${year}년`;

  let logs = [];
  try {
    const raw = localStorage.getItem(`${storageKey}_${year}`);
    logs = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(logs)) logs = [];
  } catch (_) {
    logs = [];
  }

  if (logs.length === 0) {
    $rows.style.display = 'none';
    $empty.style.display = 'block';
    return;
  }

  // 본필지 판별: receptionNumber에서 F 접두사 제거 후 '-'가 없으면 본필지
  // 예: '503' / 'F503' → 본필지, '503-1' / 'F503-2' → 하위필지
  const isMainParcel = (log) => {
    const rec = (log && log.receptionNumber) ? String(log.receptionNumber) : '';
    return !rec.replace(/^F/, '').includes('-');
  };

  const total = logs.length;
  const monthCount = logs.filter((log) => {
    if (!log || !log.date) return false;
    const d = new Date(log.date);
    return !isNaN(d) && d.getFullYear() === year && d.getMonth() === month;
  }).length;
  const completeCount = logs.filter((log) => log && log.isComplete === true).length;
  const rate = total === 0 ? 0 : Math.round((completeCount / total) * 100);
  const incompleteCount = logs.filter(
    (log) => log && log.isComplete !== true && (!countIncompleteMainParcelOnly || isMainParcel(log))
  ).length;

  const fmt = (n) => n.toLocaleString('ko-KR');
  $total.innerHTML = `${fmt(total)}<span class="unit">건</span>`;
  $month.innerHTML = `${fmt(monthCount)}<span class="unit">건</span>`;
  $rate.innerHTML = `${rate}<span class="unit">%</span>`;
  $incomplete.innerHTML = `${fmt(incompleteCount)}<span class="unit">건</span>`;

  requestAnimationFrame(() => {
    $bar.style.width = `${rate}%`;
  });
}

// 한 패널의 실패가 다른 패널을 막지 않도록 격리한다.
// IIFE였을 때는 자기 자신만 죽었지만, 모듈 최상위 2회 호출로 바뀌면서
// 앞 호출이 던지면 뒤 패널이 통째로 렌더되지 않는 결합이 생겼다.
function safeRenderStats(opts) {
  try {
    renderStats(opts);
  } catch (e) {
    console.error(`[main-stats] ${opts.storageKey} 통계 렌더 실패:`, e);
  }
}

// 토양 — 기존 DOM id 유지 (E2E/외부 참조 호환)
safeRenderStats({
  storageKey: 'soilSampleLogs',
  countIncompleteMainParcelOnly: true,
  ids: {
    year: 'statsYear',
    rows: 'statsRows',
    empty: 'statsEmpty',
    total: 'statsTotal',
    month: 'statsMonth',
    rate: 'statsCompleteRate',
    bar: 'statsProgressBar',
    incomplete: 'statsIncomplete'
  }
});

// 가축분뇨 퇴비 — 본필지/하위필지 개념이 없으므로 미완료 전건 집계
safeRenderStats({
  storageKey: 'compostSampleLogs',
  countIncompleteMainParcelOnly: false,
  ids: {
    year: 'compostStatsYear',
    rows: 'compostStatsRows',
    empty: 'compostStatsEmpty',
    total: 'compostStatsTotal',
    month: 'compostStatsMonth',
    rate: 'compostStatsCompleteRate',
    bar: 'compostStatsProgressBar',
    incomplete: 'compostStatsIncomplete'
  }
});
