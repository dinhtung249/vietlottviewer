// js/lotto535.js  — Safe (không đụng global), bảng ngang + infinite scroll + tô màu bộ chục + bonus đỏ
(function(){
  const CFG = {
    dataPath: "data/lotto535.jsonl",
    pageSize: 30,
    maxInitial: 60
  };

  // ---- helpers cục bộ (không đụng global) ----
  async function loadText(url){
    const r = await fetch(url, { cache:"no-store" });
    if(!r.ok) throw new Error(`Không tải được ${url} (${r.status})`);
    return await r.text();
  }
  async function loadJSON(url){
    const r = await fetch(url, { cache:"no-store" });
    if(!r.ok) throw new Error(`Không tải được ${url} (${r.status})`);
    return await r.json();
  }
  function parseJSONLLocal(t){
    const out = [];
    for (const line of t.split("\n")) {
      const s = line.trim();
      if (!s) continue;
      out.push(JSON.parse(s));
    }
    return out;
  }
  function sortByNewestId(rows){
    return rows.sort((a,b)=> (parseInt(b.id,10) - parseInt(a.id,10)));
  }

  function ensureStylesOnce(){
    if (document.getElementById("lotto535-styles")) return;
    const css = `
    .lotto535 { margin-top:12px; }
    .lotto535 .tbl { width:100%; border-collapse:separate; border-spacing:0 8px; table-layout:fixed; }
    .lotto535 thead th { position:sticky; top:0; z-index:1; background:#0f172a; }
    .lotto535 th, .lotto535 td { padding:10px 12px; font-size:14px; white-space:nowrap; vertical-align:middle; }
    .lotto535 th { color:#cbd5e1; font-weight:700; }

    .lotto535 .r-bg { background:#0b1220; border:1px solid #1f2937; border-radius:12px; }
    .lotto535 tr.r-bg > td:first-child { border-top-left-radius:12px; border-bottom-left-radius:12px; }
    .lotto535 tr.r-bg > td:last-child  { border-top-right-radius:12px; border-bottom-right-radius:12px; }

    .lotto535 .cell-date { width:120px; color:#e5e7eb; font-weight:600; }
    .lotto535 .cell-id   { width:90px;  color:#cbd5e1; font-weight:700; text-align:right; }
    .lotto535 .cell-balls{ width:auto; }

    .lotto535 .balls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .lotto535 .ball {
      width:32px; height:32px; border-radius:50%;
      display:inline-flex; align-items:center; justify-content:center;
      font-weight:700; font-size:12px; background:#e5e7eb; color:#0b1220;
      box-shadow:0 2px 6px rgba(0,0,0,.18);
    }

    /* màu theo bộ chục */
    .lotto535 .ball.dec-0 { background:#3b82f6; color:#fff; }  /* 0–9 */
    .lotto535 .ball.dec-1 { background:#22c55e; color:#fff; }  /* 10–19 */
    .lotto535 .ball.dec-2 { background:#f59e0b; color:#fff; }  /* 20–29 */
    .lotto535 .ball.dec-3 { background:#8b5cf6; color:#fff; }  /* 30–35 */

    /* bonus luôn đỏ */
    .lotto535 .ball-bonus { background:#ef4444; color:#fff; border:2px solid #fff; }

    .lotto535 .plus { font-weight:700; opacity:.9; }

    /* legend */
    .lotto535-legend {
      display:flex; gap:10px; flex-wrap:wrap;
      margin-bottom:10px; font-size:13px; font-weight:600;
    }
    .lotto535-legend .legend-box { padding:4px 10px; border-radius:8px; color:#fff; }
    .lotto535-legend .dec-0 { background:#3b82f6; }
    .lotto535-legend .dec-1 { background:#22c55e; }
    .lotto535-legend .dec-2 { background:#f59e0b; }
    .lotto535-legend .dec-3 { background:#8b5cf6; }
    .lotto535-legend .bonus { background:#ef4444; }

    .lotto535 .loadmore { margin:10px auto 16px; display:none; }
    .lotto535 .btn { padding:10px 14px; border-radius:10px; border:1px solid #334155; background:#111827; color:#e5e7eb; font-weight:600; cursor:pointer; }
    .lotto535 .btn[disabled]{ opacity:.5; cursor:default; }
    `;
    const style = document.createElement("style");
    style.id = "lotto535-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function renderLegend(container){
    const html = `
      <div class="lotto535-legend">
        <span class="legend-box dec-0">0–9</span>
        <span class="legend-box dec-1">10–19</span>
        <span class="legend-box dec-2">20–29</span>
        <span class="legend-box dec-3">30–35</span>
        <span class="legend-box bonus">Bonus</span>
      </div>`;
    container.insertAdjacentHTML("afterbegin", html);
  }

  function ballClass(n){ if(n<=9) return "dec-0"; if(n<=19) return "dec-1"; if(n<=29) return "dec-2"; return "dec-3"; }
  function ballHtml(n,isBonus=false){
    const t = String(n).padStart(2,"0");
    return isBonus ? `<span class="ball ball-bonus">${t}</span>` : `<span class="ball ${ballClass(n)}">${t}</span>`;
  }

  function renderHeader(thead){
    thead.innerHTML = `
      <tr>
        <th class="cell-date">Ngày</th>
        <th class="cell-id">ID</th>
        <th class="cell-balls">Kết quả</th>
      </tr>`;
  }
  function rowHtml(item){
    const main = item.result.slice(0,5);
    const bonus = item.result[5];
    return `
      <tr class="r-bg">
        <td class="cell-date">${item.date}</td>
        <td class="cell-id">#${item.id}</td>
        <td class="cell-balls">
          <div class="balls">
            ${main.map(n=>ballHtml(n)).join("")}
            <span class="plus">+</span>
            ${ballHtml(bonus,true)}
          </div>
        </td>
      </tr>`;
  }
  function renderSlice(tbody,data,start,count){
    const end = Math.min(start+count, data.length);
    let html = "";
    for(let i=start;i<end;i++) html += rowHtml(data[i]);
    tbody.insertAdjacentHTML("beforeend", html);
    return end;
  }

  async function renderLotto535(opts={}){
    ensureStylesOnce();
    const container = document.getElementById(opts.containerId || "lotto535");
    if(!container) return;

    container.classList.add("lotto535");
    container.innerHTML = `
      <table class="tbl">
        <thead></thead>
        <tbody></tbody>
      </table>
      <div class="loadmore"><button class="btn">Tải thêm</button></div>
      <div id="lotto535-sentinel" style="height:1px;"></div>`;
    renderLegend(container);

    const dataPath = opts.dataPath || CFG.dataPath;
    let raw;
    if (dataPath.endsWith(".jsonl")) raw = parseJSONLLocal(await loadText(dataPath));
    else raw = await loadJSON(dataPath);

    const data = sortByNewestId(raw); // ID to -> bé

    const thead = container.querySelector("thead");
    const tbody = container.querySelector("tbody");
    renderHeader(thead);

    let cursor = 0;
    const pageSize   = opts.pageSize   || CFG.pageSize;
    const maxInitial = Math.max(pageSize, opts.maxInitial || CFG.maxInitial);

    cursor = renderSlice(tbody, data, cursor, maxInitial);

    const btnWrap = container.querySelector(".loadmore");
    const btn     = btnWrap.querySelector(".btn");
    const more = ()=>{
      cursor = renderSlice(tbody, data, cursor, pageSize);
      if (cursor >= data.length){
        btn.disabled = true; btn.textContent = "Hết dữ liệu"; observer?.disconnect();
      }
    };
    btn.addEventListener("click", more);

    let observer = null;
    if ("IntersectionObserver" in window){
      const sentinel = document.getElementById("lotto535-sentinel");
      observer = new IntersectionObserver(es=>{
        for (const e of es) if (e.isIntersecting) more();
      }, { rootMargin:"800px 0px" });
      observer.observe(sentinel);
    } else {
      btnWrap.style.display = "block";
    }
  }

  // Auto-run nếu có #lotto535
  document.addEventListener("DOMContentLoaded", ()=>{
    const el = document.getElementById("lotto535");
    if (el) renderLotto535().catch(err=>{
      el.innerHTML = `<div style="color:#b91c1c;">Lỗi Lotto 5/35: ${err?.message||err}</div>`;
    });
  });
})();
