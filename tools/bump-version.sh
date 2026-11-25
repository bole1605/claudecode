#!/usr/bin/env bash
# Versionsnummer der Test-Version erhöhen: tools/bump-version.sh 19
# (ändert index.html, sw.js und app.js in kasse-test; danach aktualisiert sich die App auf den Tablets sicher)
set -euo pipefail
cd "$(dirname "$0")/.."
NEW="${1:?Neue Versionsnummer angeben, z. B. 19}"
OLD=$(grep -o 'app.js?v=[0-9]*' kasse-test/index.html | grep -o '[0-9]*$')
[ "$OLD" != "$NEW" ] || { echo "Version ist schon $NEW"; exit 0; }
sed -i "s/?v=$OLD/?v=$NEW/g; s/>v$OLD</>v$NEW</" kasse-test/index.html
sed -i "s/?v=$OLD/?v=$NEW/g; s/const V = '$OLD'/const V = '$NEW'/" kasse-test/sw.js
sed -i "s/const VERSION = $OLD;/const VERSION = $NEW;/" kasse-test/app.js
echo "kasse-test: v$OLD -> v$NEW"
