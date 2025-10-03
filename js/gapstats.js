// ========== gapstats.js ==========
// Tab "Khoảng kỳ": Phổ gap, tóm tắt theo kỳ, và nhóm theo dải số 000–099,...

const gsFromId = document.getElementById("gsFromId");
const gsToId   = document.getElementById("gsToId");
const btnRunGapStats = document.getElementById("btnRunGapStats");

const tbGapDist  = document.getElementById("tbGapDist");
const tbBucket   = document.getElementById("tbBucket");
const tbPerDraw  = document.getElementById("tbPerDraw");

function pickData(){
  if (typeof window.getMax3DProData === "function") return window.getMax3DProData();
  return null;
}

function ensureRangeDefaultsGS(){
  const data = pickData(); if(!data) return;
  const { RAW } = data; if(!RAW || !RAW.length) return;
  let minId = Infinity, maxId = -Infinity;
  RAW.forEach(r=>{
    const v = parseInt(r.id||"0",10);
    if (Number.isFinite(v)) {
      if (v < minId) minId = v;
      if (v > maxId) maxId = v;
    }
  });
  if (Number.isFinite(minId) && !gsFromId.value) gsFromId.value = String(minId);
  if (Number.isFinite(maxId) && !gsToId.value)   gsToId.value   = String(maxId);
  gsFromId.min = 1; gsToId.min = 1;
}

function filterRowsByRange(rows, fromId, toId){
  let a = parseInt(fromId,10), b = parseInt(toId,10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  if (a > b) [a,b] = [b,a];
  return rows.filter(r=>{
    const v = parseInt(r.id||"0",10);
    return Number.isFinite(v) && v>=a && v<=b;
  });
}

// === 1) Phổ khoảng cách kỳ (gap-dist) ===
// Dùng PREV_GAPS đã được viewer.js tính: rowKey -> Map<num, gap>
function computeGapDistribution(rows, prizeKeys, width, PREV_GAPS){
  const gapCount = new Map(); // gap -> freq
  const rowKeys = new Set(rows.map(r => `${r.date}#${r.id}`));

  rowKeys.forEach(key=>{
    const m = PREV_GAPS.get(key);
    if (!m) return;
    m.forEach((gap, num)=>{
      if (gap == null) return; // chưa có lần trước
      gapCount.set(gap, (gapCount.get(gap)||0)+1);
    });
  });

  const arr = Array.from(gapCount, ([gap, c])=>({gap, c}));
  arr.sort((a,b)=> b.c - a.c || a.gap - b.gap);
  return arr;
}

// === 2) Nhóm theo dải số (000–099, 100–199, ...) ===
function computeHundredsBucket(rows, prizeKeys, width){
  const buckets = new Map(); // label -> count
  function labelFor(numStr){
    const n = parseInt(numStr,10);
    const g = Math.max(0, Math.min(9, Math.floor(n/100)));
    const from = String(g*100).padStart(3,"0");
    const to   = String(g*100+99).padStart(3,"0");
    return `${from}–${to}`;
  }
  rows.forEach(r=>{
    prizeKeys.forEach(k=>{
      (r.result?.[k]||[]).forEach(n=>{
        const lab = labelFor(String(n).padStart(width,"0"));
        buckets.set(lab, (buckets.get(lab)||0)+1);
      });
    });
  });
  const arr = Array.from(buckets, ([label,c])=>({label,c}));
  // sắp theo thứ tự 000–099, 100–199,... (dựa vào phần đầu label)
  arr.sort((a,b)=> parseInt(a.label.slice(0,3),10) - parseInt(b.label.slice(0,3),10));
  return arr;
}

// === 3) Tóm tắt theo kỳ (ID): đếm số có gap, min/avg/max ===
function computePerDrawSummary(rows, prizeKeys, width, PREV_GAPS){
  // giữ nguyên thứ tự hiển thị hiện tại (mới -> cũ), hoặc bạn có thể sắp lại theo id/ date
  return rows.map(r=>{
    const key = `${r.date}#${r.id}`;
    const m = PREV_GAPS.get(key) || new Map();
    const gaps = [];
    // lấy unique số trong kỳ (tránh trùng)
    const setNums = new Set();
    prizeKeys.forEach(k=>(r.result?.[k]||[]).forEach(n=>setNums.add(String(n).padStart(width,"0"))));
    setNums.forEach(n=>{
      const g = m.get(n);
      if (g != null) gaps.push(g);
    });
    const count = gaps.length;
    const min = count ? Math.min(...gaps) : "—";
    const max = count ? Math.max(...gaps) : "—";
    const avg = count ? (gaps.reduce((s,x)=>s+x,0)/count).toFixed(2) : "—";
    return { id:r.id, date:r.date, count, min, avg, max };
  });
}

function renderGapDist(arr){
  tbGapDist.innerHTML = "";
  arr.forEach((it, i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${it.gap}</td><td>${it.c}</td>`;
    tbGapDist.appendChild(tr);
  });
}
function renderBucket(arr){
  tbBucket.innerHTML = "";
  arr.forEach((it, i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${it.label}</td><td>${it.c}</td>`;
    tbBucket.appendChild(tr);
  });
}
function renderPerDrawSummary(arr){
  tbPerDraw.innerHTML = "";
  arr.forEach((it)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${it.id}</td><td>${it.date||""}</td><td>${it.count}</td><td>${it.min}</td><td>${it.avg}</td><td>${it.max}</td>`;
    tbPerDraw.appendChild(tr);
  });
}

function runGapStats(){
  const data = pickData();
  if (!data) { alert("Dữ liệu chưa sẵn sàng."); return; }
  const { RAW, PRIZE_KEYS, width, PREV_GAPS } = data;

  // phạm vi kỳ
  const fromV = gsFromId.value || "1";
  const toV   = gsToId.value   || "999999";
  const rows  = filterRowsByRange(RAW, fromV, toV);

  // tính
  const gapDist = computeGapDistribution(rows, PRIZE_KEYS, width, PREV_GAPS);
  const bucket  = computeHundredsBucket(rows, PRIZE_KEYS, width);
  const perDraw = computePerDrawSummary(rows, PRIZE_KEYS, width, PREV_GAPS);

  // render
  renderGapDist(gapDist);
  renderBucket(bucket);
  renderPerDrawSummary(perDraw);
}

// init mặc định khoảng khi dữ liệu sẵn
document.addEventListener("max3dpro:ready", ensureRangeDefaultsGS);
if (btnRunGapStats) btnRunGapStats.addEventListener("click", runGapStats);
