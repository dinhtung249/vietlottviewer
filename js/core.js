// ========== core.js ==========
// Phần lõi dùng chung: helper, parse JSONL, badge, màu, sắp cột, và điều khiển nav/tab.

window.APP_CONFIG = window.APP_CONFIG || {};
const CFG = window.APP_CONFIG;

// ---------- Helpers chung ----------
function padN(n, width) {
  n = String(n);
  return n.padStart(width, "0");
}

function colorFor(numStr) {
  const n = parseInt(numStr, 10);
  // nhóm theo trăm: 000–099, 100–199, ... 900–999
  const idx = Number.isFinite(n) ? Math.max(0, Math.min(9, Math.floor(n / 100))) : 0;
  const pal = CFG.palette || ["#2563eb","#16a34a","#eab308","#ef4444","#a855f7","#06b6d4","#f97316","#22c55e","#ec4899","#94a3b8"];
  return pal[idx] || pal[0];
}

function makeBadge(numStr, width) {
  const el = document.createElement("span");
  el.className = "badge";
  el.textContent = padN(numStr, width);
  const c = colorFor(numStr);
  el.style.background = c + "22";
  el.style.borderColor = c + "66";
  el.style.color = "#fff";
  return el;
}

function parseJSONL(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      rows.push({
        date:   o.date ?? o.Date ?? "",
        id:     o.id ?? o.ID ?? o.Id ?? "",
        result: o.result ?? o.Result ?? {},
      });
    } catch (e) {
      console.warn("Bỏ dòng lỗi:", i + 1, e);
    }
  }
  return rows;
}

function inferPrizeKeys(rows, preferredOrder = []) {
  const s = new Set();
  rows.forEach(r => {
    if (r.result && typeof r.result === "object") {
      Object.keys(r.result).forEach(k => s.add(k));
    }
  });
  const unique = Array.from(s);
  const out = [];
  preferredOrder.forEach(k => { if (unique.includes(k)) out.push(k); });
  unique.forEach(k => { if (!out.includes(k)) out.push(k); });
  return out;
}

// ---------- Điều khiển Nav chính (game) ----------
document.addEventListener("DOMContentLoaded", () => {
  // Click các item của navbar chính
  document.querySelectorAll(".main-nav .nav-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      // Active nav item
      document.querySelectorAll(".main-nav .nav-item").forEach(x => x.classList.remove("active"));
      item.classList.add("active");
      // Hiển thị page tương ứng
      const game = item.dataset.game;
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      const pageEl = document.getElementById(game);
      if (pageEl) pageEl.classList.add("active");
    });
  });

  // Click các tab con (sub-nav) trong mỗi page
  document.querySelectorAll(".sub-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.closest(".page");
      if (!page) return;
      // Active sub-btn trong page đó
      page.querySelectorAll(".sub-btn").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      // Hiển thị sub-tab tương ứng
      const tabId = btn.dataset.tab;
      page.querySelectorAll(".sub-tab").forEach(x => x.classList.remove("active"));
      const sub = page.querySelector("#" + tabId);
      if (sub) sub.classList.add("active");
    });
  });
});
