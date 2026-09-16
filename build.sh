#!/usr/bin/env bash
set -euo pipefail
# Cloudflare redeploy trigger after private hermes-knowledge auth configuration.

echo "=== 1. Init submodules (pull latest) ==="
git submodule update --init --remote --recursive

echo "=== 1b. Clone hermes-knowledge (private) ==="
HERMES_REPO="https://github.com/notacryptodad/hermes-knowledge.git"
GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: GH_TOKEN (or GITHUB_TOKEN) must be configured to clone private hermes-knowledge." >&2
  exit 1
fi
AUTH_HEADER="$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')"
if [ ! -d "submodules/hermes-knowledge/.git" ]; then
  rm -rf submodules/hermes-knowledge
  git -c "http.extraheader=AUTHORIZATION: Basic ${AUTH_HEADER}" clone --depth 1 "$HERMES_REPO" submodules/hermes-knowledge
else
  cd submodules/hermes-knowledge && git -c "http.extraheader=AUTHORIZATION: Basic ${AUTH_HEADER}" pull origin main && cd ../..
fi

echo "=== 2. Build compareAI ==="
pushd submodules/compareAI
python3 -m pip install --quiet pyyaml
python3 scripts/validate.py --expire-days 100000
python3 scripts/build_data.py
popd

echo "=== 3. Prepare hermes-knowledge notes ==="
node scripts/prepare-notes.mjs

echo "=== 3b. Fetch OG images (incremental) ==="
node scripts/fetch-og-images.mjs

echo "=== 3c. Re-prepare notes with OG data ==="
node scripts/prepare-notes.mjs

echo "=== 4. Build Astro site ==="
npx astro build

echo "=== 6. Merge compareAI into dist ==="
mkdir -p dist/compareAI
cp src/compareAI/index.html dist/compareAI/
cp submodules/compareAI/dist/app.js dist/compareAI/
cp submodules/compareAI/dist/data.json dist/compareAI/

echo "=== Done ==="
echo "dist/ contents:"
ls -la dist/
echo "dist/compareAI/ contents:"
ls -la dist/compareAI/
