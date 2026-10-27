"use strict";
/* TikTok Ads Studio — static, no build step. GitHub Pages safe.
   One tile per ad. Slice "top" = oversample of highest-engaged;
   slice "rep" = seeded representative sample (see data.json meta). */

const $ = (id) => document.getElementById(id);
const state = {
  rows: [], filtered: [], detailPos: 0, p75: {},
  slice: new Set(), objective: new Set(), industry: new Set(),
  tier: new Set(), duration: new Set(), tab: "all",
};

const DURATION_PARAMS = [
  { key: "d15", label: "≤ 15s", match: (r) => r.duration != null && r.duration <= 15 },
  { key: "d30", label: "16–30s", match: (r) => r.duration > 15 && r.duration <= 30 },
  { key: "d60", label: "31–60s", match: (r) => r.duration > 30 && r.duration <= 60 },
  { key: "d61", label: "60s+", match: (r) => r.duration > 60 },
];
const SLICE_PARAMS = [
  { key: "top", label: "★ Top-engaged oversample", match: (r) => r.slice === "top" },
  { key: "rep", label: "Representative slice", match: (r) => r.slice === "rep" },
];
const TABS = [
  { key: "all", label: "All ads", match: () => true },
  { key: "top", label: "★ Most engaged", match: (r) => r.slice === "top" },
  { key: "rep", label: "Typical ads", match: (r) => r.slice === "rep" },
  { key: "winners", label: "High CTR + retention", match: (r) => r.ctr != null && r.retention != null && state.p75.ctr != null && r.ctr >= state.p75.ctr && r.retention >= state.p75.retention },
];

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fmtInt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString("en-US");
const fmtCompact = (n) => {
  if (n == null) return "—";
  const v = Number(n);
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(v));
};
const fmtMoney = (n) => n == null ? "—" : "$" + Math.round(Number(n)).toLocaleString("en-US");
const fmtPct = (n) => n == null ? "—" : (Number(n) <= 1 ? (Number(n) * 100).toFixed(1) : Number(n).toFixed(1)) + "%";
const fmtDur = (s) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m + ":" + String(sec).padStart(2, "0");
};

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
function percentile(vals, p) {
  const v = vals.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
}

/* ---------------- filtering + sorting ---------------- */
const SORTS = {
  "engagement-desc": (a, b) => (b.engagement ?? -1) - (a.engagement ?? -1),
  "ctr-desc": (a, b) => (b.ctr ?? -1) - (a.ctr ?? -1),
  "retention-desc": (a, b) => (b.retention ?? -1) - (a.retention ?? -1),
  "spend-desc": (a, b) => (b.spendHi ?? -1) - (a.spendHi ?? -1),
  "likes-desc": (a, b) => (b.likes ?? -1) - (a.likes ?? -1),
  "shares-desc": (a, b) => (b.shares ?? -1) - (a.shares ?? -1),
  "duration-asc": (a, b) => (a.duration ?? 1e9) - (b.duration ?? 1e9),
  "duration-desc": (a, b) => (b.duration ?? -1) - (a.duration ?? -1),
  "brand-asc": (a, b) => String(a.brand).localeCompare(String(b.brand)),
};

function applyFilters() {
  const q = $("search").value.trim().toLowerCase();
  const sortFn = SORTS[$("sortSel").value] || SORTS["engagement-desc"];
  const tab = TABS.find((t) => t.key === state.tab) || TABS[0];
  state.filtered = state.rows.filter((r) => {
    if (!tab.match(r)) return false;
    if (state.slice.size && !SLICE_PARAMS.some((p) => state.slice.has(p.key) && p.match(r))) return false;
    if (state.objective.size && !state.objective.has(r.objective)) return false;
    if (state.industry.size && !state.industry.has(r.industry)) return false;
    if (state.tier.size && !state.tier.has(r.tier)) return false;
    if (state.duration.size && !DURATION_PARAMS.some((p) => state.duration.has(p.key) && p.match(r))) return false;
    if (q) {
      const hay = `${r.id} ${r.title} ${r.brand} ${r.industry} ${r.objective}`;
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort(sortFn);
  $("resultCount").textContent = `${state.filtered.length} of ${state.rows.length} ads`;
  $("reelBtn").textContent = `▶ Play reel · ${state.filtered.length}`;
  renderGrid();
}

function clearAll() {
  $("search").value = "";
  for (const s of [state.slice, state.objective, state.industry, state.tier, state.duration]) s.clear();
  document.querySelectorAll(".wall .chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
  setTab("all");
}

function setTab(key) {
  state.tab = key;
  document.querySelectorAll("#sliceTabs .goaltab").forEach((b) => {
    b.setAttribute("aria-selected", b.dataset.tab === key ? "true" : "false");
  });
  applyFilters();
}
function buildTabs() {
  $("sliceTabs").innerHTML = TABS.map((t) => {
    const n = state.rows.filter(t.match).length;
    return `<button class="goaltab" role="tab" data-tab="${esc(t.key)}" aria-selected="${t.key === state.tab}" type="button">${esc(t.label)}<span class="tab-n">${n}</span></button>`;
  }).join("");
  $("sliceTabs").querySelectorAll(".goaltab").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
  });
}

function buildWall(elId, params, set) {
  $(elId).innerHTML = params.map((p) =>
    `<button type="button" class="chip" data-key="${esc(p.key)}" aria-pressed="false">${esc(p.label)}<span class="chip-n">${p.n}</span></button>`
  ).join("");
  $(elId).querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", on ? "false" : "true");
      if (on) set.delete(chip.dataset.key); else set.add(chip.dataset.key);
      applyFilters();
    });
  });
}
function countWall(rows, keyFn, limit) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit || 99).map(([key, n]) => ({ key, label: key, n }));
}
function buildWalls() {
  buildWall("sliceWall", SLICE_PARAMS.map((p) => ({ ...p, n: state.rows.filter(p.match).length })), state.slice);
  buildWall("objectiveWall", countWall(state.rows, (r) => r.objective), state.objective);
  buildWall("industryWall", countWall(state.rows, (r) => r.industry, 14), state.industry);
  buildWall("tierWall", countWall(state.rows, (r) => r.tier), state.tier);
  buildWall("durationWall", DURATION_PARAMS.map((p) => ({ ...p, n: state.rows.filter(p.match).length })), state.duration);
}

/* ---------------- grid ---------------- */
function metricMini(name, val, max, fmt) {
  const pct = val == null ? 0 : Math.max(0, Math.min(100, (val / max) * 100));
  const hot = val != null && state.p75[name] != null && val >= state.p75[name] ? " hot" : "";
  return `<div class="metric-mini"><div class="mm-label"><span>${name}</span><b>${val == null ? "—" : fmt(val)}</b></div>` +
    `<div class="mm-bar"><div class="mm-fill${hot}" style="width:${pct.toFixed(1)}%"></div></div></div>`;
}
function spendLine(r) {
  if (r.spendPoint == null) return "modeled spend n/a";
  return `modeled spend ≈ ${fmtMoney(r.spendPoint)} · tier ${esc(r.tier)}`;
}
function renderGrid() {
  const grid = $("grid");
  if (!state.filtered.length) {
    grid.innerHTML = `<div class="empty-note">No ads match these filters. <button class="btn btn-ghost" id="clearFiltersEmpty" type="button">Clear filters</button></div>`;
    $("clearFiltersEmpty").addEventListener("click", clearAll);
    return;
  }
  const maxEng = Math.max(...state.rows.map((r) => r.engagement || 0), 1);
  grid.innerHTML = state.filtered.map((r) => {
    const top = r.slice === "top" ? `<span class="degen-tick" style="background:var(--signal)">★ top ${r.rank}</span>` : "";
    return `<article class="card" tabindex="0" data-id="${esc(r.id)}" aria-label="${esc(r.brand)} — ${esc(r.title)}">
      <div class="poster-wrap">
        <img src="${esc(r.poster)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;poster-fallback&quot;>poster pending</div>'">
        ${top}
        <span class="dur-badge">${fmtDur(r.duration)}</span>
        <span class="play-hint">▶ watch</span>
      </div>
      <div class="card-body">
        <div class="card-idrow"><span class="card-rowid">${esc(r.brand)}</span><span class="goal-chip ${r.slice === "top" ? "goal-CTR" : "goal-none"}">${r.slice === "top" ? "top-engaged" : "representative"}</span></div>
        <h3 class="card-title">${esc(r.title || r.brand)}</h3>
        <div class="card-theme">${esc(r.industry)} · ${esc(r.objective)}</div>
        ${metricMini("engagement", r.engagement, maxEng, fmtCompact)}
        ${metricMini("ctr", r.ctr, state.p75.ctr ? state.p75.ctr * 1.6 : 1, fmtPct)}
        ${metricMini("retention", r.retention, state.p75.retention ? state.p75.retention * 1.6 : 1, fmtPct)}
        <div class="card-target" title="${esc(spendLine(r))}">${esc(spendLine(r))}</div>
      </div>
    </article>`;
  }).join("");
  grid.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openDetail(card.dataset.id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(card.dataset.id); }
    });
  });
}

/* ---------------- detail view ---------------- */
function detailHTML(r) {
  const sibs = state.rows.filter((x) => x.id !== r.id && x.brand === r.brand).slice(0, 8);
  const shareShare = r.engagement ? (100 * (r.shares || 0) / r.engagement) : null;
  return `
    <h2 class="detail-title">${esc(r.title || r.brand)}</h2>
    <div class="detail-sub"><span class="card-rowid">${esc(r.brand)}</span>
      <span class="tchip">${esc(r.industry)}</span><span class="tchip">objective: ${esc(r.objective)}</span>
      <span class="tchip">${r.slice === "top" ? `★ top-engaged #${r.rank}` : "representative slice"}</span>
    </div>
    <div class="detail-cols">
      <div>
        <div class="video-shell"><video controls preload="metadata" poster="${esc(r.poster)}" src="${esc(r.mp4)}"></video></div>
        <div class="creative-facts">
          <span class="fact-chip">${fmtDur(r.duration)} runtime</span>
          <span class="fact-chip">ad ${esc(String(r.id).slice(0, 12))}…</span>
        </div>
        <div class="panel" style="margin-top:14px"><h3>Talk about it</h3>
          <ul class="interest-list">
            <li>What happens in the first three seconds — and who is it for?</li>
            <li>Do the numbers fit the creative? Where would this ad fatigue first?</li>
            <li>If this were your client's money, what is the one test you run next?</li>
          </ul>
        </div>
      </div>
      <div>
        <div class="panel"><h3>Numbers</h3>
          <div class="big-metrics">
            <div class="big-metric"><div class="bm-val">${fmtCompact(r.engagement)}</div><div class="bm-name">Engagement (likes+shares+favorites)</div></div>
            <div class="big-metric"><div class="bm-val">${fmtPct(r.ctr)}</div><div class="bm-name">CTR, as provided</div></div>
            <div class="big-metric"><div class="bm-val">${fmtPct(r.retention)}</div><div class="bm-name">Mean retention, as provided</div></div>
          </div>
          <table class="kv-table"><tbody>
            <tr><td>Likes / Shares / Favorites</td><td>${fmtInt(r.likes)} / ${fmtInt(r.shares)} / ${fmtInt(r.favorites)}</td></tr>
            <tr><td>Shares as % of engagement</td><td>${shareShare == null ? "—" : shareShare.toFixed(1) + "%"}</td></tr>
            <tr><td>Modeled spend (tier estimate)</td><td>≈ ${fmtMoney(r.spendPoint)}</td></tr>
            <tr><td>Spend tier</td><td>${esc(r.tier)}</td></tr>
            <tr><td>Duration</td><td>${r.duration == null ? "—" : r.duration.toFixed(0) + "s"}</td></tr>
          </tbody></table>
          <p class="daypart-note">Spend is the dataset's modeled band, not an invoice. Engagement counts scale with spend — compare rates and retention before crowning a winner.</p>
        </div>
        <div class="panel"><h3>More from ${esc(r.brand)}</h3>
          ${sibs.length ? `<div class="sib-row">${sibs.map((s) => `<button class="sib-btn" data-sib="${esc(s.id)}" type="button">${esc(s.title || s.id)} · ${fmtCompact(s.engagement)}</button>`).join("")}</div>` : `<p class="daypart-note" style="margin-top:0">Only this ${esc(r.brand)} ad is in the slice.</p>`}
        </div>
      </div>
    </div>`;
}

function openDetail(id) {
  const pos = state.filtered.findIndex((r) => r.id === id);
  state.detailPos = pos >= 0 ? pos : 0;
  renderDetail();
  $("detailOverlay").hidden = false;
  document.body.style.overflow = "hidden";
}
function renderDetail() {
  const r = state.filtered[state.detailPos];
  if (!r) return;
  $("detailId").textContent = `${state.detailPos + 1} of ${state.filtered.length} in this view · ${r.slice === "top" ? "top-engaged" : "representative"}`;
  $("detailBody").innerHTML = detailHTML(r);
  $("detailBody").scrollTop = 0;
  $("prevBtn").disabled = state.detailPos <= 0;
  $("nextBtn").disabled = state.detailPos >= state.filtered.length - 1;
  const video = $("detailBody").querySelector("video");
  if (video) {
    video.addEventListener("error", () => {
      video.outerHTML = `<div class="poster-fallback" style="aspect-ratio:9/16">Video not in this staging yet — publish pack adds <br><span style="font-size:11px">${esc(r.mp4)}</span></div>`;
    }, true);
  }
  $("detailBody").querySelectorAll("[data-sib]").forEach((b) => {
    b.addEventListener("click", () => {
      const p = state.filtered.findIndex((x) => x.id === b.dataset.sib);
      if (p >= 0) { state.detailPos = p; renderDetail(); }
      else toast("That ad is outside the current filters");
    });
  });
}
function closeDetail() {
  $("detailOverlay").hidden = true;
  document.body.style.overflow = "";
  $("detailBody").innerHTML = "";
}

/* ---------------- reel ---------------- */
const reel = { list: [], pos: 0, skipTimer: null, skipLeft: 0 };
function reelTimeStr(s) {
  if (!isFinite(s) || s == null) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ":" + String(sec).padStart(2, "0");
}
function reelSetPlayIcon(playing) {
  $("reelPlayIcon").innerHTML = playing
    ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
    : '<path d="M8 5v14l11-7z"/>';
}
function reelArmSkip() {
  clearInterval(reel.skipTimer);
  const box = $("skipBox");
  box.hidden = false; box.classList.remove("ready"); box.onclick = null;
  reel.skipLeft = 5;
  box.textContent = `Skip Ad in ${reel.skipLeft}`;
  reel.skipTimer = setInterval(() => {
    reel.skipLeft -= 1;
    if (reel.skipLeft <= 0) {
      clearInterval(reel.skipTimer);
      box.classList.add("ready");
      box.innerHTML = `<span class="skip-go">Skip Ad ▶</span>`;
      box.onclick = () => reelStep(1);
    } else box.textContent = `Skip Ad in ${reel.skipLeft}`;
  }, 1000);
}
function reelLoad(i) {
  const r = reel.list[i];
  if (!r) return;
  reel.pos = i;
  const v = $("reelVideo");
  v.poster = r.poster; v.src = r.mp4;
  $("reelTitle").textContent = `${r.brand} — ${r.title || ""}`;
  $("reelCount").textContent = `${i + 1} of ${reel.list.length} · ${fmtCompact(r.engagement)} engagement · CTR ${fmtPct(r.ctr)}`;
  document.querySelectorAll(".reel-qitem").forEach((el, j) => el.classList.toggle("active", j === i));
  const active = document.querySelector(".reel-qitem.active");
  if (active) active.scrollIntoView({ block: "nearest" });
  v.play().then(() => reelSetPlayIcon(true)).catch(() => reelSetPlayIcon(false));
  reelArmSkip();
}
function reelStep(d) {
  const n = reel.pos + d;
  if (n < 0 || n >= reel.list.length) return;
  reelLoad(n);
}
function openReel() {
  if (!state.filtered.length) { toast("Nothing to play — clear the filters"); return; }
  reel.list = state.filtered.slice();
  $("reelQueue").innerHTML = reel.list.map((r, i) =>
    `<button class="reel-qitem" data-i="${i}" type="button"><img src="${esc(r.poster)}" alt="" loading="lazy"><span class="reel-qmeta"><span class="reel-qtitle">${esc(r.brand)} — ${esc(r.title || "")}</span><span class="reel-qsub">${fmtCompact(r.engagement)} eng · ${fmtDur(r.duration)}</span></span></button>`).join("");
  $("reelQueue").querySelectorAll(".reel-qitem").forEach((el) => {
    el.addEventListener("click", () => reelLoad(Number(el.dataset.i)));
  });
  $("reelOverlay").hidden = false;
  document.body.style.overflow = "hidden";
  reelLoad(0);
}
function closeReel() {
  clearInterval(reel.skipTimer);
  const v = $("reelVideo");
  v.pause(); v.removeAttribute("src"); v.load();
  $("skipBox").hidden = true;
  $("reelOverlay").hidden = true;
  document.body.style.overflow = "";
}

/* ---------------- init ---------------- */
async function init() {
  let data;
  try {
    const res = await fetch("data/data.json");
    data = await res.json();
  } catch (e) {
    $("grid").innerHTML = `<div class="empty-note">Could not load data/data.json — serve this folder over HTTP (not file://).</div>`;
    return;
  }
  state.rows = data.rows || [];
  const m = data.meta || {};
  state.p75 = {
    ctr: percentile(state.rows.map((r) => r.ctr), 0.75),
    retention: percentile(state.rows.map((r) => r.retention), 0.75),
    engagement: percentile(state.rows.map((r) => r.engagement), 0.75),
  };
  $("statChips").innerHTML =
    `<span class="stat-chip"><strong>${state.rows.length}</strong> ads with video</span>` +
    `<span class="stat-chip"><strong>${m.topN ?? ""}</strong> top-engaged oversample</span>` +
    `<span class="stat-chip"><strong>${m.repN ?? ""}</strong> representative</span>` +
    `<span class="stat-chip">from <strong>${fmtInt(m.population)}</strong> video ads</span>`;
  const about = $("aboutData");
  if (about && m.sampling) {
    about.innerHTML = `<li>${esc(m.sampling)}</li>` +
      `<li>Population: ${fmtInt(m.population)} ads with video creative in the course dataset. Median engagement in the population: ${fmtCompact(m.populationEngagementMedian)}.</li>` +
      `<li>Videos are the real ad creatives, compressed for the web. Posters are frames from the actual videos.</li>`;
  }
  buildTabs(); buildWalls();
  $("search").addEventListener("input", applyFilters);
  $("sortSel").addEventListener("change", applyFilters);
  $("clearFilters").addEventListener("click", clearAll);
  document.querySelectorAll('#themeList input').forEach(() => {});
  $("closeBtn").addEventListener("click", closeDetail);
  $("prevBtn").addEventListener("click", () => { if (state.detailPos > 0) { state.detailPos -= 1; renderDetail(); } });
  $("nextBtn").addEventListener("click", () => { if (state.detailPos < state.filtered.length - 1) { state.detailPos += 1; renderDetail(); } });
  $("detailOverlay").addEventListener("click", (e) => { if (e.target === $("detailOverlay")) closeDetail(); });
  $("reelBtn").addEventListener("click", openReel);
  $("reelClose").addEventListener("click", closeReel);
  $("reelPrev").addEventListener("click", () => reelStep(-1));
  $("reelNext").addEventListener("click", () => reelStep(1));
  const v = $("reelVideo");
  $("reelPlay").addEventListener("click", () => { if (v.paused) v.play(); else v.pause(); });
  v.addEventListener("play", () => reelSetPlayIcon(true));
  v.addEventListener("pause", () => reelSetPlayIcon(false));
  v.addEventListener("ended", () => { if (reel.pos < reel.list.length - 1) reelLoad(reel.pos + 1); });
  v.addEventListener("timeupdate", () => {
    $("reelTime").textContent = `${reelTimeStr(v.currentTime)} / ${reelTimeStr(v.duration)}`;
    if (v.duration) $("reelScrub").value = String(Math.round(1000 * v.currentTime / v.duration));
  });
  $("reelScrub").addEventListener("input", (e) => { if (v.duration) v.currentTime = v.duration * Number(e.target.value) / 1000; });
  $("reelMute").addEventListener("click", () => { v.muted = !v.muted; toast(v.muted ? "Muted" : "Sound on"); });
  $("reelFull").addEventListener("click", () => { const s = $("reelStage"); if (document.fullscreenElement) document.exitFullscreen(); else if (s.requestFullscreen) s.requestFullscreen(); });
  document.addEventListener("keydown", (e) => {
    if (!$("reelOverlay").hidden) {
      if (e.key === "Escape") closeReel();
      else if (e.key === "ArrowRight") reelStep(1);
      else if (e.key === "ArrowLeft") reelStep(-1);
      else if (e.key === " ") { e.preventDefault(); if (v.paused) v.play(); else v.pause(); }
    } else if (!$("detailOverlay").hidden) {
      if (e.key === "Escape") closeDetail();
      else if (e.key === "ArrowRight" && state.detailPos < state.filtered.length - 1) { state.detailPos += 1; renderDetail(); }
      else if (e.key === "ArrowLeft" && state.detailPos > 0) { state.detailPos -= 1; renderDetail(); }
    }
  });
  applyFilters();
}
document.addEventListener("DOMContentLoaded", init);

