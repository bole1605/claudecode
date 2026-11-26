# Änderungsverlauf Kasse

| Version | Änderung |
|---|---|
| v1 | Drei Seiten (Crêpes & Spezi, Burger, Karten), Kacheln zählen Verkäufe und Einnahmen |
| v2 | Schnelleres Tippen, versteckte Verwaltung, Zahlen als CSV speichern |
| v3 | Aktualisierung am HTTP-Cache vorbei, Verwaltung auch durch 5× Tippen |
| v4 | Bon mit Wechselgeld-Rechner, Buchungen, Storno mit Passwort, Spezi zu den Burgern |
| v5 | Bearbeitungsmodus für Produkte, Unterkategorien und Seiten |
| v6 | Einnahmen nur noch in der Verwaltung sichtbar |
| v7 | Mehrwertsteuer-Rechner (ein-/ausschaltbar, Satz je Produkt) |
| v8 | PayPal-Zahlung mit QR-Code, Zahlart in Buchungen |
| v9 | PayPal-Link wird bereinigt, Passwortfeld erlaubt Buchstaben |
| v10 | Bons mit Zeitstempel, PDF und Druck |
| v11 | Passwort pro Gerät mit Wiederholung und Wiederherstellungscode |
| v12 | Trinkgeld bei Barzahlung |
| v13 | PayPal-QR als Bild (iPad) |
| v14 | Kassenstand (Anfangsbestand, Verlauf je Buchung) |
| v15 | PayPal-Betrag ein-/ausschaltbar, Trinkgeld-Tasten addieren sich |
| v16 | PayPal-QR-Inhalt wählbar, dokumentiertes Betragsformat |
| v17 | Trinkgeld → Spende, Burger Vegi/Fleisch, Spezi-Pfand |
| v18 | **Offline-Betrieb repariert (Service Worker war seit v5 leer), Datensicherung (Datei) mit Wiederherstellen, Test- und Live-Version, automatische Tests, Fokus-Fehler in Eingabefenstern behoben, Bildschirm bleibt an, dauerhafter Speicher** |
| v19 | **Bon für den Kunden: QR-Code zur Online-Ansicht und E-Mail-Entwurf nach dem Verbuchen (in der Verwaltung ein-/ausschaltbar), Taste „QR / Mail“ in der Leiste und in der Buchungsliste** |
| v20 | **Lesbarkeit und Ruhe:** Preis und Name in kräftigem Schwarz, Zähler erst ab 1 (Schwarz oder Weiß je nach Farbe), Karten in Indigo statt Rot, Tablet auf einen Stand festlegbar (Reiter ausgeblendet), Wischen zählt nicht als Verkauf, Raster so, dass die Burger-Seite ohne Scrollen passt** |
| v21 | **Kassensturz** (Stückelung zählen, Differenz zum Soll, Protokoll), **Einlagen/Entnahmen**, **Kassenbericht** als A4-PDF und zum Drucken, auch in CSV und Sicherung |
| v22 | **Spende ohne Einkauf**, **Bestellnummern je Sparte** (C1, B1 …) und **Küchenanzeige** als zweites Fenster/Overlay, **Töne**, Logo der ev. Jugend (hell/dunkel) und Fußzeile „coded by Leo B. - 2026“ |
| v23 | **Kachelfarben aus dem Logo der ev. Jugend:** Lila (Crêpes), Grau (Burger), Flieder (Getränke), Dunkelgrau (Karten); gespeicherte Sortimente werden einmal umgestellt, eigene Farben bleiben |
| **v24** | **Design:** Knöpfe in Logo-Lila, Logo im Hintergrund, einstellbares Design (Thema, hell/dunkel, Knopffarbe, Logo, Schnee) und ein Weihnachtsdesign (Lichterkette, Mütze, festliche Farben, Schnee) |
| (v25) | Überarbeitete Töne (weiche Sinus-Töne, Klang „Weich/Tief“) **zurückgenommen**: die Testversion ist wieder auf dem Stand von **v24**. Die Änderung steht im Verlauf (Commit „Kasse v25 (Test): softer tap sounds“) und lässt sich wieder einspielen |
| **v26** | **Küchenanzeige repariert:** zeigt beim Öffnen alle Sparten (außer das Gerät ist auf einen Stand festgelegt), lange Wörter werden nicht mehr abgeschnitten (Silbentrennung), im Weihnachtsdesign wird sie nicht mehr zusammengedrückt (kein Schnee in der Küche), kein doppelter Titel, Kopfzeile nicht mehr unter dem Testbalken |
| **v27** | **Töne reduziert** auf zwei: Einkauf verbucht, Bestellung fertig (auch Spende). Töne auch bei stummem iPad (Wiedergabe-Modus, echtes stilles Audio). **Bestellungen auf der Kasse** (Tab „Bestellungen“: Fertig, abgeholt, Rückgängig). Küchenanzeige für den zweiten Monitor nur zum Ansehen (`?view=1`), Link statt neuem Fenster in der App, „← Zur Kasse“. |
