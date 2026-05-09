// 메인 페이지 토양 시료 통계 패널
// localStorage(soilSampleLogs_{year}) 기반 즉시 표시
// CSP 정책상 인라인 <script>가 차단되므로 ES 모듈로 분리

(function renderSoilStats() {
  const year = new Date().getFullYear();
  const month = new Date().getMonth(); // 0-11
  const STORAGE_KEY = `soilSampleLogs_${year}`;

  const $year = document.getElementById('statsYear');
  const $rows = document.getElementById('statsRows');
  const $empty = document.getElementById('statsEmpty');
  const $total = document.getElementById('statsTotal');
  const $month = document.getElementById('statsMonth');
  const $rate = document.getElementById('statsCompleteRate');
  const $bar = document.getElementById('statsProgressBar');
  const $incomplete = document.getElementById('statsIncomplete');

  if (!$year || !$rows || !$empty) return;

  $year.textContent = `${year}년`;

  let logs = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  // 미완료는 본필지만 카운트 (하위필지 제외)
  const incompleteCount = logs.filter(
    (log) => log && log.isComplete !== true && isMainParcel(log)
  ).length;

  const fmt = (n) => n.toLocaleString('ko-KR');
  $total.innerHTML = `${fmt(total)}<span class="unit">건</span>`;
  $month.innerHTML = `${fmt(monthCount)}<span class="unit">건</span>`;
  $rate.innerHTML = `${rate}<span class="unit">%</span>`;
  $incomplete.innerHTML = `${fmt(incompleteCount)}<span class="unit">건</span>`;
  requestAnimationFrame(() => {
    $bar.style.width = `${rate}%`;
  });
})();
