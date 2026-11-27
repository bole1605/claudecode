# Anleitung Kasse – Weihnachtsmarkt

Stand dieser Anleitung: Version **v36** (die Versionsnummer steht oben rechts in der App).

---

## 1. Einrichten (einmal pro Tablet)

**Adressen** (je Stand eine):

| Stand | Adresse |
|---|---|
| Crêpes | `https://bole1605.github.io/code/kasse/#crepes` |
| Burger & Spezi | `https://bole1605.github.io/code/kasse/#burger` |
| Karten | `https://bole1605.github.io/code/kasse/#karten` |

**Neue Adresse seit der Umbenennung des Repositorys (`claudecode` → `code`):** Die alten Adressen `…/claudecode/…` funktionieren nicht mehr. Wer die App schon vom Home-Bildschirm nutzt, muss sie **einmal neu installieren**. Die Daten des alten Symbols wandern **nicht** automatisch mit. Deshalb vorher in der alten App unter Verwaltung → Datensicherung eine **Sicherung speichern**, die App am neuen Link installieren und die Sicherung dort **wiederherstellen**. Das Passwort wird dabei nicht übertragen, du legst es neu fest.

**iPad:** Adresse in **Safari** öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“** → Hinzufügen.
**Android-Tablet:** Adresse in **Chrome** öffnen → Menü (⋮) → **„App installieren“** (oder „Zum Startbildschirm“).

Danach immer die App über das Symbol auf dem Home-Bildschirm starten, nicht über den Browser. Die App läuft nach dem ersten Laden auch **ohne Internet**. Nur für Updates und für PayPal braucht das Tablet Netz. Starte sie vor dem Markt einmal mit Internet, damit sie sich vollständig speichert.

**Passwort festlegen (wichtig, vor dem Übergeben des Tablets):**
1. Titel oben links **5-mal schnell antippen** (oder 1,5 Sekunden gedrückt halten).
2. Beim ersten Mal wirst du aufgefordert, ein Passwort festzulegen (mindestens 4 Zeichen, Buchstaben und Zahlen möglich). Du gibst es **zweimal** ein.
3. Danach zeigt die App einen **Wiederherstellungscode** (z. B. `ABCD-EF23`). **Notiere ihn auf Papier**, nicht auf dem Tablet.
4. **Das Passwort gilt nur für das jeweilige Tablet.** Auf jedem Gerät, das eine Kollegin oder ein Kollege öffnet, wird beim ersten Mal ein eigenes Passwort festgelegt. Es wird nicht von anderen Geräten übernommen. Nimm auf allen Tablets am besten dasselbe Passwort.
5. Wer das Passwort nicht kennt, kommt nicht an Storno, Einnahmen und Einstellungen.

---

## 2. Verkaufen (für das Standpersonal)

Oben wählst du den Stand (Crêpes / Burger & Spezi / Karten). Jeder Stand benutzt nur seine Seite.

1. **Kachel antippen** = Artikel kommt auf den **Bon** (rechts). Mehrfach tippen = mehrfach. Die Zahl oben rechts an der Kachel zeigt, wie oft der Artikel auf dem aktuellen Bon liegt.
2. **Zähler:** Die Zahl an der Kachel erscheint erst, wenn der Artikel auf dem Bon liegt. Eine Kachel mit Zähler hat einen farbigen Rahmen.
3. **Korrigieren:** „−“ an der Kachel oder in der Bon-Zeile nimmt einen Artikel wieder herunter. „Bon leeren“ räumt alles ab.
3. **Bezahlen** antippen. Oben wählst du die Zahlart:
   - **Bar:** Gib das gegebene Geld ein (Schnelltasten 5/10/20/50/100 €, „Passend“ oder Ziffernblock). Unten steht groß das **Rückgeld**. Fehlt Geld, steht in Rot „Es fehlen …“. Dann **Verbuchen**.
   - **PayPal:** Es erscheint ein **QR-Code**. Kundin oder Kunde scannt ihn mit der PayPal-App. **Erst wenn die Zahlung bei dir angekommen ist**, auf „PayPal-Zahlung erhalten · Verbuchen“ tippen.
4. **Burger:** Es gibt beide Burger als **Vegi** und als **Fleisch**, jeweils mit eigener Kachel. Auf dem Bon steht die Sorte.
5. **Spezi-Pfand:** Beim Tippen auf „Paulaner Spezi“ kommt das **Pfand automatisch** (2,00 €) als eigene Zeile auf den Bon. Gibt jemand eine Flasche zurück, tippst du „Pfand zurück“: Das Pfand wird abgezogen oder, wenn sonst nichts auf dem Bon liegt, **bar ausgezahlt** („Auszahlen“). Das Pfand zählt in den Einnahmen und im Kassenstand mit, die Rückgabe zieht es wieder ab. Die Höhe stellst du im Bearbeitungsmodus beim Artikel „Pfand“ ein.
6. Erst mit **Verbuchen** ist der Verkauf gebucht. Danach ist der Bon leer, und es geht weiter mit dem nächsten.

An den Kacheln steht klein „verkauft: N“. Das sind die bereits verbuchten Stück je Artikel.

Auf den Verkaufsseiten sind **keine Einnahmen** zu sehen. Die gibt es nur in der Verwaltung.

---

## 3. Verwaltung (nur mit Passwort)

**Öffnen:** Titel oben links 5-mal schnell antippen (oder 1,5 s halten) → Passwort eingeben. Mit **Fertig** oben rechts geht es zurück zur Kasse.

Was dort steht:

- **Zwischenstand dieses Geräts:** Einnahmen je Stand und insgesamt, Anzahl Buchungen und Artikel, aufgeteilt nach Bar und PayPal.
- **Buchungen:** alle Bons mit Nummer, Uhrzeit, Artikeln, Zahlart sowie gegebenem Geld und Rückgeld.
  - **Stornieren:** falsche Buchung rückgängig machen (mit Rückfrage). Stornierte Buchungen zählen nicht mehr in die Einnahmen. Mit **„Storno aufheben“** gilt sie wieder.
  - Ein Storno ändert nur die Zahlen in der App. **Eine PayPal-Rückzahlung musst du selbst in PayPal machen.**

Einstellungen (alle in der Verwaltung):

| Was | Wo / wie |
|---|---|
| **Mehrwertsteuer-Rechner** an/aus | Schalter oben. Aus = nirgends MwSt. zu sehen. An = MwSt. am Bon, in der Verwaltung und in der Datei. Die Preise gelten als **Brutto**, die MwSt. wird herausgerechnet. |
| **PayPal-Link** | „PayPal-Link festlegen“, z. B. `https://paypal.me/DeinName`. Bei paypal.me trägt die App den Betrag automatisch in den QR-Code ein. Bei anderen Links (z. B. PayPal-QR-Link) wird der Link ohne Betrag angezeigt. „PayPal-Link entfernen“ löscht ihn wieder. |
| **Bearbeitungsmodus** | Produkte, Unterkategorien und Seiten ändern (siehe 4.). |
| **Zahlen speichern (Datei)** | Erzeugt eine CSV-Datei (siehe 5.). |
| **Passwort ändern** | Neues Passwort festlegen (erzeugt auch einen neuen Wiederherstellungscode). |
| **QR-Code / E-Mail nach dem Verbuchen** | Schalter im Bereich „Bons“, siehe Abschnitt 5b. |
| **Design** | Thema (Logo-Lila, Weihnachten, Klassisch), hell/dunkel, Farbe der Knöpfe, Logo im Hintergrund, Schnee (Abschnitt 5h). |
| **Töne** | Ein/aus, Lautstärke, jedes der zwei Signale einzeln (Schiffshorn beim Verbuchen, Abholbereit), Test (Abschnitt 5g). |
| **Küchenanzeige / Bestellnummern** | Ein/aus, Nummern zurücksetzen, Anzeige leeren (Abschnitt 5f). |
| **Bons (PDF & Druck)** | Schalter und „Bon-Kopf und Fußzeile festlegen“. Nach dem Verbuchen erscheint „PDF“ und „Drucken“, später auch bei jeder Buchung in der Liste. |
| **Sortiment auf Standard zurücksetzen** | Stellt das ursprüngliche Sortiment wieder her. Gebuchte Verkäufe bleiben erhalten. |
| **Alle Buchungen auf diesem Gerät löschen** | Löscht alle Buchungen (mit Rückfrage). Mit „Gelöschte Buchungen wiederherstellen“ holst du sie zurück, solange du nicht erneut löschst. |

---

## 4. Bearbeitungsmodus: Produkte und Seiten ändern

Verwaltung → **„Bearbeitungsmodus (Produkte & Seiten)“**. Oben erscheint ein orangefarbener Balken, und der Bon ist ausgeblendet. Mit **Fertig** beendest du den Modus.

- **Produkt ändern:** Kachel antippen → Name, Zusatz (z. B. „0,5 l“), **Preis**, Unterkategorie und **MwSt.-Satz** (0 / 7 / 19 %) ändern → Speichern. Dort kannst du es auch **löschen**.
- **Produkt hinzufügen:** In der Unterkategorie auf **„＋ Produkt“** tippen.
- **Unterkategorie** (z. B. „Getränke“): hinzufügen mit „＋ Unterkategorie hinzufügen“. An jeder Überschrift kannst du sie **umbenennen**, **löschen** und mit **↑ ↓** verschieben.
- **Seite (Hauptkategorie):** Mit **＋** in der Leiste oben legst du eine neue Seite an. Die aktuelle Seite kannst du **umbenennen** oder **löschen**. Die letzte Seite lässt sich nicht löschen.
- Ein Produkt in eine andere Unterkategorie verschieben: im Produkt-Dialog die Unterkategorie wechseln.

Gut zu wissen:
- Schon gebuchte Verkäufe behalten **Name und Preis von damals**. Eine Preisänderung oder das Löschen ändert die alten Buchungen und Einnahmen nicht.
- Änderungen am Sortiment gelten **nur auf diesem Tablet**. Soll auf allen Tablets dasselbe stehen, musst du es dort jeweils einzeln ändern.
- Neue Seiten haben keinen kurzen Link wie `#burger`. Öffne sie am Tablet und lass sie ausgewählt.
- **Steuersätze:** Voreingestellt sind Crêpes und Burger 7 %, Spezi und Karten 19 %. Das sind nur Vorschläge. Bitte prüfe selbst, was für euren Stand gilt (z. B. Verein, Kleinunternehmer, Verzehr vor Ort oder zum Mitnehmen).

---

## 5. Zahlen speichern und Abschluss

Verwaltung → **„Zahlen speichern (Datei)“**. Es entsteht eine CSV-Datei (öffnet sich in Excel, Numbers, Google Tabellen).
- **iPad:** Das Teilen-Menü öffnet sich → **„In Dateien sichern“** oder per AirDrop/Mail senden.
- **Android:** Die Datei wird heruntergeladen (Ordner „Downloads“).

Inhalt: Anzahl und Umsatz je Produkt, Summen je Stand, Gesamtsumme, Zahlarten (Bar/PayPal), MwSt. (wenn eingeschaltet) und die Liste aller Buchungen.

**Empfehlung:** Speichere die Zahlen **am Ende jedes Markttags** und schicke dir die Datei selbst zu. Die Zählungen jedes Tablets stehen nur dort, einen Gesamtstand über alle Tablets gibt es nicht. Die Dateien der drei Stände rechnest du von Hand zusammen.

---

## 5e. Spende ohne Einkauf

Unter dem Bon steht die Taste **„Spende buchen“**. Du wählst **Bar** oder **PayPal**, tippst den Betrag (Schnelltasten 1, 2, 5, 10, 20, 50 € oder Ziffernblock) und buchst. Bei PayPal erscheint der QR-Code mit dem Betrag (wie bei Bestellungen, Einstellung „Inhalt des QR-Codes“); verbuche erst, wenn die Spende angekommen ist.
- Die Spende ist **keine Einnahme aus Verkauf**: Sie steht getrennt bei den **Spenden** (Verwaltung, Bon, CSV, Kassenbericht). Bar erhöht sie den Kassenstand, PayPal nicht.
- Sie bekommt einen **Bon** (mit QR-Code/PDF wie gewohnt) und **keine Bestellnummer** und erscheint nicht in der Küche.
- Ein Fehler lässt sich in der Verwaltung mit **Stornieren** zurücknehmen.

## 5f. Bestellnummern und Küchenanzeige

**Bestellnummern:** Jede Bestellung bekommt nach dem Verbuchen eine Nummer **je Sparte**, zum Beispiel **C1, C2 …** (Crêpes), **B1, B2 …** (Burger & Spezi), **K1 …** (Karten). Sie erscheint groß unter dem Bon-Hinweis, auf dem Bon, auf dem Online-Bon und in der Buchungsliste. Die Zählung **beginnt jeden Tag neu**. Das Kürzel änderst du im Bearbeitungsmodus mit der Taste **„Kürzel“**; „Bestellnummern zurücksetzen“ gibt es in der Verwaltung unter „Bestellungen und Küchenanzeige“. Eine reine Pfand-Rückgabe oder eine Spende bekommt keine Nummer.

**Nummer von Hand (Märkchen):** Verwaltung → „Bestellungen und Küchenanzeige“ → **Bestellnummer: „Von Hand (Märkchen)“**. Dann fragt die Kasse nach „Verbuchen“ nach der **Nummer des Märkchens**: Nummer eintippen (bis 4 Ziffern), „Verbuchen“. Die **Nummer 0 ist gesperrt**. Eine Nummer, die noch offen oder abholbereit ist, ist ebenfalls gesperrt; sobald die Bestellung als „abgeholt“ gilt, ist sie wieder frei. Spenden brauchen keine Nummer. Die Einstellung gilt je Gerät; der Standard ist „Von Hand“; „Automatisch“ vergibt C1, B1 ….

**Bestellprozess je Sparte abschalten:** Verwaltung → „Bestellungen und Küchenanzeige“ → unter „Bestellnummer“ steht für jede Sparte ein Schalter. **Aus** heißt: keine Bestellnummer, kein Bestellstatus und kein Eintrag in der Küche, auch keine Nummernabfrage beim Verbuchen. Das ist für Sparten gedacht, bei denen das nicht nötig ist (zum Beispiel Karten oder Getränke).

**Küchenanzeige:** Oben rechts steht die Taste **„Bestellstatus“** mit der Zahl der offenen Bestellungen.
- **Bestellstatus** öffnet die Anzeige über der Kasse (Schließen mit „Schließen“). So wechselst du auf einem Tablet zwischen Kasse und Küche.
- **Zweiter Monitor** zeigt die Anzeige nur zum Ansehen (ohne Knöpfe, `display.html?view=1`). Läuft die Kasse in **Safari**, öffnet sich ein zweites Fenster, das du auf den Monitor schiebst. Läuft sie als **App vom Home-Bildschirm**, kann kein zweites Fenster geöffnet werden: Die Kasse zeigt einen Link zum Kopieren für Safari (Abschnitt „Zweiter Monitor“ unten). `#crepes`, `#burger` oder `#karten` am Ende des Links zeigen nur eine Sparte.
- Die Küche zeigt beim Öffnen **alle Sparten** dieses Tablets (ist das Tablet auf einen Stand festgelegt, nur diesen). Mit den Tasten oben (**Alle**, Sparte) wechselst du den Filter.
- Auf der Küchenanzeige stehen **Nummer, Sparte, Wartezeit** (orange ab 5, rot ab 10 Minuten) und die **Artikel mit Sorte** (zum Beispiel „Fleisch“). Mit den Tasten oben filterst du nach Sparte.
- **Fertig** schiebt die Bestellung in die Liste „Fertig · zur Abholung“. Die Kasse spielt dann einen Ton. Das geht auch direkt in der Kasse im Reiter **„Bestellungen“** (Abschnitt unten). Antippen der Nummer dort heißt „abgeholt“. **Rückgängig** nimmt den letzten Schritt zurück.
- Storniert die Kasse einen Bon, verschwindet die Bestellung aus der Anzeige.
- Der Austausch läuft **nur auf demselben Gerät** (kein Server, keine Verbindung zu anderen Tablets). Auf dem iPad gilt: Eine **zum Home-Bildschirm hinzugefügte App** und ein Safari-Fenster haben getrennte Speicher. Nutze dort „Küche“ (Anzeige über der Kasse, Monitor spiegeln) oder öffne beide Fenster in Safari. Dazu braucht es **kein Internet**, sobald die Kasse einmal geladen wurde.
- Aus: Verwaltung → „Küchenanzeige“ ausschalten (Bestellnummern gibt es weiter).

Im **Weihnachtsdesign** steht unten ein Schneehaufen mit einem kleinen Weihnachtsmarkt (hell und dunkel). Im Dunkelmodus ist der Hintergrund jetzt schwarz statt grün.

## 5h. Design

Verwaltung → **„Design“**. Alles wirkt sofort, auch auf der Küchenanzeige.
- **Thema:** **Logo-Lila** (Standard, Knöpfe in Lila, Kacheln in Lila, Grau, Flieder und Dunkelgrau), **Weihnachten 🎄** (ein Spaß für den Markt: Lichterkette oben, Weihnachtsmütze auf dem Logo, Creme-Hintergrund bzw. dunkles Tannengrün, Kacheln in Rot, Grün, Gold und Tannengrün, Schneefall) oder **Klassisch (Blau)** wie in den ersten Versionen.
- **Darstellung:** Automatisch (wie das Tablet), **Immer hell** oder **Immer dunkel**. Draußen in der Sonne ist „Immer hell“ oft besser lesbar.
- **Farbe der Knöpfe:** „Automatisch“ (Farbe des Themas), fünf Farben oder **eine eigene Farbe** über das Farbfeld. Die Schrift auf den Knöpfen wird automatisch schwarz oder weiß, und Textknöpfe werden bei Bedarf abgedunkelt oder aufgehellt, damit sie lesbar bleiben.
- **Logo im Hintergrund:** Aus, Dezent oder Deutlich. Es liegt hinter den Kacheln und ist nur in den freien Flächen zu sehen.
- **Schneefall:** nur im Weihnachtsdesign, ein-/ausschaltbar. Er blockiert keine Berührung. Bei der Tablet-Einstellung „Bewegung reduzieren“ gibt es keinen Schnee.
- **Design zurücksetzen** stellt alles wieder auf Logo-Lila, Automatisch und Logo dezent.
- Das Design gilt **für dieses Tablet**; es steht auch in der Sicherung.

### Bestellungen auf dem iPad bearbeiten (v27)

In der rechten Spalte der Kasse gibt es oben **„Bon | Bestellungen“**. Unter „Bestellungen“ stehen die offenen Bestellungen mit **Fertig**; fertige Bestellungen tippst du an, wenn sie abgeholt sind; „Rückgängig“ macht den letzten Schritt zurück. So braucht der zweite Monitor keinen Touch.

### Zweiter Monitor

Taste „Bestellstatus“ → **„Zweiter Monitor“**. Die Anzeige im Monitor (`display.html?view=1`) ist nur zum Ansehen, ohne Knöpfe. Als App vom Home-Bildschirm öffnet sie sich nicht als zweites Fenster (das würde die Kasse ersetzen): Die App zeigt dann einen Link zum Kopieren, den du in Safari öffnest. Safari und die App vom Home-Bildschirm haben **getrennte Daten**, deshalb Kasse und Anzeige im selben Programm öffnen (beide in Safari), oder den Monitor einfach **spiegeln**. Die normale Küchenanzeige hat oben „← Zur Kasse“.

## 5g. Töne

Verwaltung → **„Töne“**: alle Töne ein/aus, Lautstärke (leise, mittel, laut). Es gibt zwei Ereignisse, jedes mit **eigenem Schalter und eigenem Klang** aus der Klangbibliothek:
- **Verbucht:** wenn ein Einkauf oder eine Spende verbucht ist. Ab Werk **an**, Klang „Schiffshorn“.
- **Abholbereit:** wenn eine Bestellung als „Fertig“ gemeldet wird. Ab Werk **aus**, Klang „Heller Dreiklang“.

**Klangbibliothek (12 Klänge):** Schiffshorn, Nebelhorn (tief, lang), Kassenklingel, Glocke, Gong (tief), Türgong (Ding-Dong), Dreiklang, Heller Dreiklang, Xylophon, Fanfare, Schlittenglöckchen, Kurzer Doppelton. Beim Auswählen hörst du den Klang sofort. Die Klänge werden im Browser erzeugt, es sind keine Dateien nötig; eigene Klangdateien sind nicht vorgesehen.

**Stummer Seitenschalter und Musik (Spotify):** Unter „Bei stummem iPad / Musik“ wählst du, wie die Kasse mit der Tonausgabe umgeht:
- **Kurz über stumm (Standard):** Der Ton läuft nur für einen Moment als Medium und ist so auch bei stummem iPad zu hören. Es läuft **kein Dauerton**. Andere Musik, zum Beispiel Spotify, kann dabei kurz unterbrochen werden; ob sie danach von selbst weiterläuft, hängt von der App ab.
- **Normal (mit Musik):** Die Töne mischen sich mit der Musik, Spotify läuft ungestört weiter. Bei stummem iPad ist die Kasse aber still.
- **Dauerhaft bereit:** wie bisher, ein stilles Audio läuft ständig. Immer hörbar bei stumm, aber **blockiert andere Musik**.
Das Verhalten ließ sich nur im Test-Browser prüfen, nicht auf einem echten iPad. Probiere am iPad aus, welche Einstellung mit deiner Musik funktioniert.

Mit „Verbucht testen“ und „Abholbereit testen“ hörst du den gewählten Klang an (auch wenn der Ton ausgeschaltet ist). Sonst ist die Kasse still. Die Töne sollen auch bei stummgeschaltetem iPad (Seitenschalter) zu hören sein; das ließ sich nur im Test-Browser prüfen, nicht auf einem echten iPad. Falls es nicht klappt: einmal die Kasse antippen (der Ton wird erst nach einer Berührung freigeschaltet) und bitte melden.

## 5i. Ausgaben und Ergebnis (Kostenrechnung)

Verwaltung → Karte **„Ausgaben und Ergebnis“**. Dort stehen Einnahmen (ohne Spenden, ohne Storno), die erfassten Ausgaben und das **Ergebnis** (Gewinn oder Verlust). Sind Spenden dabei, steht daneben das Ergebnis mit Spenden.
- **Kosten je Produkt:** Die Karte rechnet die Ausgaben auf die Zahl der verkauften Produkte um (ohne Pfand und ohne Stornos; Gratis-Produkte zählen mit) und zeigt auch Einnahmen und Gewinn je Produkt. Je Sparte steht die Zahl der Produkte und die Kosten je Produkt, soweit die Ausgaben der Sparte zugeordnet sind (allgemeine Ausgaben werden nicht aufgeteilt).
- **Ausgabe erfassen …:** Betrag, Bezeichnung (zum Beispiel „Einkauf Metro“) und die Sparte, der die Ausgabe gehört (oder „Allgemein“). Sind Ausgaben Sparten zugeordnet, zeigt die Karte je Sparte Einnahmen − Ausgaben.
- **Aus der Kasse bezahlt:** Der Schalter bucht zusätzlich eine Entnahme, damit der Kassenstand stimmt.
- **Stornieren / Aufheben:** Eine Ausgabe lässt sich stornieren (und wieder aufheben); die Entnahme folgt automatisch.
- Ausgaben stehen auch in der **CSV-Datei**, im **Kassenbericht** und in der **Sicherung**.

## 5j. Gratis, Rabatt und Mengenrabatt

**Ein Produkt gratis verbuchen:** Auf dem Bon (rechte Spalte) den **Namen des Artikels antippen** → Art **„Gratis“** → „Übernehmen“. Der Artikel kostet dann 0 €, bleibt aber eine Buchung mit Artikel und Bestellnummer. Alternativ legst du in der Bearbeitung ein eigenes Produkt mit dem **Preis 0** an („0 = Gratis“); die Kachel zeigt dann „Gratis“.

**Rabatt auf einen Artikel am Bon:** Namen antippen → **Prozent** (zum Beispiel 10), **Betrag je Zeile** (zum Beispiel 0,50 €) oder **Gratis**. Der Rabatt steht als eigene Zeile mit Minusbetrag auf dem Bon, in der Buchung, im Bon-PDF und in den Auswertungen; die MwSt. wird mitgerechnet. „Kein Rabatt“ nimmt ihn zurück. Der Rabatt gilt nur für den aktuellen Bon, „Bon leeren“ und Verbuchen löschen ihn.

**Mengenrabatt am Produkt:** In der Bearbeitung beim Produkt **„Mengenrabatt ab (Stück)“** und **„Stückpreis ab dieser Menge“** eintragen, zum Beispiel ab 3 Stück 2,50 € statt 3,00 €. Die Kachel zeigt „ab 3 Stück 2,50 €“. Ab dieser Menge rechnet die Kasse alle Stücke dieses Artikels zum Mengenpreis und zeigt die Ersparnis als Zeile „Mengenrabatt“. Mengenrabatt und Rabatt am Bon lassen sich kombinieren (erst Menge, dann Rabatt). Der Stückpreis muss unter dem normalen Preis liegen. Pfand wird nie rabattiert.

Rabattzeilen zählen nicht als Produkt (kein Zähler, nicht in der Bestellung/Küche).

## 5d. Kassensturz und Kassenbericht

Verwaltung → Block **„Kassenstand (Bargeld)“**. Dort steht, was rechnerisch in der Kasse sein müsste: Anfangsbestand + Barverkäufe + Spenden + Einlagen − Entnahmen. PayPal ist nicht enthalten.

- **Einlage / Entnahme …:** Wenn du Wechselgeld nachlegst oder Geld aus der Kasse nimmst (zur Bank, in den Tresor), buchst du das hier mit Betrag und Bemerkung. Sonst stimmt der Kassenstand nicht mehr. Ein Fehler lässt sich mit „Stornieren“ zurücknehmen.
- **Kassensturz …:** Du zählst das Bargeld und trägst die **Stückzahlen** je Schein und Münze ein (mit „+“ und „−“ oder direkt). Die App rechnet die Summe aus und zeigt sofort die **Differenz zum Soll**: „Kasse stimmt“, „Überschuss“ oder „Fehlbetrag“ (rot). Mit „Kassensturz speichern“ wird die Zählung samt Uhrzeit und Bemerkung (zum Beispiel „Mittag“) im **Kassensturz-Protokoll** gespeichert. Ein Kassensturz lässt sich nicht löschen.
- **Kassenbericht (PDF) / Kassenbericht drucken:** Der Bericht (DIN A4) enthält Anfangsbestand, Einnahmen, Spenden, Einlagen und Entnahmen, den Soll-Bestand, das Zählprotokoll mit Differenz, die Umsätze je Stand, die Aufteilung Bar/PayPal, die Mehrwertsteuer (wenn der Rechner an ist), Stornos, Pfand-Auszahlungen sowie Zeilen für **Unterschrift und Prüfung**. Direkt nach dem Speichern eines Kassensturzes gibt es die Tasten im Fenster. Später steht in der Liste bei jedem Kassensturz eine Taste „Bericht“.
- Das Protokoll, Einlagen und Entnahmen stehen auch in der **CSV-Datei** und in der **Sicherung**.
- **Empfehlung:** Je ein Kassensturz mittags und am Ende jedes Tages. Den Bericht ausdrucken und unterschreiben oder als PDF zu den Unterlagen legen.

## 5c. Tablet auf einen Stand festlegen

Verwaltung → **„Stand dieses Geräts“** → „Nur Crêpes“ / „Nur Burger & Spezi“ / „Nur Karten“. Dann verschwinden die Reiter oben, und am Stand kann nicht aus Versehen eine andere Seite geöffnet werden. Auch ein Link mit `#burger` oder ein Neustart ändert daran nichts. Die Verwaltung und der Bearbeitungsmodus bleiben über den Titel erreichbar. Zurück: „Alle Seiten (Reiter sichtbar)“.

## 5b. Bon für den Kunden: QR-Code und E-Mail

**Wenn eingeschaltet** (Verwaltung → „Bons (PDF & Druck)“ → Schalter **„QR-Code / E-Mail nach dem Verbuchen“**), öffnet sich nach jedem Verbuchen sofort ein Fenster:
- **QR-Code:** Der Kunde scannt ihn mit der Handy-Kamera und sieht seinen Bon online (Seite `bon.html`). Dort kann er ihn als PDF speichern oder drucken. Der Bon steckt komprimiert im Link, **auf unserem Server liegt nichts**. Das Handy des Kunden braucht Internet, das Tablet nicht, um den Code anzuzeigen.
- **E-Mail:** Du tippst die Adresse des Kunden ein und tippst „E-Mail vorbereiten“. Das **Mail-Programm des Tablets** öffnet sich mit fertigem Entwurf (Adresse, Betreff, Bon-Text, Link). Du tippst dort auf „Senden“. Dafür muss im Mail-Programm des Tablets das Postfach der Gemeinde eingerichtet sein. Die App verschickt nichts selbst. Die Adresse des Kunden wird **nicht gespeichert**.
- **„Fertig – nächster Kunde“** schließt das Fenster. Daneben stehen „PDF“ und „Drucken“.

**Wenn ausgeschaltet:** Der Bon wird trotzdem erzeugt wie bisher. Unten erscheint nach dem Verbuchen kurz die Leiste mit **„QR / Mail“, „PDF“ und „Drucken“**, und in der Verwaltung hat jede Buchung dieselben drei Tasten. So öffnest du den Bon nur bei Bedarf.

Hinweis: Der Online-Bon zeigt den Stand beim Verbuchen. Wird die Buchung später storniert, ändert sich der schon verschickte Bon nicht.

## 5a. Datensicherung (Datei zum Wiederherstellen)

Verwaltung → **„Datensicherung“**:
- **Sicherung speichern (Datei):** erzeugt eine `.json`-Datei mit allen Buchungen, dem Sortiment und den Einstellungen (ohne Passwort). Auf dem iPad kommt das Teilen-Menü (In Dateien sichern, AirDrop, Mail), auf Android wird die Datei heruntergeladen.
- **Sicherung wiederherstellen …:** liest so eine Datei wieder ein, zum Beispiel auf einem Ersatztablet. Die aktuellen Daten des Geräts werden dabei ersetzt, das Passwort bleibt.
- Die App zeigt, wann die letzte Sicherung war und wie viele Buchungen seitdem dazugekommen sind.
- **Empfehlung:** Sicherung mittags, abends und am Ende jedes Markttags, und die Datei an dich selbst schicken.

## 6. Checkliste

**Vor dem Markt (zu Hause, mit Internet):**
- [ ] App auf jedem Tablet über den Home-Bildschirm installiert und gestartet
- [ ] Passwort festgelegt und notiert (nicht auf dem Tablet!)
- [ ] Preise und Produkte stimmen (Bearbeitungsmodus)
- [ ] PayPal-Link hinterlegt; **Test-Bon mit PayPal**: QR-Code mit dem Handy scannen und prüfen, dass Betrag und Empfänger stimmen
- [ ] MwSt.-Rechner nach Bedarf ein- oder ausgeschaltet; Steuersätze geprüft
- [ ] Testbuchungen entfernt: Verwaltung → „Alle Buchungen auf diesem Gerät löschen“
- [ ] Tablets geladen, Ladekabel oder Powerbank dabei, automatische Sperre auf „nie“ oder mindestens 5 Minuten
- [ ] **Küchenanzeige** am Crêpes- und am Burger-Tablet einmal ausprobiert (Bestellung buchen, „Fertig“ drücken); Töne laut genug eingestellt, auch bei stummem Seitenschalter; zweites Fenster in Safari einmal ohne Internet getestet
- [ ] **Geführter Zugriff** (iPad: Einstellungen → Bedienungshilfen) oder Bildschirmfixierung (Android) eingeschaltet
- [ ] App einmal mit Internet gestartet und danach im **Flugmodus** getestet: Sie muss starten und einen Bon verbuchen können
- [ ] Ersatztablet mit installierter App bereit; Sicherungsdatei zum Einspielen
- [ ] Letzte Freigabe liegt mindestens einen Tag zurück (Änderungsstopp), siehe `docs/ENTWICKLUNG.md`

**Während des Markts:**
- Bei Zweifeln zählt die Buchungsliste in der Verwaltung.
- Falsch gebuchter Bon: in der Verwaltung stornieren und neu buchen.
- PayPal: immer erst die Zahlung in der PayPal-App abwarten, dann verbuchen.

**Nach dem Markt:**
- [ ] Zahlen speichern und die Datei an dich senden
- [ ] **Kassensturz** durchführen und **Kassenbericht** speichern oder ausdrucken (Abschnitt 5d)
- [ ] PayPal-Eingänge mit der PayPal-Summe vergleichen

---

## 6a. PayPal: Wenn der QR-Code nur die PayPal-Startseite öffnet

1. **Nicht mit dem eigenen Konto scannen.** PayPal kann sich nicht selbst bezahlen. Teste mit dem Handy einer anderen Person, die mit einem anderen PayPal-Konto angemeldet ist.
2. Verwaltung → PayPal → **„Inhalt des QR-Codes“** ausprobieren und jeweils mit „Link zum Testen öffnen“ prüfen:
   - **paypal.me mit Betrag** (Standard): `paypal.me/Name/7.50`, so ist es bei PayPal dokumentiert.
   - **paypal.me mit Betrag und „EUR“:** `paypal.me/Name/7.50EUR`.
   - **Link ohne Betrag:** Der QR-Code enthält nur `paypal.me/Name`. Die Käuferin oder der Käufer tippt den Betrag, der groß unter dem Code steht, selbst ein.
3. Prüfe, ob der Link im **Browser** (ohne PayPal-App, abgemeldet) die PayPal.Me-Seite mit deinem Namen zeigt. Wenn nicht, stimmt der Link selbst nicht: PayPal-App → Profil → PayPal.Me.
4. Als Notlösung kannst du den Link auch als Text vorlesen: `paypal.me/DeinName`.

## 7. Worauf du achten solltest

- **Daten bleiben nur im Tablet.** Browserdaten oder Website-Daten löschen, die App vom Home-Bildschirm entfernen und neu anlegen oder das Tablet zurücksetzen löscht **alle Buchungen**. Speichere vorher die Zahlen.
- **Immer die App vom Home-Bildschirm benutzen**, nicht den Browser oder ein privates Fenster. Dort ist der Speicher getrennt, und die Zähler würden „fehlen“.
- **Passwort vergessen:** Auf dem Passwort-Fenster gibt es „Passwort vergessen?“. Dort gibst du den Wiederherstellungscode ein und vergibst ein neues Passwort, ohne Daten zu verlieren. Ohne Code bleibt nur, die Daten des Tablets zu löschen, und dabei gehen die Buchungen verloren.
- **Das Passwort ist ein Schutz gegen versehentliche Bedienung**, kein Schutz gegen jemanden, der sich technisch auskennt.
- **Jedes Tablet zählt für sich.** Dieselben Produkte auf zwei Tablets bedeuten zwei getrennte Zählungen.
- **Updates:** Neue Versionen werden beim Start der App mit Internet geladen. Steht die Versionsnummer oben rechts noch auf einer alten Nummer, schließe die App komplett (aus der App-Übersicht wegwischen) und öffne sie nach ein bis zwei Minuten erneut. Aktualisiere nicht mitten im Verkauf.
- **Schnelles Tippen:** Der Verkauf zählt schon beim Berühren der Kachel. Doppeltipps zählen doppelt. Bei Fehltipp „−“ benutzen.
- **PayPal:** Die App kann nicht prüfen, ob bezahlt wurde. Verbuche erst nach Eingang. Rückzahlungen musst du selbst in PayPal ausführen.
- **iPad-Tipp:** Mit der Funktion **„Geführter Zugriff“** (Einstellungen → Bedienungshilfen) bleibt das iPad in der Kassen-App, und die Kunden kommen nicht an andere Apps.

---

## 8. Kurzübersicht: Wo finde ich was?

| Ich möchte … | Dann … |
|---|---|
| etwas verkaufen | Kachel antippen → Bezahlen → Verbuchen |
| Wechselgeld berechnen | Bezahlen → Bar → Betrag eingeben |
| mit PayPal kassieren | Bezahlen → PayPal → QR-Code scannen lassen → „Zahlung erhalten“ |
| einen Fehltipp korrigieren | „−“ an Kachel oder Bon, oder „Bon leeren“ |
| eine gebuchte Bestellung rückgängig machen | Verwaltung → Buchungen → Stornieren |
| die Einnahmen sehen | Verwaltung → Zwischenstand |
| Produkte, Preise, Kategorien ändern | Verwaltung → Bearbeitungsmodus |
| MwSt. ein-/ausschalten | Verwaltung → Schalter „Mehrwertsteuer-Rechner“ |
| den PayPal-Link ändern | Verwaltung → PayPal-Link festlegen |
| Zahlen sichern | Verwaltung → Zahlen speichern (Datei) |
| zurück auf null | Verwaltung → Alle Buchungen auf diesem Gerät löschen |

**Verwaltung öffnen:** Titel oben links **5-mal schnell antippen** oder **1,5 Sekunden gedrückt halten**.
