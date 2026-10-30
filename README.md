# Liegestütz Tracker

Installierbare Web-App (PWA) für iPhone und iPad – ohne Build-Schritt, ohne Abhängigkeiten, funktioniert offline.

- **Training:** Großer Tipp-Button zählt Liegestütze, Stoppuhr startet automatisch beim ersten Tippen (Pause/Weiter, −1, Tagesziel-Ring, Tempo pro Minute).
- **Kalender:** Monatsansicht mit Intensitäts-Farben, Tagesdetails, Einheiten löschen.
- **Statistik:** Kennzahlen (Gesamt, 7-Tage-Vergleich, Bestleistung, Serie), Fortschrittsdiagramm (30 Tage / Wochen / Monate mit gleitendem Mittel), Verlauf je Einheit mit Trendlinie und Auswertung.
- **Daten:** liegen lokal im Gerät (`localStorage`). Optional Synchronisierung zwischen Geräten über einen privaten GitHub-Gist (⚙︎ → Synchronisierung); Export/Import als JSON.

## Auf dem iPhone/iPad nutzen
Die Dateien müssen über HTTPS erreichbar sein (z. B. GitHub Pages: *Settings → Pages → Branch wählen, Ordner `/ (root)`*).
Dann in Safari die URL öffnen → **Teilen → „Zum Home-Bildschirm"**. Die App startet danach im Vollbild und läuft offline.

Lokal testen: `python3 -m http.server 8000` und `http://localhost:8000` öffnen.
