# TikTok Ads Studio — APRD 3002 Social Lab

Static site (no build step). Decide dashboard + ad browser.

- Data v2 (2026-10-28, server `socialcontextgpu3`): 352 US-English ads with
  real video creative, famous/branded first, stratified across objective ×
  spend tier (`tt_studio_slice2` on the server; sample script seeded 3002).
  Industries resolved from brand/title/landing evidence + TikTok taxonomy
  (`build/resolve_industries.py`); TikTok house ads removed.
- `data/segments.json`: by-industry and by-objective cost ranks plus the
  objective × industry cost-per-engagement matrix (cells need n≥4).
- Decide view: slice stats for the current filter, both rankings, matrix,
  $10,000 benchmark comparison (engagements vs CPM impressions), verdict
  scaffold, and the Adobe Express CMO decision task (`DECISION_TASK.md`).
- Publish: `publish.sh` → https://chrisjvargo.com/tiktok-ads-studio/

Spend is modeled from TikTok spend tiers (≈$6 / $323 / $30,630), not
invoices. Engagement = likes + shares + favorites as provided.
