"use strict";
/* TikTok Lab mode — labeling, segment calculator, cost comparison.
   Labels live in localStorage; segments recompute live from labels +
   the shipped population segments (data/segments.json). */

const INDUSTRIES = ["App — games", "App — utility / AI", "App — media / drama", "DTC physical product",
  "Beauty / fashion", "Food / delivery", "Finance / trading", "Education",
  "Health / wellness", "Entertainment / events", "Services / lead-gen", "Travel / local", "Other"];
const PRODUCT_TYPES = ["App install", "Physical product", "Subscription / service", "Content / media", "Local service", "Other"];
const OBJECTIVE_GUESS = ["Sell / signups", "Consideration", "Awareness"];

const lab = { labels: {}, queue: [], segments: null };

function labSave() { localStorage.setItem("tt_labels_v1", JSON.stringify(lab.labels)); }
function labLoad() {
  try { lab.labels = JSON.parse(localStorage.getItem("tt_labels_v1") || "{}"); } catch (e) { lab.labels = {}; }
}
function fmt$(n) { return n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"); }
function labRow(r) { return state.rows.find((x) => x.id === r) || null; }

function buildQueue() {
  const top = state.rows.filter((r) => r.slice === "top").slice(0, 40);
  const rep = state.rows.filter((r) => r.slice === "rep");
  const step = Math.max(1, Math.floor(rep.length / 20));
  const reps = rep.filter((_, i) => i % step === 0).slice(0, 20);
  lab.queue = [...top, ...reps];
}

function checkGroup(name, options, current, adId) {
  return `<div class="lab-checks" role="group" aria-label="${name}">${options.map((o) =>
    `<label class="lab-check"><input type="checkbox" data-ad="${adId}" data-group="${name}" value="${esc(o)}" ${current.includes(o) ? "checked" : ""}> ${esc(o)}</label>`).join("")}</div>`;
}

function renderLabQueue() {
  const el = document.getElementById("labQueue");
  if (!el) return;
  const done = lab.queue.filter((r) => lab.labels[r.id] && lab.labels[r.id].industry).length;
  document.getElementById("labProgress").textContent =
    `${done} of ${lab.queue.length} ads labeled — label at least 30 to unlock your segment tables.`;
  el.innerHTML = lab.queue.map((r) => {
    const L = lab.labels[r.id] || {};
    return `<article class="lab-card">
      <div class="lab-media"><img src="${esc(r.poster)}" alt="" loading="lazy"><span class="dur-badge">${fmtDur(r.duration)}</span></div>
      <div class="lab-body">
        <div class="lab-brand">${esc(r.brand || r.title || "Untitled ad")}</div>
        <div class="lab-meta">${esc(humanObjective(r.objective))} · ${fmtCompact(r.engagement)} engagement · modeled spend ≈ ${fmt$(r.spendPoint)} (tier ${esc(r.tier)})</div>
        <div class="lab-group-label">Industry</div>${checkGroup("industry", INDUSTRIES, L.industry ? [L.industry] : [], r.id)}
        <div class="lab-group-label">Product / service</div>${checkGroup("ptype", PRODUCT_TYPES, L.ptype ? [L.ptype] : [], r.id)}
        <div class="lab-group-label">Likely objective</div>${checkGroup("objective", OBJECTIVE_GUESS, L.objective ? [L.objective] : [], r.id)}
        <button class="btn btn-ghost lab-watch" data-watch="${esc(r.id)}" type="button">▶ Watch it</button>
      </div>
    </article>`;
  }).join("");
  el.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.ad, group = cb.dataset.group;
      // single-select behavior per group
      el.querySelectorAll(`input[data-ad="${id}"][data-group="${group}"]`).forEach((o) => { if (o !== cb) o.checked = false; });
      lab.labels[id] = lab.labels[id] || {};
      lab.labels[id][group] = cb.checked ? cb.value : null;
      labSave(); renderLabQueue(); renderSegments();
    });
  });
  el.querySelectorAll("[data-watch]").forEach((b) => {
    b.addEventListener("click", () => {
      const r = labRow(b.dataset.watch);
      if (r) { const p = state.rows.indexOf(r); state.filtered = [r]; openDetail(r.id); }
    });
  });
}

function humanObjective(o) {
  return String(o || "").replace("campaign_objective_", "").replace(/_/g, " ") || "—";
}

function segTable(title, groups) {
  if (!groups.length) return `<div class="panel"><h3>${title}</h3><p class="daypart-note">No labeled ads in this cut yet — label more ads in Step 1.</p></div>`;
  const totalSpend = groups.reduce((s, g) => s + g.spend, 0) || 1;
  return `<div class="panel"><h3>${title}</h3><table class="kv-table seg-table"><thead><tr><td>Segment</td><td>Ads</td><td>Spend share</td><td>Cost / engagement</td><td>Median CTR</td><td>Median retention</td></tr></thead><tbody>
    ${groups.map((g) => `<tr><td>${esc(g.name)}</td><td>${g.n}</td><td>${(100 * g.spend / totalSpend).toFixed(0)}%</td><td>$${g.cpe.toFixed(2)}</td><td>${fmtPct(g.ctr)}</td><td>${fmtPct(g.retention)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function aggregate(key) {
  const map = new Map();
  for (const r of state.rows) {
    const L = lab.labels[r.id];
    if (!L || !L[key]) continue;
    const g = map.get(L[key]) || { name: L[key], n: 0, spend: 0, eng: 0, ctrs: [], rets: [] };
    g.n += 1; g.spend += r.spendPoint || 0; g.eng += r.engagement || 0;
    if (r.ctr != null) g.ctrs.push(r.ctr);
    if (r.retention != null) g.rets.push(r.retention);
    map.set(L[key], g);
  }
  const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  return [...map.values()].map((g) => ({ ...g, cpe: g.spend / Math.max(g.eng, 1), ctr: med(g.ctrs), retention: med(g.rets) }))
    .sort((a, b) => b.spend - a.spend);
}

function popTable(title, obj) {
  if (!obj) return "";
  const rows = Object.entries(obj).map(([name, g]) => ({ name, ...g })).sort((a, b) => b.spend - a.spend);
  const total = rows.reduce((s, g) => s + g.spend, 0) || 1;
  return `<div class="panel"><h3>${title} (full dataset, 6,849 ads)</h3><table class="kv-table seg-table"><thead><tr><td>Segment</td><td>Ads</td><td>Spend share</td><td>Cost / engagement</td><td>Median CTR</td><td>Median retention</td></tr></thead><tbody>
    ${rows.map((g) => `<tr><td>${esc(humanObjective(g.name))}</td><td>${g.ads}</td><td>${(100 * g.spend / total).toFixed(0)}%</td><td>$${Number(g.costPerEngagement).toFixed(2)}</td><td>${fmtPct(g.medianCtr)}</td><td>${fmtPct(g.medianRetention)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function renderSegments() {
  const el = document.getElementById("labSegments");
  if (!el) return;
  el.innerHTML =
    segTable("Your labeled ads — by industry", aggregate("industry")) +
    segTable("Your labeled ads — by likely objective", aggregate("objective")) +
    popTable("By campaign objective", lab.segments && lab.segments.byObjective) +
    popTable("By duration", lab.segments && lab.segments.byDuration);
}

const COST_ROWS = [
  ["TikTok (this dataset)", "cost per engagement, modeled", "$0.21 video-view · $0.24 app-install · $0.54 traffic · $0.66 conversion · $1.26 lead-gen · $1.84 product-sales", "Course dataset, 6,849 ads — modeled spend tiers, not invoices"],
  ["TikTok (benchmarks)", "CPM", "≈ $9–13 CPM (2026 benchmark roundups; pull the eMarketer table via CU Libraries for the citable figure)", "Secondary roundups of Gupta/Triple Whale data — replace with eMarketer in your write-up"],
  ["The Trade Desk (Subaru, real)", "CPM", "$3.14 CPM — $4.64M ÷ 1.477B impressions (2018 full year)", "Class 22 Campaign Reporting deck — real client export"],
  ["Display (Peter Brinkman)", "CPM", "≈ $1.20 media + $1.00 data + $0.15 platform fee", "Peter Brinkman, Assembly Global — Oct 20 guest chat"],
  ["Premium video / CTV (Peter)", "CPM", "≈ $45 media CPM + $1.50 brand-safety", "Peter Brinkman — Oct 20 guest chat"],
  ["ChatGPT ads (Peter)", "CPM", "~$50 CPM (early testing)", "Peter Brinkman — Oct 20 guest chat"],
  ["Netflix (class anecdote)", "CPM", "~$65 CPM", "Oct 15 contextual media plans class"],
  ["Contextual open web (class data)", "CPM", "$2.61–$3.50 CPM climate-action inventory; $0.50 CPM pays the journalists (Argus)", "Oct 15 Ben & Jerry's / socialcontext inventory"],
  ["Local TV package (class deck)", "CPM", "≈ $32 CPM for ≈4.2M target impressions", "Traditional Media II deck"],
  ["OOH package (class deck)", "CPM", "≈ $4.80 CPM on a $60K package at frequency ≈ 9", "Traditional Media I deck"],
];

function renderCosts() {
  const el = document.getElementById("labCosts");
  if (!el) return;
  el.innerHTML = `<div class="panel"><h3>What attention costs — TikTok vs. everything else we priced this semester</h3>
  <table class="kv-table seg-table"><thead><tr><td>Medium</td><td>Unit</td><td>Figure</td><td>Source</td></tr></thead><tbody>
  ${COST_ROWS.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("")}
  </tbody></table>
  <p class="daypart-note"><strong>Read this honestly:</strong> CPM prices a thousand <em>impressions</em>; our TikTok data has no impression counts, so we price a thousand <em>engagements</em> instead. Different denominators — the comparison teaches the shape of relative cost, not an exact exchange rate. For a citable TikTok CPM, pull the eMarketer (Insider Intelligence) CPM table through CU Libraries and cite it with its date.</p></div>`;
}

async function initLab() {
  labLoad();
  try { lab.segments = await (await fetch("data/segments.json")).json(); } catch (e) { lab.segments = null; }
  buildQueue(); renderLabQueue(); renderSegments(); renderCosts();
  const browseBtn = document.getElementById("browseTab");
  const labBtn = document.getElementById("labTab");
  const browseView = document.getElementById("browseView");
  const labView = document.getElementById("labView");
  const show = (labMode) => {
    browseView.hidden = labMode; labView.hidden = !labMode;
    browseBtn.setAttribute("aria-selected", String(!labMode));
    labBtn.setAttribute("aria-selected", String(labMode));
  };
  browseBtn.addEventListener("click", () => show(false));
  labBtn.addEventListener("click", () => show(true));
}
document.addEventListener("DOMContentLoaded", () => { setTimeout(initLab, 0); });
