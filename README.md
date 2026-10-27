# TikTok Ads Studio — APRD 3002 Social Lab

Static site (no build step). Tiles + detail screening + reel, modeled on the
Brandzooka Screening Room pattern. Data: a seeded slice of the course TikTok
ads dataset — top-100 highest-engaged oversample + 140 representative ads
(stratified by objective × spend tier), each with real video creative.

- Slice builder (server): `build/make_slice.py` → `data/data.json`, `build/validation.txt`
- Media pack (local): `build/make_media.py <originals-dir>` → `media/<id>.jpg|.mp4`
- Publish: `publish.sh` → https://chrisjvargo.com/tiktok-ads-studio/

Spend is the dataset's modeled low–high band, not audited invoices.
Engagement = likes + shares + favorites as provided.
