#!/bin/bash
# Publish the TikTok Ads Studio to GitHub Pages (chrisjvargo.com/tiktok-ads-studio).
set -euo pipefail
SRC="/Users/chrisjvargo/My Drive/2work/courses_taught/1cu_media_planning/outputs/tiktok_studio"
DST="$HOME/gh_deploy/tiktok-ads-studio"
mkdir -p "$DST"
rsync -a --delete --exclude .git --exclude build --exclude '*.pyc' "$SRC/" "$DST/"
cd "$DST"
if [ ! -d .git ]; then
  git init -q -b main
  git add -A
  git commit -qm "TikTok Ads Studio — APRD 3002 social lab"
  gh repo create chrisjvargo/tiktok-ads-studio --public --source=. --push
  gh api -X POST repos/chrisjvargo/tiktok-ads-studio/pages -f 'source[branch]=main' -f 'source[path]=/' || true
else
  git add -A
  git commit -qm "Update TikTok Ads Studio" || true
  git push -q
fi
echo "Pushed. Pages URL: https://chrisjvargo.com/tiktok-ads-studio/"
