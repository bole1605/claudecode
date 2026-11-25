# Kasse – Weihnachtsmarkt

Einfaches Kassensystem als installierbare Web-App (PWA) für iPad und Android-Tablets. Keine Abhängigkeiten zur Laufzeit, läuft offline.

Test- und Live-Version, Tests und Freigabe: siehe `ENTWICKLUNG.md`. Bedienung: `ANLEITUNG.md`. Verlauf: `CHANGELOG.md`.

- Drei Seiten: **Crêpes**, **Burger & Spezi**, **Karten**. Kachel antippen = Artikel kommt auf den **Bon** (rechts).
- **Bezahlen** → Wechselgeld-Rechner (Schnellwahl 5/10/20/50/100 €, „Passend“, Ziffernblock) → **Verbuchen**.
- Einnahmen sind nur in der passwortgeschützten Verwaltung sichtbar, nicht auf den Verkaufsseiten.
- **Verwaltung** (extra Seite, Passwort): Titel oben links 5× schnell antippen oder 1,5 s halten. Beim ersten Mal wird das Passwort festgelegt.
  Dort: **Bearbeitungsmodus** (Produkte, Unterkategorien und Seiten hinzufügen, umbenennen, verschieben, löschen; Preise ändern), alle Buchungen, **Storno** (und Storno aufheben), Zahlen als CSV speichern, Buchungen löschen (wiederherstellbar), Passwort ändern.
- **MwSt.-Rechner** (in der Verwaltung ein-/ausschaltbar): Preise gelten als Brutto; je Produkt ist der Satz (0/7/19 %) einstellbar. Zeigt die enthaltene MwSt. am Bon, in der Verwaltung und in der CSV-Datei. Vorgabe: Speisen 7 %, Getränke/Karten 19 % – bitte prüfen.
- **PayPal:** Beim Bezahlen „PayPal“ wählen → QR-Code zum Scannen (Link in der Verwaltung festlegen; bei paypal.me wird der Betrag eingetragen). Die Buchung wird als „PayPal“ vermerkt, Zahlarten stehen in Verwaltung und CSV.
- **Bons:** Jede Buchung hat Nummer sowie Datum und Uhrzeit (mit Sekunden). Nach dem Verbuchen erscheint „PDF“ / „Drucken“, später auch pro Buchung in der Verwaltung. Kopf (Name, Adresse, Steuernummer) und Fußzeile legst du in der Verwaltung fest; der Bon-Dienst lässt sich dort ausschalten.
- **Spende** (bei Barzahlung, in der Verwaltung abschaltbar): beim Bezahlen „Spende“ antippen und eingeben oder Schnelltasten (+0,50 / +1 / +2 € / Rest). Das Rückgeld wird danach berechnet. Spende zählt nicht zu den Einnahmen und steht getrennt in Verwaltung, Bon und CSV.
- **Kassenstand** (Verwaltung): Anfangsbestand festlegen; die App zeigt, wie sich der Bargeldbestand mit jeder Buchung ändert (Barverkauf + Spenden; PayPal und Stornos ändern ihn nicht). Auch in der CSV-Datei.
- **Burger:** beide Burger gibt es als **Vegi** und **Fleisch** (eigene Kachel, eigene Zeile auf dem Bon).
- **Pfand (Spezi):** Pro Flasche kommt automatisch „Pfand“ (2,00 €) auf den Bon. Die Kachel „Pfand zurück“ zahlt es bar aus (auch ohne Kauf). Der Betrag lässt sich im Bearbeitungsmodus beim Artikel „Pfand“ ändern.
- Stand fest einstellen: `…/kasse/#burger` (oder `#crepes`, `#karten`) als Home-Bildschirm-Link anlegen.
- Daten liegen lokal im jeweiligen Gerät (`localStorage`), je Tablet separat.

Preise/Produkte: oben in `app.js` (`STANDS`, Preise in Cent).
Lokal testen: `python3 -m http.server 8000` im Ordner `kasse`.
