# Entwicklung und Betrieb der Kasse

## Zwei Versionen
| Ordner | Adresse | Zweck |
|---|---|---|
| `kasse-test/` | `…/claudecode/kasse-test/` | **Testversion.** Hier entstehen alle Änderungen. Oben orangefarbener Balken „TESTVERSION“, eigener Speicher (keine echten Buchungen). |
| `kasse/` | `…/claudecode/kasse/` | **Live-Version** für die Helfer am Markt. Wird nur durch eine Freigabe verändert. |

Beide Versionen liegen auf derselben Domain, haben aber getrennte Speicher und getrennte Caches. Testbuchungen landen also nie in der Live-Kasse.

## Ablauf einer Änderung
1. Änderung in `kasse-test/` (Versionsnummer erhöhen: `tools/bump-version.sh 19`).
2. `npm test` (Rechentests und Ablauf-Tests im Browser, auch offline). Die Tests laufen außerdem bei jedem Push automatisch bei GitHub.
3. Auf dem Tablet mit der **Test-Adresse** ausprobieren.
4. **Freigabe** (nur nach Okay): `tools/release.sh` kopiert `kasse-test` nach `kasse`, entfernt die Test-Kennzeichnung und prüft die Live-Version noch einmal.

## Änderungsstopp am Markt
Ab dem Vorabend keine Freigaben mehr, außer Notfall-Korrekturen. Während des Markts nie die Live-Version ändern: Die App lädt sich auf den Tablets beim nächsten Start selbst neu.

## Zurück zur vorherigen Live-Version
Jede Freigabe ist ein eigener Commit. Zurücknehmen: den Commit der Freigabe zurücksetzen („Revert“) und neu veröffentlichen. Die Tablets holen sich die ältere Version beim nächsten Start.

## Tests
- `npm test` – alles (Rechentests, Ablauf-Tests für `kasse-test` und `kasse`)
- `npm run test:unit` – nur die Rechenfunktionen (`logic.js`)
- Der Ablauf-Test „Offline-Betrieb“ stellt sicher, dass die App ohne Netz startet. Er hätte den leeren Service Worker von v5 bis v17 erkannt.
- Einmalig einrichten: `npm install` und `npx playwright install chromium`

## Aufbau
- `logic.js` – reine Rechen- und Hilfsfunktionen (Wechselgeld, Kassenstand, MwSt., PayPal-Link, PDF), getestet
- `app.js` – Oberfläche, Speicher, Verwaltung
- `sw.js` – Service Worker (Offline), `qrcode.js` – QR-Code (MIT-Lizenz, Kazuhiko Arase)
