"use strict";
/* TikTok Ads Studio v4 — Decide + Browse. No labeling workflow.
   Decide: slice stats, cost rankings, objective x industry matrix,
   $10k benchmark comparison, verdict scaffold for the current slice. */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtInt = (n) => n == null ? "—" : Math.round(n).toLocaleString("en-US");
const fmtMoney = (n) => n == null ? "—" : "$" + (n >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(2));
const fmtCpe = (n) => n == null ? "—" : "$" + n.toFixed(3);
const fmtPct = (n) => n == null ? "—" : (n * 100).toFixed(1) + "%";
const med = (vals) => { const v = vals.filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };

const state = { rows: [], seg: null, industry: "", objective: "", query: "", sort: "engagement-desc", detailList: [], detailIdx: 0 };
const BENCH = [
  ["Meta (enter eMarketer CPM)", ""],
  ["YouTube (enter eMarketer CPM)", ""],
  ["CTV / streaming (enter eMarketer CPM)", ""],
  ["Search (enter eMarketer CPM)", ""],
];
const FIELD_NOTES = [
  ["Subaru on Trade Desk (real export, this semester)", 3.14],
  ["Display — Peter Brinkman field note", 2.35],
  ["Premium video / CTV — Peter Brinkman field note", 46.50],
  ["Netflix (class anecdote)", 65],
  ["Local TV (class anecdote)", 32],
  ["OOH (class anecdote)", 4.80],
];

function sliceRows() {
  return state.rows.filter((r) =>
    (!state.industry || r.industry === state.industry) &&
    (!state.objective || r.objectiveLabel === state.objective));
}
function statsOf(rows) {
  const spend = rows.reduce((a, r) => a + (r.spendPoint || 0), 0);
  const eng = rows.reduce((a, r) => a + (r.engagement || 0), 0);
  return { n: rows.length, spend, eng, cpe: eng ? spend / eng : null,
    ctr: med(rows.map((r) => r.ctr)), retention: med(rows.map((r) => r.retention)) };
}
function rankTable(title, groups) {
  const entries = Object.entries(groups).sort((a, b) => (a[1].costPerEngagement ?? 1e9) - (b[1].costPerEngagement ?? 1e9));
  return `<table class="rank"><thead><tr><th>${esc(title)}</th><th>Ads</th><th>Spend share</th><th>Cost / engagement</th><th>Median CTR</th><th>Median retention</th></tr></thead><tbody>` +
    entries.map(([k, v], i) => `<tr class="${i === 0 ? "rank-top" : ""}"><td>${esc(k)}</td><td>${v.ads}</td><td>${(100 * (v.spendShare || 0)).toFixed(0)}%</td><td>${fmtCpe(v.costPerEngagement)}</td><td>${fmtPct(v.medianCtr)}</td><td>${fmtPct(v.medianRetention)}</td></tr>`).join("") +
    `</tbody></table>`;
}
function renderDecide() {
  const rows = sliceRows();
  const s = statsOf(rows);
  $("#sliceStats").textContent = `${s.n} ads · ${fmtMoney(s.spend)} modeled · ${fmtCpe(s.cpe)} / engagement · CTR ${fmtPct(s.ctr)} · retention ${fmtPct(s.retention)}`;
  $("#rankIndustry").innerHTML = rankTable("Industry", state.seg.byIndustry);
  $("#rankObjective").innerHTML = rankTable("Objective", state.seg.byObjective);
  // matrix
  const inds = Object.keys(state.seg.byIndustry);
  const objs = Object.keys(state.seg.byObjective);
  const mat = state.seg.matrix;
  let html = `<table class="rank matrix"><thead><tr><th>Objective ↓ · Industry →</th>${inds.map((i) => `<th>${esc(i)}</th>`).join("")}</tr></thead><tbody>`;
  for (const o of objs) {
    html += `<tr><td>${esc(o)}</td>`;
    for (const i of inds) {
      const c = (mat[o] || {})[i];
      html += c ? `<td class="${c.costPerEngagement < 0.1 ? "cell-cheap" : c.costPerEngagement > 0.3 ? "cell-dear" : ""}" title="${c.ads} ads">${fmtCpe(c.costPerEngagement)}<span class="cell-n">n=${c.ads}</span></td>` : `<td class="cell-empty">—</td>`;
    }
    html += `</tr>`;
  }
  $("#matrixWrap").innerHTML = html + `</tbody></table>`;
  // benchmarks
  const tiktokRow = `<tr class="rank-top"><td>TikTok (current slice)</td><td>${fmtCpe(s.cpe)} / engagement</td><td>${s.cpe ? fmtInt(10000 / s.cpe) + " engagements" : "—"}</td></tr>`;
  const inputs = BENCH.map(([name], i) => `<tr><td>${esc(name)}</td><td><input class="bench-in" data-i="${i}" type="number" min="0" step="0.01" placeholder="CPM $"> / 1,000 impressions</td><td class="bench-out" data-i="${i}">—</td></tr>`).join("");
  const notes = FIELD_NOTES.map(([n, c]) => `<tr><td>${esc(n)} — field note, not a benchmark</td><td>$${c.toFixed(2)} CPM</td><td>${fmtInt(10000 / c * 1000)} impressions</td></tr>`).join("");
  $("#benchWrap").innerHTML = `<table class="rank"><thead><tr><th>Channel</th><th>Price</th><th>$10,000 buys</th></tr></thead><tbody>${tiktokRow}${inputs}${notes}</tbody></table>`;
  document.querySelectorAll(".bench-in").forEach((inp) => inp.addEventListener("input", () => {
    const cpm = parseFloat(inp.value);
    const out = document.querySelector(`.bench-out[data-i="${inp.dataset.i}"]`);
    out.textContent = cpm > 0 ? fmtInt(10000 / cpm * 1000) + " impressions" : "—";
  }));
  // verdict scaffold
  const all = statsOf(state.rows);
  const cheaper = s.cpe != null && all.cpe != null ? (100 * (1 - s.cpe / all.cpe)) : null;
  const where = `${state.industry || "All industries"} × ${state.objective || "all objectives"}`;
  $("#verdict").innerHTML = `<p><strong>${esc(where)}:</strong> ${s.n} ads at ${fmtCpe(s.cpe)} per engagement` +
    (cheaper != null ? ` — ${cheaper >= 0 ? cheaper.toFixed(0) + "% cheaper" : Math.abs(cheaper).toFixed(0) + "% more expensive"} than the full sample (${fmtCpe(all.cpe)})` : "") +
    `. Median CTR ${fmtPct(s.ctr)} (sample ${fmtPct(all.ctr)}), retention ${fmtPct(s.retention)} (sample ${fmtPct(all.retention)}).</p>` +
    `<p>Answer in your page: for this industry and goal, does TikTok beat the CPM channels above on a comparable basis — and what would have to be true about engagement value for that to hold? Name the brand you would fund, and the cell that proves it.</p>`;
}
function card(r) {
  return `<article class="card" data-id="${esc(r.id)}" tabindex="0">
    <div class="poster-wrap"><img src="${esc(r.poster)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;poster-fallback&quot;>poster pending</div>'"><span class="dur-badge">${r.duration ? Math.round(r.duration) + "s" : ""}</span></div>
    <div class="card-body">
      <div class="card-brand">${esc(r.brand || "—")}</div>
      <div class="card-title">${esc(r.title || "")}</div>
      <div class="card-meta">${esc(r.industry)} · ${esc(r.objectiveLabel)}</div>
      <div class="card-nums"><span>${fmtCpe(r.cpe)} / eng</span><span>CTR ${fmtPct(r.ctr)}</span><span>${fmtInt(r.engagement)} eng</span></div>
    </div></article>`;
}
function renderBrowse() {
  let rows = sliceRows().filter((r) => !state.query || (r.brand + " " + r.title).toLowerCase().includes(state.query));
  const by = { "engagement-desc": (a, b) => (b.engagement || 0) - (a.engagement || 0), "cpe-asc": (a, b) => (a.cpe ?? 1e9) - (b.cpe ?? 1e9),
    "ctr-desc": (a, b) => (b.ctr || 0) - (a.ctr || 0), "retention-desc": (a, b) => (b.retention || 0) - (a.retention || 0), "spend-desc": (a, b) => (b.spendPoint || 0) - (a.spendPoint || 0) };
  rows = rows.sort(by[state.sort] || by["engagement-desc"]);
  state.detailList = rows;
  $("#resultCount").textContent = `${rows.length} ads`;
  $("#grid").innerHTML = rows.map(card).join("");
  document.querySelectorAll(".card").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.id)));
}
function openDetail(id) {
  const i = state.detailList.findIndex((r) => r.id === id);
  if (i < 0) return;
  state.detailIdx = i;
  const r = state.detailList[i];
  $("#detailId").textContent = `${i + 1} / ${state.detailList.length} · ${r.brand || r.id}`;
  $("#detailBody").innerHTML = `<div class="video-shell"><video controls preload="metadata" poster="${esc(r.poster)}" src="${esc(r.mp4)}"></video></div>
    <h3>${esc(r.title || "")}</h3>
    <p>${esc(r.brand || "—")} · ${esc(r.industry)} · ${esc(r.objectiveLabel)} · spend tier ${esc(r.tier)}</p>
    <table class="rank"><tbody>
    <tr><td>Modeled spend</td><td>${fmtMoney(r.spendPoint)}</td></tr>
    <tr><td>Engagement (likes+shares+favorites)</td><td>${fmtInt(r.engagement)} (${fmtInt(r.likes)} + ${fmtInt(r.shares)} + ${fmtInt(r.favorites)})</td></tr>
    <tr><td>Cost per engagement</td><td>${fmtCpe(r.cpe)}</td></tr>
    <tr><td>CTR (as provided)</td><td>${fmtPct(r.ctr)}</td></tr>
    <tr><td>Retention (relative)</td><td>${fmtPct(r.retention)}</td></tr>
    <tr><td>Duration</td><td>${r.duration ? Math.round(r.duration) + "s" : "—"}</td></tr></tbody></table>`;
  $("#detailOverlay").hidden = false;
}
function stepDetail(d) {
  const n = state.detailList.length;
  if (!n) return;
  openDetail(state.detailList[(state.detailIdx + d + n) % n].id);
}
async function init() {
  const [data, seg] = await Promise.all([
    (await fetch("data/data.json")).json(),
    (await fetch("data/segments.json")).json(),
  ]);
  state.rows = data.rows; state.seg = seg;
  $("#statChips").innerHTML = `<span class="stat-chip"><strong>${data.rows.length}</strong> US-English ads</span><span class="stat-chip"><strong>${Object.keys(seg.byIndustry).length}</strong> industries</span><span class="stat-chip"><strong>${Object.keys(seg.byObjective).length}</strong> objectives</span>`;
  const fi = $("#fIndustry"), fo = $("#fObjective");
  Object.keys(seg.byIndustry).sort().forEach((k) => fi.insertAdjacentHTML("beforeend", `<option>${esc(k)}</option>`));
  Object.keys(seg.byObjective).forEach((k) => fo.insertAdjacentHTML("beforeend", `<option>${esc(k)}</option>`));
  fi.addEventListener("change", () => { state.industry = fi.value; renderDecide(); renderBrowse(); });
  fo.addEventListener("change", () => { state.objective = fo.value; renderDecide(); renderBrowse(); });
  $("#search").addEventListener("input", (e) => { state.query = e.target.value.trim().toLowerCase(); renderBrowse(); });
  $("#sortSel").addEventListener("change", (e) => { state.sort = e.target.value; renderBrowse(); });
  $("#decideTab").addEventListener("click", () => switchView(true));
  $("#browseTab").addEventListener("click", () => switchView(false));
  $("#closeBtn").addEventListener("click", () => { $("#detailOverlay").hidden = true; });
  $("#prevBtn").addEventListener("click", () => stepDetail(-1));
  $("#nextBtn").addEventListener("click", () => stepDetail(1));
  document.addEventListener("keydown", (e) => { if (!$("#detailOverlay").hidden && e.key === "Escape") $("#detailOverlay").hidden = true; });
  renderDecide(); renderBrowse();
}
function switchView(decide) {
  $("#decideView").hidden = !decide; $("#browseView").hidden = decide;
  $("#decideTab").setAttribute("aria-selected", decide); $("#browseTab").setAttribute("aria-selected", !decide);
}
init();
