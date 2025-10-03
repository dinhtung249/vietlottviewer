// ========== viewer.js (FULL) ==========
// Hiển thị tab "Kết quả" cho Max 3D Pro: tự nạp data/max3dpro.jsonl và render bảng.
// Phụ thuộc: APP_CONFIG, padN, makeBadge, parseJSONL, inferPrizeKeys (từ core.js)

const CURRENT_GAME = "max3dpro"; // Mặc định đang làm Max 3D Pro

// Các phần tử trong tab "Kết quả" của Max 3D Pro
const legend     = document.getElementById("legend");
const theadRow   = document.getElementById("thead-row");
const tbody      = document.getElementById("tbody");
const statsCount = document.getElementById("statsCount");
//tìm kiếm kết quả
const searchInput = document.getElementById("searchInput");
const btnSearch   = document.getElementById("btnSearch");
const btnReset    = document.getElementById("btnReset");
//hiển thị khoảng cách
const btnToggleAnnot = document.getElementById("btnToggleAnnot");

let SHOW_ANNOT = false;     // trạng thái bật/tắt hiển thị khoảng cách
let PREV_GAPS = new Map();  // Map<rowKey, Map<num, gap>>


// Dữ liệu
let RAW = [];        // toàn bộ các kỳ
let SHOWN = [];      // tập đang hiển thị (hiện chưa có lọc -> = RAW)
let PRIZE_KEYS = []; // danh sách cột giải

// ----- Legend: nhóm trăm có nền/viền màu theo palette -----
// Chuyển hex -> rgba để set alpha an toàn
function hexToRgba(hex, alpha) {
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2), 16);
  const g = parseInt(h.substring(2,4), 16);
  const b = parseInt(h.substring(4,6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderLegend() {
  if (!legend) return;
  legend.innerHTML = "";

  const pal = (window.APP_CONFIG && window.APP_CONFIG.palette) ||
    ["#2563eb","#16a34a","#eab308","#ef4444","#a855f7",
     "#06b6d4","#f97316","#22c55e","#ec4899","#94a3b8"];

  // đảm bảo có class .legend để áp dụng layout grid từ CSS
  legend.classList.add("legend");

  pal.forEach((c, i) => {
    const from = i * 100, to = i * 100 + 99;

    const item = document.createElement("div");
    item.className = "item";
    // nền/viền theo palette (dùng rgba an toàn)
    item.style.backgroundColor = hexToRgba(c, 0.18);
    item.style.borderColor     = hexToRgba(c, 0.60);

    const sw = document.createElement("div");
    sw.className = "sw";
    sw.style.backgroundColor = c;

    const tx = document.createElement("div");
    tx.textContent = `${String(from).padStart(3,"0")}–${String(to).padStart(3,"0")}`;

    item.appendChild(sw);
    item.appendChild(tx);
    legend.appendChild(item);
  });
}


// ----- Header: thêm cột giải động -----
function renderHeader() {
  if (!theadRow) return;
  while (theadRow.children.length > 2) theadRow.removeChild(theadRow.lastChild); // giữ Ngày + ID
  PRIZE_KEYS.forEach(k => {
    const th = document.createElement("th");
    th.textContent = k;
    theadRow.appendChild(th);
  });
}

// ----- Body: render từng kỳ -----
function renderBody() {
  if (!tbody) return;
  tbody.innerHTML = "";

  const width = (window.APP_CONFIG && window.APP_CONFIG.games?.[CURRENT_GAME]?.numberWidth) || 3;

  SHOWN.forEach(r => {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td"); tdDate.textContent = r.date || "";
    const tdId   = document.createElement("td"); tdId.textContent   = r.id || "";
    tr.appendChild(tdDate); tr.appendChild(tdId);

    const rowKey = rowKeyOf(r);
    const gapsMap = PREV_GAPS.get(rowKey) || new Map();

    PRIZE_KEYS.forEach(k => {
      const td = document.createElement("td");
      const arr = (r.result && r.result[k]) ? r.result[k] : [];
      if (!arr || !Array.isArray(arr) || arr.length === 0) {
        td.textContent = "—";
      } else {
        if (SHOW_ANNOT) {
          // hiển thị số + dòng gap
          const wrap = document.createElement("div");
          wrap.className = "badges-annot";
          arr.map(x=>String(x)).forEach(n=>{
            const norm = padN(n, width);
            const gap  = gapsMap.has(norm) ? gapsMap.get(norm) : null;
            wrap.appendChild(makeAnnotatedBadge(norm, width, gap));
          });
          td.appendChild(wrap);
        } else {
          // hiển thị như cũ (badge thường)
          const wrap = document.createElement("div");
          wrap.className = "badges";
          arr.map(x=>String(x)).forEach(n=> wrap.appendChild(makeBadge(n, width)));
          td.appendChild(wrap);
        }
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  if (statsCount) statsCount.textContent = `Hiển thị ${SHOWN.length} / ${RAW.length} kỳ.`;
}


// Chuẩn hóa đầu vào: "740, 262" -> ["740","262"] theo width game
function parseSearchNumbers(raw, width) {
  if (!raw) return [];
  // tách theo dấu phẩy hoặc khoảng trắng
  const parts = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  // chỉ lấy chuỗi gồm 1–3 chữ số, pad theo width
  const valid = [];
  const seen = new Set();
  parts.forEach(p => {
    if (/^\d{1,3}$/.test(p)) {
      const norm = padN(p, width);
      if (!seen.has(norm)) { seen.add(norm); valid.push(norm); }
    }
  });
  return valid;
}

// Kiểm tra 1 kỳ có chứa TẤT CẢ các số cần tìm trong bất kỳ cột giải nào (AND)
function rowContainsAllTargets(row, prizeKeys, targets, width) {
  if (!targets.length) return true;
  // gom toàn bộ số trong 1 kỳ
  const all = [];
  prizeKeys.forEach(k => (row.result?.[k] || []).forEach(n => all.push(padN(String(n), width))));
  // every target must be found
  return targets.every(t => all.includes(t));
}

function rowKeyOf(r){ return `${r.date}#${r.id}`; }

// tạo badge có chú thích gap (kỳ từ lần trước)
function makeAnnotatedBadge(numStr, width, gap){
  const color = colorFor(numStr);
  const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);

  const wrap = document.createElement("div");
  wrap.className = "badge-annot";
  wrap.style.background = `rgba(${r},${g},${b},0.14)`;
  wrap.style.borderColor = `rgba(${r},${g},${b},0.5)`;

  const num = document.createElement("div");
  num.className = "num";
  num.textContent = padN(numStr, width);
  num.style.color = "#fff";

  const sub = document.createElement("div");
  sub.className = "gap";
  sub.textContent = (gap == null ? "—" : `${gap} kỳ`);

  wrap.appendChild(num);
  wrap.appendChild(sub);
  return wrap;
}

// tính khoảng cách lần xuất hiện trước đó cho mỗi số ở từng kỳ (tính trên toàn bộ RAW)
function computePrevGapsForAllRows(rows, prizeKeys, width){
  const asc = rows.slice().sort((a,b)=>{
    if ((a.date||"") !== (b.date||"")) return (a.date||"") < (b.date||"") ? -1 : 1;
    return (parseInt(a.id||"0",10) - parseInt(b.id||"0",10));
  });
  const lastSeen = new Map();              // num -> last index
  const gapsByRow = new Map();             // rowKey -> Map<num, gap>

  for (let idx=0; idx<asc.length; idx++){
    const r = asc[idx];
    const key = rowKeyOf(r);
    const m = new Map();

    const widthN = (window.APP_CONFIG && window.APP_CONFIG.games?.[CURRENT_GAME]?.numberWidth) || 3;
    const nums = new Set();
    prizeKeys.forEach(k => (r.result?.[k]||[]).forEach(n => nums.add(padN(String(n), widthN))));

    nums.forEach(n=>{
      if (lastSeen.has(n)) m.set(n, idx - lastSeen.get(n));
      else m.set(n, null);
      lastSeen.set(n, idx);
    });

    gapsByRow.set(key, m);
  }
  return gapsByRow;
}


// ----- Nạp dữ liệu từ file -----
async function loadFromPath(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Không tải được dữ liệu (${res.status})`);
  const text = await res.text();

  RAW = parseJSONL(text);

  // hiển thị kỳ mới nhất trước
  RAW.sort((a, b) => {
    if ((a.date || "") !== (b.date || "")) return a.date < b.date ? 1 : -1;
    return (parseInt(b.id || "0", 10) - parseInt(a.id || "0", 10));
  });

  const pref = window.APP_CONFIG?.games?.[CURRENT_GAME]?.preferredPrizeOrder || [];
  PRIZE_KEYS = inferPrizeKeys(RAW, pref);
  SHOWN = RAW.slice();

  // sau khi có RAW, PRIZE_KEYS, SHOWN
  const width = window.APP_CONFIG?.games?.[CURRENT_GAME]?.numberWidth || 3;
  PREV_GAPS = computePrevGapsForAllRows(RAW, PRIZE_KEYS, width);

  renderLegend();
  renderHeader();
  renderBody();

  // "export" dữ liệu để stats.js, hotcold.js dùng
  window.getMax3DProData = () => ({ RAW, SHOWN, PRIZE_KEYS, width, PREV_GAPS });


  // phát sự kiện cho stats.js biết dữ liệu đã sẵn sàng
  document.dispatchEvent(new CustomEvent("max3dpro:ready"));
}

//chay tìm kiếm ở kết quả
function runSearch() {
  const width = (window.APP_CONFIG && window.APP_CONFIG.games?.[CURRENT_GAME]?.numberWidth) || 3;
  const targets = parseSearchNumbers((searchInput?.value || ""), width);

  if (!targets.length) {
    // Không nhập gì -> hiển thị tất cả
    SHOWN = RAW.slice();
  } else {
    SHOWN = RAW.filter(r => rowContainsAllTargets(r, PRIZE_KEYS, targets, width));
  }
  renderBody();
}

// Gắn sự kiện cho nút và phím Enter
if (btnSearch) btnSearch.addEventListener("click", runSearch);
if (btnReset)  btnReset.addEventListener("click", () => { if (searchInput) searchInput.value = ""; SHOWN = RAW.slice(); renderBody(); });
if (searchInput) {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); runSearch(); }
  });
}
//bật nút tắt hiển thị khoảng cách kì
if (btnToggleAnnot) {
  btnToggleAnnot.addEventListener("click", ()=>{
    SHOW_ANNOT = !SHOW_ANNOT;
    btnToggleAnnot.textContent = SHOW_ANNOT ? "Ẩn khoảng cách" : "Hiện khoảng cách";
    renderBody(); // vẽ lại theo trạng thái mới
  });
}




// ----- Khởi động: tự load data/max3dpro.jsonl -----
document.addEventListener("DOMContentLoaded", () => {
  const path = window.APP_CONFIG?.games?.[CURRENT_GAME]?.dataPath || "data/max3dpro.jsonl";
  loadFromPath(path).catch(err => {
    console.warn(err);
    if (statsCount) {
      statsCount.textContent = "Chưa tải được dữ liệu mặc định. Kiểm tra đường dẫn data/max3dpro.jsonl hoặc chạy qua HTTP server.";
    }
  });
});
