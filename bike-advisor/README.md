# KonfiRad – Fahrrad-Konfigurator & Empfehlungsplattform

Mehrstufiger, dynamischer Fragebogen → Live-Marktsuche → transparenter Matching-Score (0–100 %) → Ergebnisse mit Begründung, Vergleich, Wunschliste, gespeicherten Suchen und KI-Berater.

## Starten
```bash
cd bike-advisor
cp .env.example .env      # optional: ANTHROPIC_API_KEY (nur für KI-Berater/KI-Websuche)
npm start                 # http://localhost:3000
npm test                  # Node-Testrunner, keine Abhängigkeiten
```
Voraussetzung: Node ≥ 20, kein `npm install` nötig.

## Datenquellen (keine erfundenen Daten!)
KonfiRad simuliert **nie** Suchergebnisse. Es gibt drei austauschbare Quellen, die parallel laufen:

| Provider | Kosten | Aktivierung | Verhalten |
|---|---|---|---|
| `website` – Hersteller-/Händlerseiten | **kostenlos** | `data/sources.json` (5 Seiten vorbelegt) | robots.txt → Sitemap → passende Produktseiten → Preis/Name/Bild aus strukturierten Seitendaten (JSON-LD), Technik per Textanalyse. Gedrosselt (1,2 s/Seite), 24 h Festplatten-Cache, nur persönliche Nutzung. Technikdaten sind als „automatisch extrahiert“ markiert; Mehrdeutiges bleibt „nicht verifiziert“. |
| `catalog` – kuratierter Katalog | kostenlos | JSON in `data/catalog/` | Nur vom Betreiber geprüfte Modelle (`lastVerified` Pflicht). |
| `claude-web` – Websuche per KI | API-Kosten | `ANTHROPIC_API_KEY` | Optional, breiter und genauer; Produkt-URLs werden gegen echte Suchtreffer geprüft. Gleiche Anthropic-Key aktiviert den KI-Berater. |

**Wichtig zur kostenlosen Quelle:** Ich konnte sie nur gegen einen lokalen Test-Shop prüfen (die Entwicklungsumgebung hat keinen Internetzugang). Ob eine echte Seite brauchbare Sitemaps/Strukturdaten liefert, prüfst du so:
```bash
npm run check-source -- https://www.canyon.com
```
Die Ausgabe zeigt Sitemap-Größe, Produkt-Kandidaten und was extrahiert wurde. Funktioniert eine Seite nicht (oder untersagt `robots.txt` das Auslesen), setze sie in `data/sources.json` auf `"enabled": false` oder ergänze eigene Websites.

## Geräteübergreifend nutzen
Wunschliste, gespeicherte Suchen, Entwurf und letzte Ergebnisse liegen serverseitig in `data/user/store.json` und werden automatisch synchronisiert (letzter Schreiber gewinnt). Für Handy/Tablet im Heimnetz in `.env`: `HOST=0.0.0.0` und **unbedingt** `APP_PIN=…`; dann `http://<IP-deines-Rechners>:3000` öffnen.

## Architektur
```
shared/      läuft in Browser UND Server (eine Wahrheitsquelle)
  taxonomy   Typen, Ausstattung, Budgetstufen, Affinitäts-Matrix
  questionnaire  schema-getriebener Fragebogen (Sichtbarkeit = dynamische Fragen)
  validate   Eingabevalidierung aus dem Fragebogen-Schema
  derive/spec  abgeleitete Größen → Suchspezifikation
  range      Reichweiten-/Akkumodell (Gewicht, Höhenmeter, Unterstützung, Temperatur, Gelände)
  sizing     Rahmengrößen-Empfehlung + Größenabgleich
  bikeSchema Normalisierung/Plausibilisierung von Fahrraddaten
  scoring    Matching-Algorithmus
server/      http (ohne Framework), Provider, SearchService (asynchrone Jobs, Cache), AdvisorService
public/      Vanilla-ES-Module, XSS-sicherer DOM-Helfer, Hash-Router, localStorage-Store
```
Entscheidungen: **keine Dependencies/kein Build** (wartbar, keine Supply-Chain-Risiken); **geteilter Code** (Vorschau im Client und Scoring im Server sind identisch); **Provider-Interface** (Quellen austauschbar); **asynchrone Suchjobs** (Suche dauert bis ~1 min; später durch Queue/Redis ersetzbar); **Store-Abstraktion** (`public/js/store.js` → später Account/DB).

### Scoring
Gewichte: Einsatzzweck 20, Budget 15, Komponenten 12, Motor/Akku 10, Ausstattung 10, Geometrie 10, Reichweite 8, Preis-Leistung 6, Gewicht 5 (+5 bei sportlich), Wünsche 4. Nicht anwendbare Kriterien entfallen und werden renormiert.
- **Muss-Kriterien** (Budget +5 %, Antriebsart, Muss-Ausstattung, als Muss gewählte Technik, Rahmengröße, Systemgewicht, Akku < 70 % der Empfehlung, Reichweite < 75 %, ausgeschlossene Marke, Zustand): Verstoß → Score ≤ 64 % (−6 je weiterer), Label „Muss-Kriterium nicht erfüllt“.
- **Unbekannte Daten** zählen nie als erfüllt: neutral 50 %; unbekanntes Muss-Kriterium → Deckel 85 %; Anzeige „Datenvertrauen“.
- Zusätzlich: Preis-Leistungs-Tipp, Premium-Empfehlung (über Budget), Kompromissvorschläge, „bessere Alternative im Budget“.
- Reichweite, Rahmengröße und Preis-Leistung sind Schätzmodelle (Heuristik) und im UI so gekennzeichnet.

### Sicherheit
API-Key nur serverseitig (`.env`, nicht im Repo); schema-validierte Eingaben; Body- und Rate-Limit pro IP; CSP und Security-Header; externe Inhalte nur als Text, Links mit `noopener nofollow`; nur http(s)-URLs.

## Grenzen / nächste Schritte
- Suchqualität hängt von der Websuche ab; Preise/Verfügbarkeit sind Momentaufnahmen. Gebrauchtmarkt nur best effort.
- Wunschliste/Suchen liegen lokal im Browser (plus JSON-Export/-Import); Konten und Server-DB sind der nächste Schritt.
- Weitere Provider (Händler-/Affiliate-APIs), Preisverlauf, Bildcache.
