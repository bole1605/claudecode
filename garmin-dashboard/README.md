# Garmin Dashboard

Installierbare Web-App (PWA) für **Windows (Edge/Chrome)** sowie **iPad/iPhone (Safari)** – ohne Build-Schritt, mit lokal gebündelten Bibliotheken (Chart.js, Leaflet).

| Seite | Inhalt |
|---|---|
| **Heute** | Garmin-Bereitschaft, Tagesempfehlung, Schlaf/HRV/Ruhepuls/Body Battery/Stress/Schritte/VO₂max/ACWR, Woche, Prognosen (Belastung mit/ohne Plan, HRV, Ruhepuls, VO₂max), Rennprognosen |
| **Rückblick** | 4 Wochen / 8 Wochen / Alles: Umfang je Woche, Intensitätsverteilung, Pace & Puls je Lauf, Schlaf, HRV, Ruhepuls, Schritte, Trainingslast, Bestleistungen, Aktivitätenliste |
| **Training** | 7-Tage-Plan nach Ziel (Fit bleiben, 10 km, Halbmarathon, Marathon, Rad-Ausdauer), angepasst an Tagesform und Historie · **Routenplaner** mit Karte |

## Routenplaner (Laufen, Gravel, MTB, Rennrad)
- Rundkurs, Hin-und-zurück oder selbst zeichnen (Punkte setzen/ziehen), Vorgabe nach **Strecke oder Zeit** (Tempo aus deiner Historie).
- Routing über BRouter (Fallback OSRM) auf OpenStreetMap-Karten, Höhenprofil, geschätzte Dauer.
- **GPX-Export** (Download oder „Teilen …“ → Komoot). Komoot hat keine offene Import-Schnittstelle – der Weg läuft über die GPX-Datei.

## Automatische Aktualisierung
Die App prüft beim Öffnen, beim Zurückkehren und alle 15 Minuten, ob eine neuere `garmin-data.json` bereitliegt (Feld `generated`), und zeigt neue Werte sofort an. Quelle: Daten-URL aus ⚙ „Daten“ (https-Adresse oder `github:besitzer/repo/pfad.json` mit Lese-Token für ein **privates** Repo), sonst `data/garmin-data.json` neben der App. Das Befüllen der Quelle übernimmt ein Aktualisierer außerhalb der App – Garmin erlaubt Apps keinen direkten Zugriff.

## Daten
Die App speichert alles **lokal im Browser**. Datenquellen (⚙ „Daten“):
- `garmin-data.json` (Format siehe `data/garmin-data.json`, wird von Claude aus Garmin Connect erzeugt),
- Aktivitäten-CSV aus Garmin Connect (nur Aktivitäten, keine Schlaf-/HRV-Daten).

`data/garmin-data.json` steht in `.gitignore`, damit Gesundheitsdaten nicht im Repository landen. Auf jedem Gerät die Datei einmal importieren.

## Veröffentlichung (GitHub Pages)
Der Ablauf `.github/workflows/pages.yml` veröffentlicht bei jedem Push auf den Hauptzweig beide Apps:
- `https://bole1605.github.io/claudecode/` – Liegestütz-Tracker
- `https://bole1605.github.io/claudecode/garmin/` – Garmin Dashboard

Einmalig nötig: Repo → *Settings → Pages → Build and deployment → Source: **GitHub Actions***. Die Datei `data/garmin-data.json` wird dabei nie veröffentlicht; die Daten kommen über die Daten-URL (privates Repo) oder per Import.

## Nutzen
- **Windows:** Adresse in Edge/Chrome öffnen → „App installieren“.
- **iPad/iPhone:** Adresse in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

Lokal testen: `cd garmin-dashboard && python3 -m http.server 8000` → http://localhost:8000
