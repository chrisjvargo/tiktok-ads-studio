# TikTok Ads Studio — APRD 3002 Social Lab

Static site (no build step). Tiles + detail screening + reel, modeled on the
Brandzooka Screening Room pattern. Data: US-English slice of the course TikTok ads dataset (2026-10-28 rebuild,
`build/make_slice_local.py`) — 181 ads with real video creative (70 top-engaged
ddoversample + 111 representative), non-English ads removed by title+ASR rule.
Population segments in data/segments.json are recomputed on the 5,365-ad
US-English population.

- Slice builder (server): `build/make_slice.py` → `data/data.json`, `build/validation.txt`
- Media pack (local): `build/make_media.py <originals-dir>` → `media/<id>.jpg|.mp4`
- Publish: `publish.sh` → https://chrisjvargo.com/tiktok-ads-studio/

Spend is the dataset's modeled low–high band, not audited invoices.
Engagement = likes + shares + favorites as provided.
