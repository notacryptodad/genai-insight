#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Init submodules (pull latest) ==="
git submodule update --init --remote --recursive

echo "=== 1b. Clone hermes-knowledge (private) ==="
if [ ! -d "submodules/hermes-knowledge/.git" ]; then
  rm -rf submodules/hermes-knowledge
  git clone --depth 1 "https://${GH_TOKEN}@github.com/notacryptodad/hermes-knowledge.git" submodules/hermes-knowledge
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
