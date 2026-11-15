# Fokus – Zeitlimits für Instagram & TikTok (iPhone)

Native SwiftUI-App (iOS 17+), die **ohne Konto-Zugriff und ohne Internet** arbeitet. Sie nutzt ausschließlich Apples
Bildschirmzeit-APIs (FamilyControls, DeviceActivity, ManagedSettings). Alle Daten liegen lokal in einer App Group.

## Funktionen
| Bereich | Umfang |
|---|---|
| Tageslimit pro App | getrennt für Mo–Fr / Sa–So, 5–240 Min, Warnung bei 50/80/90 % |
| Schlafenszeit | App nachts pausieren (frei wählbarer Zeitraum) |
| Bewusster Start | Pause vor jedem Öffnen, danach 3–15 Min Nutzung; bei Instagram mit Hinweis auf „Folge ich“ |
| Zusatzzeit | 0–3× pro Tag 5/10/15 Min nach Limit |
| Strenger Modus | keine Zusatzzeit, Limit-Erhöhungen und Beenden erst ab morgen, Einstellungen gesperrt |
| Eigener Sperrbildschirm | Shield-Extension, passend zum Grund (Limit, Nacht, Bewusster Start) |
| Nutzungsanzeige | „Heute: 23 Min“ über eine Report-Extension (bleibt in der iOS-Sandbox) |
| Instagram-Feed | Anleitung zu Instagrams eigener Ansicht „Folge ich“ |
| **Browser (neu)** | Instagram & YouTube im eingebauten Browser: Reels, Entdecken und Shorts werden ausgeblendet, Links dorthin blockiert, Start in „Folge ich“, eigenes Tageslimit |

## Browser-Modus (Reels/Shorts ausblenden)
Die Instagram-/YouTube-App selbst lässt sich auf iOS nicht verändern. Der Browser-Tab öffnet deshalb die **Webseiten** (instagram.com,
m.youtube.com) in einer `WKWebView` und schleust beim Laden CSS/JavaScript ein (`App/Views/FeedSites.swift`): Elemente ausblenden (`display:none`),
Klicks und Verlaufswechsel auf `/reels`, `/explore`, `/shorts` abfangen, Shorts als normales Video öffnen.
Die Anmeldung erfolgt direkt auf der Seite; Fokus liest keine Inhalte aus und sendet nichts. Wichtig:
- Der Ansatz ist eine **Schlussfolgerung** aus offenen Projekten; die Funktionsweise von SociaLite selbst konnte nicht eingesehen werden.
- Instagram/YouTube ändern ihr Layout oft – die Selektoren müssen gelegentlich nachgezogen werden. `/?variant=following` (Folge-ich-Feed) bitte auf dem Gerät prüfen.
- Snapchat Spotlight ist **nicht** umgesetzt.
- Die Zeit im Browser zählt **nicht** zu den Screen-Time-Limits der Instagram-App; dafür gibt es ein eigenes Browser-Tageslimit. Wer die Original-App behält, kann Reels dort weiter öffnen – am besten löschen und nur den Browser nutzen.
- Risiko im App Review (Guideline 4.2 „Mindestfunktionalität“ / 5.2) und in den Nutzungsbedingungen von Instagram/YouTube; vor Veröffentlichung prüfen.

## Wichtig: Instagram „nur Gefolgte“
iOS erlaubt es keiner App, den Inhalt einer anderen App zu filtern, und Instagram bietet dafür keine Schnittstelle ohne
Konto-Login. **Das lässt sich ohne Zugriff auf das Konto technisch nicht umsetzen.** Fokus geht deshalb zwei Wege:
1. Anleitung zur eingebauten Ansicht **„Folge ich“** (Logo oben links antippen).
2. Der **Bewusste Start** zeigt bei jedem Öffnen eine Pause samt diesem Tipp, und ein Reels-/Entdecken-Sog wird über das Zeitlimit begrenzt.

Ebenso lassen sich einzelne Bereiche (nur Reels) nicht sperren – nur die ganze App.

## Einrichten
1. `brew install xcodegen`
2. In `project.yml` `DEVELOPMENT_TEAM` und `BUNDLE_PREFIX` setzen (z. B. `de.deinname.fokus`).
3. `xcodegen generate && open Fokus.xcodeproj`
4. Bei **allen 5 Targets** unter *Signing & Capabilities* prüfen: *Family Controls* und *App Groups* (`group.<BUNDLE_PREFIX>`).
5. Auf einem **echten iPhone** starten (der Simulator unterstützt Bildschirmzeit nicht).
6. Für TestFlight/App Store: das **Family Controls (Distribution)**-Entitlement bei Apple beantragen
   (https://developer.apple.com/contact/request/family-controls-distribution) – für Entwicklung nicht nötig, für jede der 5 Bundle-IDs.

## Grenzen (ehrlich)
- Dieser Code wurde **nicht kompiliert oder auf einem Gerät getestet** (entstanden ohne Xcode/macOS). Kleine Compilerkorrekturen und ein Gerätetest sind zu erwarten – v. a.: Verhalten von `.defer` nach „Für X Min öffnen“, und ob Limit-Zähler beim Ändern eines Limits neu starten.
- Wer den Bildschirmzeit-Zugriff widerruft oder die App löscht, hebt die Limits auf. Gegenmittel: ein Bildschirmzeit-Code, den jemand anderes festlegt.
- iOS verlangt für Zeitfenster mindestens 15 Minuten; kürzere Fenster werden auf 15 Min aufgerundet (die Nutzungsminuten bleiben wie gewählt).

## Apple-Richtlinien (umgesetzt)
Native SwiftUI, Tab-Bar, Listen/Formulare, Dynamic Type, Dark Mode, SF Symbols, Haptik, VoiceOver-Gruppierung,
Berechtigung erst nach Erklärung (Onboarding), Privacy Manifest ohne Datensammlung, keine Marken-Logos, keine privaten APIs,
nur öffentliche Schnittstellen, Hinweis „nicht mit Instagram/TikTok verbunden“ (Guideline 5.2).

## Struktur
`Shared/` Logik (in allen Targets) · `App/` UI · `Monitor/` Hintergrund-Limit · `ShieldConfig/` + `ShieldAction/` Sperrbildschirm · `Report/` Nutzungsanzeige
