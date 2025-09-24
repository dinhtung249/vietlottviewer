// ========== stats.js (FULL với khoảng kỳ + Top số + Top cặp) ==========

const fromIdInput   = document.getElementById("fromIdInput");
const toIdInput     = document.getElementById("toIdInput");
const btnRunStats   = document.getElementById("btnRunStats");
const tbTopSingles  = document.getElementById("tbTopSingles");
const tbTopPairs    = document.getElementById("tbTopPairs");
const tbCycles      = document.getElementById("tbCycles");

function pickData() {
  // viewer.js đã export window.getMax3DProData()
  if (typeof window.getMax3DProData === "function") return window.getMax3DProData();
  return null;
}

function ensureRangeDefaults() {
  const data = pickData();
  if (!data) return;
  const { RAW } = data;
  if (!RAW.length) return;
  // Lấy min/max theo id số
  let minId = Infinity, maxId = -Infinity;
  RAW.forEach(r => {
    const v = parseInt(r.id || "0", 10);
    if (!Number.isFinite(v)) return;
    if (v < minId) minId = v;
    if (v > maxId) maxId = v;
  });
  if (!Number.isFinite(minId) || !Number.isFinite(maxId)) return;
  if (!fromIdInput.value) fromIdInput.value = String(minId);
  if (!toIdInput.value)   toIdInput.value   = String(maxId);
  fromIdInput.min = 1;
  toIdInput.min   = 1;
}

function filterRowsByRange(rows, fromId, toId) {
  // đảm bảo from <= to
  let a = parseInt(fromId, 10), b = parseInt(toId, 10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  if (a > b) [a, b] = [b, a];
  return rows.filter(r => {
    const v = parseInt(r.id || "0", 10);
    return Number.isFinite(v) && v >= a && v <= b;
  });
}

function numbersInRow(row, prizeKeys, width) {
  const out = [];
  prizeKeys.forEach(k => {
    (row.result?.[k] || []).forEach(n => out.push(padN(String(n), width)));
  });
  return out;
}

function computeTopSingles(rows, prizeKeys, width) {
  const map = new Map();
  rows.forEach(r => {
    const nums = numbersInRow(r, prizeKeys, width);
    nums.forEach(n => map.set(n, (map.get(n) || 0) + 1));
  });
  return Array.from(map, ([n, c]) => ({ n, c }))
    .sort((a, b) => b.c - a.c || a.n.localeCompare(b.n));
}

function computeTopPairs(rows, prizeKeys, width) {
  const map = new Map(); // key "AAA|BBB"
  rows.forEach(r => {
    const nums = numbersInRow(r, prizeKeys, width);
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const a = nums[i], b = nums[j];
        const key = a <= b ? `${a}|${b}` : `${b}|${a}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
  });
  return Array.from(map, ([key, c]) => {
    const [a, b] = key.split("|");
    return { a, b, c };
  }).sort((x, y) => y.c - x.c || (x.a + x.b).localeCompare(y.a + y.b));
}

function computeCycles(rows, prizeKeys, width) {
  if (!rows.length) return [];
  // Tính theo thời gian tăng dần
  const sorted = rows.slice().sort((a, b) => {
    if ((a.date || "") !== (b.date || "")) return (a.date || "") < (b.date || "") ? -1 : 1;
    return (parseInt(a.id || "0", 10) - parseInt(b.id || "0", 10));
  });

  const last = new Map(), gapSum = new Map(), gapMax = new Map(), times = new Map();

  for (let idx = 0; idx < sorted.length; idx++) {
    const nums = Array.from(new Set(numbersInRow(sorted[idx], prizeKeys, width))); // unique mỗi kỳ
    nums.forEach(n => {
      if (last.has(n)) {
        const gap = idx - last.get(n);
        gapSum.set(n, (gapSum.get(n) || 0) + gap);
        gapMax.set(n, Math.max(gapMax.get(n) || 0, gap));
      }
      last.set(n, idx);
      times.set(n, (times.get(n) || 0) + 1);
    });
  }

  const total = sorted.length;
  const result = Array.from(times.keys()).map(n => {
    const t = times.get(n) || 0;
    const avg = t > 1 ? (gapSum.get(n) || 0) / (t - 1) : null;
    const cur = last.has(n) ? (total - 1 - last.get(n)) : total - 1;
    return { n, times: t, avgGap: avg == null ? "—" : avg.toFixed(2), maxGap: gapMax.get(n) || 0, curGap: cur };
  });

  result.sort((a, b) => b.times - a.times || a.n.localeCompare(b.n));
  return result;
}

function renderTopSingles(arr, top = 100) {
  tbTopSingles.innerHTML = "";
  arr.slice(0, top).forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${it.n}</td><td>${it.c}</td>`;
    tbTopSingles.appendChild(tr);
  });
}
function renderTopPairs(arr, top = 100) {
  tbTopPairs.innerHTML = "";
  arr.slice(0, top).forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${it.a} — ${it.b}</td><td>${it.c}</td>`;
    tbTopPairs.appendChild(tr);
  });
}
function renderCycles(arr) {
  tbCycles.innerHTML = "";
  arr.forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${it.n}</td><td>${it.times}</td><td>${it.avgGap}</td><td>${it.maxGap}</td><td>${it.curGap}</td>`;
    tbCycles.appendChild(tr);
  });
}

function runAllStats() {
  const data = pickData();
  if (!data) {
    alert("Dữ liệu chưa sẵn sàng. Vào tab 'Kết quả' để trang nạp dữ liệu trước.");
    return;
  }
  const { RAW, PRIZE_KEYS, width } = data;
  ensureRangeDefaults();

  const fromV = fromIdInput.value || "1";
  const toV   = toIdInput.value || "999999";
  const rows  = filterRowsByRange(RAW, fromV, toV);

  const topSingles = computeTopSingles(rows, PRIZE_KEYS, width);
  const topPairs   = computeTopPairs(rows, PRIZE_KEYS, width);
  const cycles     = computeCycles(rows, PRIZE_KEYS, width);

  renderTopSingles(topSingles, 100);
  renderTopPairs(topPairs, 100);
  renderCycles(cycles);
}

// nút tính
if (btnRunStats) btnRunStats.addEventListener("click", runAllStats);

// đặt mặc định khi viewer đã sẵn sàng
document.addEventListener("max3dpro:ready", ensureRangeDefaults);
