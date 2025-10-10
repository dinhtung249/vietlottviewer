// js/lotto535.js — Lotto 5/35
// Safe IIFE (no globals), 2 subtabs: Results & Combos
// - Results: compact table, color-by-decade, bonus red, toggle gap view (vs chips), infinite scroll
// - Combos: list all 324,632 combos in lexicographic order, 100 per page with Prev/Next/Jump, highlight winning combos,
//           detail shows rank info + neighbor rank gaps + global gaps stats (on combo order), jump does exact unrank.
// Author: ChatGPT (vietlottviewer helper)
(function(){
  const CFG = {
    dataPath: "data/lotto535.jsonl",
    // Results tab paging
    pageSizeResults: 30,
    maxInitialResults: 60,
    // Combos tab paging
    combosPageSize: 100,
  };

  // ------------- helpers (local) -------------
  async function loadText(url){ const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(`Không tải được ${url} (${r.status})`); return await r.text(); }
  async function loadJSON(url){ const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(`Không tải được ${url} (${r.status})`); return await r.json(); }
  function parseJSONLLocal(t){ const out=[]; for(const line of t.split("\n")){ const s=line.trim(); if(!s) continue; out.push(JSON.parse(s)); } return out; }
  const ballClass = n => (n<=9) ? "dec-0" : (n<=19) ? "dec-1" : (n<=29) ? "dec-2" : "dec-3";
  function sortByNewestId(rows){ return rows.sort((a,b)=> (parseInt(b.id,10) - parseInt(a.id,10))); }

  // ------------- occurrences & gaps (Results) -------------
  function buildOccurrenceIndex(rows){
    const occ = new Map();
    for (const r of rows){
      const id = parseInt(r.id, 10);
      for (const n of (r.result||[])){
        if (typeof n !== "number") continue;
        if (!occ.has(n)) occ.set(n, []);
        occ.get(n).push(id);
      }
    }
    for (const list of occ.values()) list.sort((a,b)=>b-a);
    return occ;
  }
  function prevIdBinary(list, idNow){
    let lo=0, hi=list.length-1, ans=null;
    while (lo<=hi){
      const mid=(lo+hi)>>1;
      const val=list[mid];
      if (val >= idNow){ lo = mid+1; } else { ans = val; hi = mid-1; }
    }
    return ans;
  }

  // ------------- win map & combo utilities (Combos) -------------
  // winMap: key "a-b-c-d-e" -> array of winning IDs (ascending) for main 5 nums
  function buildWinMap(rows){
    const m = new Map();
    for (const r of rows){
      const id = parseInt(r.id, 10);
      const main = r.result.slice(0,5).slice().sort((a,b)=>a-b);
      const key = main.join("-");
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(id);
    }
    for (const ids of m.values()) ids.sort((a,b)=>a-b);
    return m;
  }
  // combinations nCk for small n,k
  function nCk(n,k){
    if (k<0 || k>n) return 0;
    if (k===0 || k===n) return 1;
    k = Math.min(k, n-k);
    let num=1, den=1;
    for (let i=1;i<=k;i++){ num *= (n - k + i); den *= i; }
    return Math.round(num/den);
  }
  // unrank the r-th (1-based) k-combination of {1..n} in lexicographic order
  function unrankComb(n, k, rank){
    const res = [];
    let x = 1;
    for (let i = k; i >= 1; i--){
      while (x <= n){
        const count = nCk(n - x, i - 1);
        if (rank > count){ rank -= count; x++; } else { res.push(x); x++; break; }
      }
    }
    return res;
  }
  function comboKey(arr){ return arr.join("-"); }
  function numsSpan(arr){ return arr.map(n=>`<span class="n">${String(n).padStart(2,'0')}</span>`).join(""); }

  // Build mapping key->rank and list of ranks that have won
  function buildKeyToRank(){
    const m = new Map();
    const TOTAL = nCk(35,5);
    for (let r=1; r<=TOTAL; r++){
      const arr = unrankComb(35,5,r);
      m.set(comboKey(arr), r);
    }
    return m;
  }
  function buildWinRanks(winMap, keyToRank){
    const ranks = [];
    for (const key of winMap.keys()){
      const r = keyToRank.get(key);
      if (r != null) ranks.push(r);
    }
    ranks.sort((a,b)=>a-b);
    return ranks;
  }
  function gapStatsFromWinRanks(winRanks){
    const gaps = [];
    for (let i=1;i<winRanks.length;i++) gaps.push(winRanks[i]-winRanks[i-1]);
    const avg = gaps.length ? (gaps.reduce((a,b)=>a+b,0) / gaps.length) : 0;
    return { gaps, avg };
  }

  // ------------- CSS -------------
  function ensureStylesOnce(){
    if (document.getElementById("lotto535-styles")) return;
    const css = `
    .lotto535 { margin-top:12px; }
    .lotto535 .legend { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px; font-size:13px; font-weight:600; }
    .lotto535 .legend .legend-box { padding:4px 10px; border-radius:8px; color:#fff; }
    .dec-0 { background:#3b82f6; } .dec-1 { background:#22c55e; } .dec-2 { background:#f59e0b; } .dec-3 { background:#8b5cf6; } .bonus { background:#ef4444; }
    #toggle-gaps { margin-left:auto; padding:6px 10px; border-radius:8px; border:1px solid #334155; background:#0d1324; color:#e5e7eb; font-weight:700; cursor:pointer; font-size:12px; }

    .lotto535 .subtabs { display:flex; gap:8px; margin-bottom:10px; }
    .lotto535 .subtabs .tbtn { padding:8px 12px; border-radius:10px; border:1px solid #334155; background:#0d1324; color:#e5e7eb; font-weight:700; cursor:pointer; font-size:13px; }
    .lotto535 .subtabs .tbtn.active { background:#1f2937; }

    /* Results */
    .lotto535 .tbl { width:100%; border-collapse:separate; border-spacing:0 8px; table-layout:fixed; }
    .lotto535 thead th { position:sticky; top:0; z-index:1; background:#0f172a; }
    .lotto535 th, .lotto535 td { padding:10px 12px; font-size:14px; white-space:nowrap; vertical-align:middle; }
    .lotto535 th { color:#cbd5e1; font-weight:700; }
    .lotto535 .r-bg { background:#0b1220; border:1px solid #1f2937; border-radius:12px; }
    .lotto535 tr.r-bg > td:first-child { border-top-left-radius:12px; border-bottom-left-radius:12px; }
    .lotto535 tr.r-bg > td:last-child  { border-top-right-radius:12px; border-bottom-right-radius:12px; }
    .lotto535 .cell-date { width:120px; color:#e5e7eb; font-weight:600; }
    .lotto535 .cell-id   { width:90px;  color:#cbd5e1; font-weight:700; text-align:right; }
    .lotto535 .balls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .lotto535 .ball { width:32px; height:32px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; background:#e5e7eb; color:#0b1220; box-shadow:0 2px 6px rgba(0,0,0,.18); }
    .lotto535 .ball.dec-0 { background:#3b82f6; color:#fff; } .lotto535 .ball.dec-1 { background:#22c55e; color:#fff; } .lotto535 .ball.dec-2 { background:#f59e0b; color:#fff; } .lotto535 .ball.dec-3 { background:#8b5cf6; color:#fff; }
    .lotto535 .ball-bonus { background:#ef4444; color:#fff; border:2px solid #fff; }
    .lotto535 .plus { font-weight:700; opacity:.9; }
    .lotto535 .chips { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .lotto535 .chip { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:10px; border:1px solid #2b3344; background:#0e1526; color:#e5e7eb; font-weight:700; line-height:1; box-shadow:0 2px 6px rgba(0,0,0,.12); }
    .lotto535 .chip .num { font-weight:800; }
    .lotto535 .chip .gap { font-size:12px; opacity:.9; font-weight:600; }
    .lotto535 .chip.bonus { border-color:#ef4444; }
    .lotto535 .chip.dec-0 { border-color:#3b82f6; } .lotto535 .chip.dec-1 { border-color:#22c55e; } .lotto535 .chip.dec-2 { border-color:#f59e0b; } .lotto535 .chip.dec-3 { border-color:#8b5cf6; }
    .lotto535 .loadmore { margin:10px auto 16px; display:none; }
    .lotto535 .btn { padding:10px 14px; border-radius:10px; border:1px solid #334155; background:#111827; color:#e5e7eb; font-weight:600; cursor:pointer; }
    .lotto535 .btn[disabled]{ opacity:.5; cursor:default; }

    /* Combos */
    .lotto535 .combo-bar { display:flex; align-items:center; gap:10px; margin:6px 0 10px; }
    .lotto535 .combo-bar .chk { display:flex; align-items:center; gap:6px; font-size:13px; color:#cbd5e1; }
    .lotto535 .pager { display:flex; align-items:center; gap:8px; margin:8px 0 10px; }
    .lotto535 .pager .btn-mini { padding:6px 10px; border-radius:8px; border:1px solid #334155; background:#111827; color:#e5e7eb; cursor:pointer; font-weight:700; font-size:12px; }
    .lotto535 .pager input[type="number"]{ width:90px; padding:4px 6px; border-radius:6px; border:1px solid #334155; background:#0d1324; color:#e5e7eb; }
    .lotto535 .combos { display:flex; flex-direction:column; gap:8px; }
    .lotto535 .combo-item { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; border:1px solid #1f2937; background:#0b1220; }
    .lotto535 .combo-item.hit { border-color:#16a34a; box-shadow:0 0 0 1px rgba(22,163,74,.25) inset; }
    .lotto535 .combo-item .nums { display:flex; gap:6px; font-weight:800; color:#e5e7eb; }
    .lotto535 .combo-item .nums .n { padding:3px 8px; border-radius:8px; background:#0e1526; border:1px solid #233048; }
    .lotto535 .combo-item .meta { margin-left:auto; display:flex; align-items:center; gap:8px; }
    .lotto535 .combo-item .badge { padding:3px 8px; border-radius:999px; font-size:12px; background:#0e3020; color:#a7f3d0; border:1px solid #14532d; }
    .lotto535 .combo-item .btn-mini { padding:6px 10px; border-radius:8px; border:1px solid #334155; background:#111827; color:#e5e7eb; cursor:pointer; font-weight:700; font-size:12px; }
    .lotto535 .combo-detail { display:none; padding:8px 10px 10px 10px; border-left:2px solid #1f2937; margin-left:8px; }
    .lotto535 .combo-detail.show { display:block; }
    .lotto535 .detail-line { color:#cbd5e1; font-size:13px; margin-top:6px; }
    `;
    const style = document.createElement("style");
    style.id = "lotto535-styles"; style.textContent = css;
    document.head.appendChild(style);
  }

  // ------------- Results helpers -------------
  function ballHtml(n,isBonus=false){
    const t = String(n).padStart(2,"0");
    return isBonus ? `<span class="ball ball-bonus">${t}</span>` : `<span class="ball ${"ball "+ballClass(n)}">${t}</span>`.replace("ball ball","ball");
  }
  function chipHtml(n, gap, isBonus=false){
    const t = String(n).padStart(2,"0");
    const klass = isBonus ? "chip bonus" : `chip ${ballClass(n)}`;
    const gapTxt = (gap==null) ? "—" : `${gap} kỳ`;
    return `<span class="${klass}"><span class="num">${t}</span><span class="gap">${gapTxt}</span></span>`;
  }
  function calcGapsForRow(tr, occIndex){
    if (tr.dataset.gapsReady === "1") return JSON.parse(tr.dataset.gapsJson);
    const curId = parseInt(tr.getAttribute("data-id"),10);
    const main = (tr.getAttribute("data-main")||"").split(",").filter(Boolean).map(s=>parseInt(s,10));
    const bonus = parseInt(tr.getAttribute("data-bonus"),10);
    const out = [];
    for (const n of main){
      const prev = prevIdBinary(occIndex.get(n)||[], curId);
      out.push({ n, isBonus:false, gap: prev==null ? null : (curId - prev) });
    }
    { const n = bonus; const prev = prevIdBinary(occIndex.get(n)||[], curId);
      out.push({ n, isBonus:true, gap: prev==null ? null : (curId - prev) }); }
    tr.dataset.gapsReady = "1"; tr.dataset.gapsJson = JSON.stringify(out);
    return out;
  }
  function fillChipsForTr(tr, occIndex){
    const wrap = tr.querySelector(".view-chips .chips"); if (!wrap) return;
    const arr = calcGapsForRow(tr, occIndex);
    wrap.innerHTML = arr.map(x=>chipHtml(x.n, x.gap, x.isBonus)).join("");
  }

  // ------------- Combos paging renderer -------------
  function renderCombosPage(state, page){
    const { winMap, keyToRank, hitRanks, TOTAL_COMBOS, combosPageSize } = state;
    const list = document.getElementById("combos-list");
    const hitOnly = document.getElementById("chk-hitonly").checked;
    list.innerHTML = "";

    if (!hitOnly){
      state.pgTotal = Math.ceil(TOTAL_COMBOS / combosPageSize);
      page = Math.max(1, Math.min(page, state.pgTotal));
      const startRank = (page - 1) * combosPageSize + 1;
      const endRank   = Math.min(startRank + combosPageSize - 1, TOTAL_COMBOS);
      for (let r = startRank; r <= endRank; r++){
        const arr = unrankComb(35,5,r);
        const key = comboKey(arr);
        const ids = winMap.get(key);
        const hit = !!ids;
        const nums = numsSpan(arr);
        const badge = hit ? `<span class="badge">${ids.length} lần</span>` : "";
        const cls = hit ? "combo-item hit" : "combo-item";
        list.insertAdjacentHTML("beforeend", `
          <div class="${cls}" data-key="${key}">
            <div class="nums">${nums}</div>
            <div class="meta">
              <span class="badge">#${r}</span>
              ${badge}
              <button class="btn-mini btn-detail" ${hit?"":"disabled"}>Chi tiết</button>
            </div>
          </div>
          <div class="combo-detail" data-detail="${key}"></div>
        `);
      }
      state.pgCur = page;
    } else {
      state.pgTotal = Math.max(1, Math.ceil(hitRanks.length / combosPageSize));
      page = Math.max(1, Math.min(page, state.pgTotal));
      const start = (page - 1) * combosPageSize;
      const end   = Math.min(start + combosPageSize, hitRanks.length);
      for (let i = start; i < end; i++){
        const r   = hitRanks[i];
        const arr = unrankComb(35,5,r);
        const key = comboKey(arr);
        const ids = winMap.get(key) || [];
        const nums = numsSpan(arr);
        list.insertAdjacentHTML("beforeend", `
          <div class="combo-item hit" data-key="${key}">
            <div class="nums">${nums}</div>
            <div class="meta">
              <span class="badge">#${r}</span>
              <span class="badge">${ids.length} lần</span>
              <button class="btn-mini btn-detail">Chi tiết</button>
            </div>
          </div>
          <div class="combo-detail" data-detail="${key}"></div>
        `);
      }
      state.pgCur = page;
    }

    document.getElementById("pg-cur").textContent = String(state.pgCur);
    document.getElementById("pg-total").textContent = String(state.pgTotal);
    document.getElementById("pg-input").value = "";
  }

  // ------------- Main render -------------
  async function renderLotto535(){
    ensureStylesOnce();
    const container = document.getElementById("lotto535");
    if(!container) return;

    // frame
    container.classList.add("lotto535");
    container.innerHTML = `
      <div class="legend">
        <span class="legend-box dec-0">0–9</span>
        <span class="legend-box dec-1">10–19</span>
        <span class="legend-box dec-2">20–29</span>
        <span class="legend-box dec-3">30–35</span>
        <span class="legend-box bonus">Bonus</span>
        <button id="toggle-gaps">Hiện khoảng kỳ</button>
      </div>

      <div class="subtabs">
        <button class="tbtn active" data-tab="results">Kết quả</button>
        <button class="tbtn" data-tab="combos">Tổ hợp 5/35</button>
      </div>

      <div id="tab-results">
        <table class="tbl">
          <thead>
            <tr>
              <th class="cell-date">Ngày</th>
              <th class="cell-id">ID</th>
              <th class="cell-balls">Kết quả</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <div class="loadmore"><button class="btn" id="res-more">Tải thêm</button></div>
        <div id="results-sentinel" style="height:1px;"></div>
      </div>

      <div id="tab-combos" hidden>
        <div class="combo-bar">
          <label class="chk"><input type="checkbox" id="chk-hitonly"> Chỉ hiển thị bộ đã trúng</label>
        </div>
        <div class="pager">
          <button class="btn-mini" id="pg-prev">Prev</button>
          <span>Trang <span id="pg-cur">1</span> / <span id="pg-total">?</span></span>
          <form id="pg-jump" style="display:flex;align-items:center;gap:6px;">
            <span>Nhảy tới</span>
            <input id="pg-input" type="number" min="1" step="1" />
            <button class="btn-mini" type="submit">Go</button>
          </form>
		  <form id="pg-by-ky" style="display:flex;align-items:center;gap:6px;">
			  <span>Tới kỳ</span>
			  <input id="pg-by-ky-input" type="number" min="1" step="1"
					 style="width:90px;padding:4px 6px;border-radius:6px;border:1px solid #334155;background:#0d1324;color:#e5e7eb;" />
			  <button class="btn-mini" type="submit">Go</button>
			</form>

          <button class="btn-mini" id="pg-next">Next</button>
        </div>
        <div class="combos" id="combos-list"></div>
      </div>


    `;

    // load data
    const dataPath = CFG.dataPath;
	let raw;
	if (dataPath.endsWith(".jsonl")) raw = parseJSONLLocal(await loadText(dataPath));
	else raw = await loadJSON(dataPath);

	// Chuẩn hoá dữ liệu mới (ky → id, bonus tách riêng)
	const data = raw.map(r => ({
	  date: r.date,
	  id: r.ky || r.id,
	  result: Array.isArray(r.result) ? [...r.result, r.bonus] : [],
	}));
	data.sort((a,b)=> parseInt(b.id,10) - parseInt(a.id,10)); // mới → cũ

    const occIndex = buildOccurrenceIndex(data);
    const winMap = buildWinMap(data);
    const keyToRank = buildKeyToRank();
    const winRanks  = buildWinRanks(winMap, keyToRank);
    const winGapStat = gapStatsFromWinRanks(winRanks);

	// Map kỳ (ID số) -> rank của tổ hợp thắng ở kỳ đó
	const idToRank = new Map();
	for (const r of data){
	  const idNum = parseInt(r.id, 10);
	  const main = r.result.slice(0,5).slice().sort((a,b)=>a-b);
	  const key  = main.join("-");
	  const rank = keyToRank.get(key);
	  if (rank != null) idToRank.set(idNum, rank);
	}

    // ===== Results tab =====
    const tbody = container.querySelector("#tab-results tbody");
    const toggleBtn = container.querySelector("#toggle-gaps");
    let cursorRes = 0;
    const pageRes = CFG.pageSizeResults, initRes = CFG.maxInitialResults;

    function rowHtml(item){
      const main = item.result.slice(0,5);
      const bonus = item.result[5];
      const dataNums = main.join(",");
      return `
        <tr class="r-bg" data-id="${item.id}" data-main="${dataNums}" data-bonus="${bonus}">
          <td class="cell-date">${item.date}</td>
          <td class="cell-id">#${item.id}</td>
          <td>
            <div class="view view-balls">
              <div class="balls">
                ${main.map(n=>ballHtml(n)).join("")}
                <span class="plus">+</span>
                ${ballHtml(bonus,true)}
              </div>
            </div>
            <div class="view view-chips" hidden>
              <div class="chips"></div>
            </div>
          </td>
        </tr>`;
    }
    function renderSliceResults(start,count){
      const end = Math.min(start+count, data.length);
      let html=""; for(let i=start;i<end;i++) html += rowHtml(data[i]);
      tbody.insertAdjacentHTML("beforeend", html);
      return end;
    }
    cursorRes = renderSliceResults(cursorRes, initRes);

    function setMode(showGaps){
      const rows = tbody.querySelectorAll("tr.r-bg");
      rows.forEach(tr=>{
        const balls = tr.querySelector(".view-balls");
        const chips = tr.querySelector(".view-chips");
        if (showGaps){
          fillChipsForTr(tr, occIndex);
          balls.hidden = true; chips.hidden = false;
        } else {
          chips.hidden = true; balls.hidden = false;
        }
      });
      toggleBtn.dataset.showing = showGaps ? "1" : "0";
      toggleBtn.textContent = showGaps ? "Ẩn khoảng kỳ" : "Hiện khoảng kỳ";
    }
    toggleBtn.addEventListener("click", ()=> setMode(toggleBtn.dataset.showing !== "1"));

    const btnMoreRes = document.getElementById("res-more");
    function moreRes(){
      const prev = cursorRes;
      cursorRes = renderSliceResults(cursorRes, pageRes);
      if (toggleBtn.dataset.showing === "1"){
        const newRows = Array.from(tbody.querySelectorAll("tr.r-bg")).slice(prev, cursorRes);
        newRows.forEach(tr=>{
          fillChipsForTr(tr, occIndex);
          tr.querySelector(".view-balls").hidden = true;
          tr.querySelector(".view-chips").hidden = false;
        });
      }
      if (cursorRes >= data.length){ btnMoreRes.disabled = true; btnMoreRes.textContent = "Hết dữ liệu"; obsRes?.disconnect(); }
    }
    btnMoreRes.addEventListener("click", moreRes);
    let obsRes=null;
    if ("IntersectionObserver" in window){
      obsRes = new IntersectionObserver(es=>{ for (const e of es) if (e.isIntersecting) moreRes(); }, {rootMargin:"800px 0px"});
      obsRes.observe(document.getElementById("results-sentinel"));
    }

    // ===== Combos tab =====
    const TOTAL_COMBOS = nCk(35,5); // 324632
    const combosState = {
      winMap,
      keyToRank,
	  idToRank,  
      hitRanks: winRanks.slice(),
      TOTAL_COMBOS,
      combosPageSize: CFG.combosPageSize,
      pgCur: 1,
      pgTotal: Math.ceil(TOTAL_COMBOS / CFG.combosPageSize),
      winGapStat
    };

    // First paint
    renderCombosPage(combosState, 1);

    // Detail click: show rank info + neighbor rank gaps + global gaps stats
    const combosList = document.getElementById("combos-list");
    combosList.addEventListener("click", (ev)=>{
      const btn = ev.target.closest(".btn-detail"); if (!btn) return;
      const item = btn.closest(".combo-item");
      const key  = item?.dataset.key;
      const pane = combosList.querySelector(`.combo-detail[data-detail="${key}"]`);
      if (!pane) return;
      if (pane.classList.contains("show")){ pane.classList.remove("show"); pane.innerHTML=""; return; }

      const rank = keyToRank.get(key);
      const idx  = combosState.hitRanks.indexOf(rank);
      let prevInfo = "—", nextInfo = "—";
      if (idx >= 0){
        if (idx > 0){
          const prevRank = combosState.hitRanks[idx-1];
          prevInfo = `${rank - prevRank} (từ #${prevRank} → #${rank})`;
        }
        if (idx < combosState.hitRanks.length - 1){
          const nextRank = combosState.hitRanks[idx+1];
          nextInfo = `${nextRank - rank} (từ #${rank} → #${nextRank})`;
        }
      }
      const gaps = combosState.winGapStat.gaps;
      const avgLabel = gaps.length ? combosState.winGapStat.avg.toFixed(2) : "—";

      pane.innerHTML = `
        <div class="detail-line"><b>Thứ tự bộ này:</b> #${rank}</div>
        <div class="detail-line"><b>Khoảng cách tới bộ trúng liền trước:</b> ${prevInfo}</div>
        <div class="detail-line"><b>Khoảng cách tới bộ trúng liền sau:</b> ${nextInfo}</div>
        <div class="detail-line"><b>TB khoảng cách (toàn cục theo thứ tự tổ hợp):</b> ${avgLabel}</div>
      `;
      pane.classList.add("show");
    });

    // Pager & filters
    document.getElementById("pg-prev").addEventListener("click", (e)=>{ e.preventDefault(); renderCombosPage(combosState, combosState.pgCur - 1); });
    document.getElementById("pg-next").addEventListener("click", (e)=>{ e.preventDefault(); renderCombosPage(combosState, combosState.pgCur + 1); });
    document.getElementById("pg-jump").addEventListener("submit", (e)=>{
      e.preventDefault();
      const val = parseInt(document.getElementById("pg-input").value, 10);
      if (!Number.isFinite(val)) return;
      renderCombosPage(combosState, val);
    });
    document.getElementById("chk-hitonly").addEventListener("change", ()=>{
      renderCombosPage(combosState, 1);
    });
	// Jump tới trang chứa kỳ trúng X
	document.getElementById("pg-by-ky").addEventListener("submit", (e)=>{
	  e.preventDefault();
	  const inp = document.getElementById("pg-by-ky-input");
	  const val = parseInt(inp.value, 10);
	  if (!Number.isFinite(val)) return;

	  const rank = combosState.idToRank.get(val);
	  if (rank == null) {
		alert("Không tìm thấy kỳ này trong dữ liệu.");
		return;
	  }

	  const hitOnly = document.getElementById("chk-hitonly").checked;
	  let targetPage;

	  if (!hitOnly) {
		// Trang trong chế độ “Tất cả tổ hợp”
		targetPage = Math.ceil(rank / combosState.combosPageSize);
	  } else {
		// Trang trong chế độ “Chỉ bộ đã trúng”
		const idx = combosState.hitRanks.indexOf(rank);
		if (idx < 0) {
		  alert("Kỳ này không nằm trong danh sách đã trúng (theo lọc hiện tại).");
		  return;
		}
		targetPage = Math.floor(idx / combosState.combosPageSize) + 1;
	  }

	  // Render trang đích
	  renderCombosPage(combosState, targetPage);

	  // Cuộn & highlight nhẹ tổ hợp cần tìm
	  const arr = unrankComb(35, 5, rank);
	  const key = comboKey(arr);
	  const el  = document.querySelector(`.combo-item[data-key="${key}"]`);
	  if (el) {
		el.scrollIntoView({ block: "center", behavior: "smooth" });
		el.style.outline = "2px solid #60a5fa";
		setTimeout(()=>{ el.style.outline = ""; }, 1500);
	  }
	});

    // Subtabs switching
    const tabs = container.querySelectorAll(".subtabs .tbtn");
    function showTab(name){
      tabs.forEach(b=>b.classList.toggle("active", b.dataset.tab===name));
      document.getElementById("tab-results").hidden = (name!=="results");
      document.getElementById("tab-combos").hidden  = (name!=="combos");
    }
    container.querySelector('.tbtn[data-tab="results"]').addEventListener("click", ()=>showTab("results"));
    container.querySelector('.tbtn[data-tab="combos"]').addEventListener("click",  ()=>showTab("combos"));
  }

  // Auto-run
  document.addEventListener("DOMContentLoaded", ()=>{
    const el = document.getElementById("lotto535");
    if (el) renderLotto535().catch(err=>{
      el.innerHTML = `<div style="color:#b91c1c;">Lỗi Lotto 5/35: ${err?.message||err}</div>`;
    });
  });
})();
