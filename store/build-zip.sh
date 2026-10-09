#!/bin/sh
# Builds the Chrome Web Store upload: dist/bottle-list-<version>.zip, with manifest.json at the top level.
set -e
cd "$(dirname "$0")/.."
node --test tests/*.test.mjs > /dev/null
version=$(node -p "require('./manifest.json').version")
mkdir -p dist
rm -f "dist/bottle-list-$version.zip"
zip -q -X "dist/bottle-list-$version.zip" manifest.json background.js core.mjs storage.mjs shared.js extract.js \
  popup.html popup.js dashboard.html dashboard.js style.css icons/icon16.png icons/icon48.png icons/icon128.png
echo "Built dist/bottle-list-$version.zip"
