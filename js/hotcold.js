// ========== hotcold.js ==========
// Tab "Nóng/Lạnh & Xu hướng" cho Max 3D Pro
// Dùng dữ liệu export từ viewer.js: window.getMax3DProData()

const hcRecentN  = document.getElementById("hcRecentN");
const hcTopN     = document.getElementById("hcTopN");
const btnHC      = document.getElementById("btnRunHotCold");
const tbHot      = document.getElementById("tbHot");
const tbCold     = document.getElementById("tbCold");
const tbTrend    = document.getElementById("tbTrend");

function pickData() {
  if (typeof window.getMax3DProData === "function") return window.getMax3DProData();
  return null;
}

function numbersInRow(row, prizeKeys, width) {
  const out = [];
  prizeKeys.forEach(k => (row.result?.[k] || []).forEach(n => out.push(padN(String(n), width))));
  return out;
}

// --- HOT: Đếm tần suất trên cửa sổ gần đây N kỳ ---
function computeHot(rowsDesc, prizeKeys, width, recentN) {
  const rows = rowsDesc.slice(0, Math.max(0, recentN)); // rowsDesc đã là giảm dần (mới->cũ)
  const map = new Map();
  rows.forEach(r => {
    numbersInRow(r, prizeKeys, width).forEach(n => map.set(n, (map.get(n) || 0) + 1));
  });
  return Array.from(map, ([n, c]) => ({ n, c }))
    .sort((a, b) => b.c - a.c || a.n.localeCompare(b.n));
}

// --- COLD: tính khoảng cách hiện tại (current gap) trên toàn dải ---
function computeCurrentGapAll(rowsAsc, prizeKeys, width) {
  const last = new Map(); // n -> last index
  for (let idx = 0; idx < rowsAsc.length; idx++) {
    const setNums = new Set(numbersInRow(rowsAsc[idx], prizeKeys, width));
    setNums.forEach(n => last.set(n, idx));
  }
  const total = rowsAsc.length;
  // nếu chưa từng xuất hiện thì bỏ qua (hoặc bạn có thể cho curGap = total)
  const arr = Array.from(last.keys()).map(n => ({ n, cur: (total - 1) - last.get(n) }));
  arr.sort((a, b) => b.cur - a.cur || a.n.localeCompare(b.n));
  return arr;
}

// --- Tần suất dài hạn (toàn dải) ---
function computeLongrunFreq(rowsAll, prizeKeys, width) {
  const map = new Map();
  let totalNums = 0;
  rowsAll.forEach(r => {
    const nums = numbersInRow(r, prizeKeys, width);
    totalNums += nums.length;
    nums.forEach(n => map.set(n, (map.get(n) || 0) + 1));
  });
  return { counts: map, totalNums };
}

// --- Điểm xu hướng: 0.7*curGap_norm + 0.3*freq_norm ---
function computeTrend(rowsAll, prizeKeys, width) {
  if (!rowsAll.length) return [];

  // curGap: cần thứ tự tăng dần để tính chỉ số lần cuối
  const rowsAsc  = rowsAll.slice().sort((a,b)=>{
    if ((a.date||"") !== (b.date||"")) return (a.date||"") < (b.date||"") ? -1 : 1;
    return (parseInt(a.id||"0",10) - parseInt(b.id||"0",10));
  });
  const curArr   = computeCurrentGapAll(rowsAsc, prizeKeys, width); // [{n, cur}...]

  // long-run frequency
  const { counts, totalNums } = computeLongrunFreq(rowsAll, prizeKeys, width);
  const maxCur = curArr.length ? Math.max(...curArr.map(x=>x.cur)) : 1;
  const maxCnt = counts.size ? Math.max(...counts.values()) : 1;

  const trend = curArr.map(({n, cur}) => {
    const cnt = counts.get(n) || 0;
    const curNorm = maxCur ? (cur / maxCur) : 0;
    const cntNorm = maxCnt ? (cnt / maxCnt) : 0;
    const score = 0.7 * curNorm + 0.3 * cntNorm;
    return { n, score: +score.toFixed(4), detail: `gap:${cur} | freq:${cnt}` };
  });

  trend.sort((a,b)=> b.score - a.score || a.n.localeCompare(b.n));
  return trend;
}

// --- Render helpers ---
function renderHot(arr, topN) {
  tbHot.innerHTML = "";
  arr.slice(0, topN).forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${it.n}</td><td>${it.c}</td>`;
    tbHot.appendChild(tr);
  });
}
function renderCold(curArr, topN) {
  tbCold.innerHTML = "";
  curArr.slice(0, topN).forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${it.n}</td><td>${it.cur}</td>`;
    tbCold.appendChild(tr);
  });
}
function renderTrend(arr, topN) {
  tbTrend.innerHTML = "";
  arr.slice(0, topN).forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${it.n}</td><td>${it.score}</td><td>${it.detail}</td>`;
    tbTrend.appendChild(tr);
  });
}

// --- Run ---
function runHotCold() {
  const data = pickData();
  if (!data) { alert("Dữ liệu chưa sẵn sàng."); return; }
  const { RAW, PRIZE_KEYS, width } = data;

  const topN = Math.max(5, Math.min(500, parseInt(hcTopN.value || "50", 10)));
  const recentN = Math.max(5, parseInt(hcRecentN.value || "50", 10));

  // RAW hiện hiển thị mới->cũ (do viewer đã sort). Ta sẽ:
  const rowsDesc = RAW; // mới -> cũ
  const rowsAsc  = RAW.slice().reverse(); // cũ -> mới (dùng cho cold)

  const hot  = computeHot(rowsDesc, PRIZE_KEYS, width, recentN);
  const cold = computeCurrentGapAll(rowsAsc, PRIZE_KEYS, width);
  const trend = computeTrend(RAW, PRIZE_KEYS, width);

  renderHot(hot, topN);
  renderCold(cold, topN);
  renderTrend(trend, topN);
}

// Nút chạy
if (btnHC) btnHC.addEventListener("click", runHotCold);

// Tự điền mặc định khi viewer đã sẵn sàng
document.addEventListener("max3dpro:ready", () => {
  if (!hcRecentN.value) hcRecentN.value = "50";
  if (!hcTopN.value) hcTopN.value = "50";
});
