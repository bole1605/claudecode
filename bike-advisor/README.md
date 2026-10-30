# Radwerk – Fahrrad-Konfigurator & Empfehlungsplattform

Mehrstufiger, dynamischer Fragebogen → Live-Marktsuche → transparenter Matching-Score (0–100 %) → Ergebnisse mit Begründung, Vergleich, Wunschliste, gespeicherten Suchen und KI-Berater.

## Starten
```bash
cd bike-advisor
cp .env.example .env      # ANTHROPIC_API_KEY eintragen (nur serverseitig)
npm start                 # http://localhost:3000
npm test                  # Node-Testrunner, keine Abhängigkeiten
```
Voraussetzung: Node ≥ 20, kein `npm install` nötig.

## Datenquellen einrichten (keine erfundenen Daten!)
Die App simuliert **nie** Suchergebnisse. Ohne aktive Quelle zeigt sie eine klare Meldung.

| Provider | Aktivierung | Verhalten |
|---|---|---|
| `claude-web` – Live-Websuche | `ANTHROPIC_API_KEY` | Claude recherchiert per Web-Search-Tool auf Hersteller-/Händlerseiten und liefert strukturierte JSON-Daten. Jede Produkt-URL wird gegen die tatsächlich gefundenen Suchtreffer geprüft: nur dann „Verifiziert“, sonst „Teilweise bestätigt“/„Nicht verifiziert“. Unbekannte Felder bleiben `null` und erscheinen als „nicht verifiziert“. |
| `catalog` – kuratierter Katalog | JSON-Dateien in `data/catalog/` | Vom Betreiber geprüfte Modelle (Pflichtfeld `lastVerified`; älter als 60 Tage = „veraltet“). Siehe `data/catalog/README.md`. |

Weitere Quellen (Händler-APIs, Affiliate-Feeds): neue Klasse in `server/providers/` mit `isAvailable()` und `search(spec)`, Registrierung in `providers/index.js`. Hersteller erweitern: `data/brands.extra.json` (Array von Namen) oder direkt im UI.

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
