# Kasse – Weihnachtsmarkt

Einfaches Kassensystem als installierbare Web-App (PWA) für iPad und Android-Tablets. Keine Abhängigkeiten, läuft offline.

- Drei Seiten: **Crêpes & Spezi**, **Burger**, **Karten**. Jede Kachel antippen = 1× verkauft.
- Pro Kachel: Anzahl und Umsatz. Unten: Gesamteinnahmen der Seite.
- „−“ an der Kachel oder „Letzten Verkauf zurücknehmen“ korrigiert Fehltipps. Verkauf zählt sofort beim Antippen.
- Versteckte Verwaltung: Titel oben links 1,5 Sekunden gedrückt halten oder 5× schnell antippen → Zahlen als CSV-Datei speichern, Zähler zurücksetzen (mit Rückfrage und interner Sicherung), Zurücksetzen rückgängig machen.
- Stand fest einstellen: `…/kasse/index.html#burger` (oder `#crepes`, `#karten`) als Home-Bildschirm-Link anlegen.
- Daten liegen lokal im jeweiligen Gerät (`localStorage`), je Tablet separat.

Preise/Produkte: oben in `app.js` (`STANDS`, Preise in Cent).

Installieren: per HTTPS bereitstellen (z. B. GitHub Pages), dann iPad: Safari → Teilen → „Zum Home-Bildschirm“; Android: Chrome → „App installieren“.
Lokal testen: `python3 -m http.server 8000` im Ordner `kasse`.
