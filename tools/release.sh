#!/usr/bin/env bash
# Test-Version (kasse-test) als Live-Version (kasse) freigeben. Läuft nur, wenn alle Tests bestehen.
set -euo pipefail
cd "$(dirname "$0")/.."
node tests/unit.js kasse-test
node tests/e2e.js kasse-test
for f in index.html bon.html display.html app.js logic.js sound.js theme.js qrcode.js styles.css sw.js manifest.webmanifest; do cp "kasse-test/$f" "kasse/$f"; done
rm -rf kasse/icons && cp -r kasse-test/icons kasse/icons
# Test-Kennzeichnung zurücknehmen
sed -i 's/"name": "Kasse – TEST"/"name": "Kasse – Weihnachtsmarkt"/; s/"short_name": "Kasse TEST"/"short_name": "Kasse"/' kasse/manifest.webmanifest
sed -i 's/content="Kasse TEST">/content="Kasse">/' kasse/index.html
node tests/unit.js kasse && node tests/e2e.js kasse
echo "Freigegeben: kasse (live) = kasse-test"
