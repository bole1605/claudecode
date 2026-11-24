# Kasse – Weihnachtsmarkt

Einfaches Kassensystem als installierbare Web-App (PWA) für iPad und Android-Tablets. Keine Abhängigkeiten, läuft offline.

- Drei Seiten: **Crêpes**, **Burger & Spezi**, **Karten**. Kachel antippen = Artikel kommt auf den **Bon** (rechts).
- **Bezahlen** → Wechselgeld-Rechner (Schnellwahl 5/10/20/50/100 €, „Passend“, Ziffernblock) → **Verbuchen**.
- Einnahmen sind nur in der passwortgeschützten Verwaltung sichtbar, nicht auf den Verkaufsseiten.
- **Verwaltung** (extra Seite, Passwort): Titel oben links 5× schnell antippen oder 1,5 s halten. Beim ersten Mal wird das Passwort festgelegt.
  Dort: **Bearbeitungsmodus** (Produkte, Unterkategorien und Seiten hinzufügen, umbenennen, verschieben, löschen; Preise ändern), alle Buchungen, **Storno** (und Storno aufheben), Zahlen als CSV speichern, Buchungen löschen (wiederherstellbar), Passwort ändern.
- **MwSt.-Rechner** (in der Verwaltung ein-/ausschaltbar): Preise gelten als Brutto; je Produkt ist der Satz (0/7/19 %) einstellbar. Zeigt die enthaltene MwSt. am Bon, in der Verwaltung und in der CSV-Datei. Vorgabe: Speisen 7 %, Getränke/Karten 19 % – bitte prüfen.
- Stand fest einstellen: `…/kasse/#burger` (oder `#crepes`, `#karten`) als Home-Bildschirm-Link anlegen.
- Daten liegen lokal im jeweiligen Gerät (`localStorage`), je Tablet separat.

Preise/Produkte: oben in `app.js` (`STANDS`, Preise in Cent).
Lokal testen: `python3 -m http.server 8000` im Ordner `kasse`.
