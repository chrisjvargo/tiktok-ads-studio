"use strict";
/* TikTok Ads Studio v5 — two filters, video tiles, one aggregated slice view.
   Slice view: n, modeled spend, engagement, cost per engagement,
   engagements per $1,000, median CTR/retention, plus CPM benchmarks for scale. */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtInt = (n) => n == null ? "—" : Math.round(n).toLocaleString("en-US");
const fmtMoney = (n) => n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US");
const fmtCpe = (n) => n == null ? "—" : "$" + n.toFixed(3);
const fmtPct = (n) => n == null ? "—" : (n * 100).toFixed(1) + "%";
const med = (vals) => { const v = vals.filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };

const state = { rows: [], industry: "", objective: "", sort: "engagement-desc", detailList: [], detailIdx: 0 };
const BENCHMARKS = [
  ["TikTok (platform avg CPM)", 4.82, "Gupta Media 2025"],
  ["Meta (platform avg CPM)", 8.19, "Gupta Media 2025"],
  ["YouTube (platform avg CPM)", 4.99, "Gupta Media 2025"],
  ["CTV / streaming (avg CPM)", 26.50, "eMarketer Dec 2025"],
];

function sliceRows() {
  return state.rows.filter((r) =>
    (!state.industry || r.industry === state.industry) &&
    (!state.objective || r.objectiveLabel === state.objective));
}
function renderSlice() {
  const rows = sliceRows();
  const spend = rows.reduce((a, r) => a + (r.spendPoint || 0), 0);
  const eng = rows.reduce((a, r) => a + (r.engagement || 0), 0);
  const cpe = eng ? spend / eng : null;
  const label = `${state.industry || "All industries"} × ${state.objective || "all objectives"}`;
  $("#sliceStats").innerHTML =
    `<div class="slice-title">${esc(label)}</div>` +
    `<div class="slice-nums">` +
    `<span><strong>${rows.length}</strong> ads</span>` +
    `<span><strong>${fmtMoney(spend)}</strong> modeled spend</span>` +
    `<span><strong>${fmtInt(eng)}</strong> engagements</span>` +
    `<span><strong>${fmtCpe(cpe)}</strong> per engagement</span>` +
    `<span><strong>${cpe ? fmtInt(1000 / cpe) : "—"}</strong> engagements per $1,000</span>` +
    `<span>median CTR <strong>${fmtPct(med(rows.map((r) => r.ctr)))}</strong></span>` +
    `<span>median retention <strong>${fmtPct(med(rows.map((r) => r.retention)))}</strong></span>` +
    `</div>`;
  const bench = BENCHMARKS.map(([name, cpm, src]) =>
    `<span class="bench-chip">${esc(name)}: <strong>$${cpm.toFixed(2)}</strong> per 1,000 impressions <em>(${esc(src)})</em></span>`).join("");
  $("#cpmView").innerHTML =
    `<div class="cpm-head">For scale — CPM benchmarks (impressions, not engagements)</div><div class="bench-row">${bench}</div>` +
    (cpe ? `<p class="cpm-note">This slice buys an engagement for ${fmtCpe(cpe)}. $1,000 here buys ${fmtInt(1000 / cpe)} engagements. $1,000 on a CPM channel buys impressions instead — 1,000 impressions at a $8.19 CPM costs $8.19 and buys no promised engagement at all.</p>` : "");
  return rows;
}
function card(r) {
  return `<article class="card" data-id="${esc(r.id)}" tabindex="0">
    <div class="poster-wrap"><img src="${esc(r.poster)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;poster-fallback&quot;>poster pending</div>'"><span class="dur-badge">${r.duration ? Math.round(r.duration) + "s" : ""}</span><span class="play-badge">▶</span></div>
    <div class="card-body">
      <div class="card-brand">${esc(r.brand || "—")}</div>
      <div class="card-title">${esc(r.title || "")}</div>
      <div class="card-meta">${esc(r.industry)} · ${esc(r.objectiveLabel)}</div>
      <div class="card-nums"><span>${fmtCpe(r.cpe)} / eng</span><span>CTR ${fmtPct(r.ctr)}</span><span>${fmtInt(r.engagement)} eng</span></div>
    </div></article>`;
}
function renderGrid() {
  let rows = renderSlice();
  const by = { "engagement-desc": (a, b) => (b.engagement || 0) - (a.engagement || 0), "cpe-asc": (a, b) => (a.cpe ?? 1e9) - (b.cpe ?? 1e9),
    "ctr-desc": (a, b) => (b.ctr || 0) - (a.ctr || 0), "retention-desc": (a, b) => (b.retention || 0) - (a.retention || 0), "spend-desc": (a, b) => (b.spendPoint || 0) - (a.spendPoint || 0) };
  rows = [...rows].sort(by[state.sort] || by["engagement-desc"]);
  state.detailList = rows;
  $("#grid").innerHTML = rows.length ? rows.map(card).join("") : `<p class="honesty">No ads in this slice. Loosen a filter.</p>`;
  document.querySelectorAll(".card").forEach((el) => {
    el.addEventListener("click", () => openDetail(el.dataset.id));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") openDetail(el.dataset.id); });
  });
}
function openDetail(id) {
  const i = state.detailList.findIndex((r) => r.id === id);
  if (i < 0) return;
  state.detailIdx = i;
  const r = state.detailList[i];
  $("#detailId").textContent = `${i + 1} / ${state.detailList.length} · ${r.brand || r.id}`;
  $("#detailBody").innerHTML = `<div class="video-shell"><video controls autoplay preload="metadata" poster="${esc(r.poster)}" src="${esc(r.mp4)}"></video></div>
    <h3>${esc(r.title || "")}</h3>
    <p>${esc(r.brand || "—")} · ${esc(r.industry)} · ${esc(r.objectiveLabel)} · spend tier ${esc(r.tier)}</p>
    <table class="rank"><tbody>
    <tr><td>Modeled spend</td><td>${fmtMoney(r.spendPoint)}</td></tr>
    <tr><td>Engagement (likes + shares + favorites)</td><td>${fmtInt(r.engagement)} (${fmtInt(r.likes)} + ${fmtInt(r.shares)} + ${fmtInt(r.favorites)})</td></tr>
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
  const data = await (await fetch("data/data.json")).json();
  state.rows = data.rows;
  const fi = $("#fIndustry"), fo = $("#fObjective");
  [...new Set(data.rows.map((r) => r.industry))].sort().forEach((k) => fi.insertAdjacentHTML("beforeend", `<option>${esc(k)}</option>`));
  [...new Set(data.rows.map((r) => r.objectiveLabel))].sort().forEach((k) => fo.insertAdjacentHTML("beforeend", `<option>${esc(k)}</option>`));
  fi.addEventListener("change", () => { state.industry = fi.value; renderGrid(); });
  fo.addEventListener("change", () => { state.objective = fo.value; renderGrid(); });
  $("#sortSel").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });
  $("#closeBtn").addEventListener("click", () => { $("#detailOverlay").hidden = true; const v = $("#detailBody video"); if (v) v.pause(); });
  $("#prevBtn").addEventListener("click", () => stepDetail(-1));
  $("#nextBtn").addEventListener("click", () => stepDetail(1));
  document.addEventListener("keydown", (e) => { if (!$("#detailOverlay").hidden && e.key === "Escape") $("#detailOverlay").hidden = true; });
  renderGrid();
}
init();
