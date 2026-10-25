# FristPilot

Persönliche Web-App, die Dokumente organisiert und daraus überprüfbare Aufgaben und Fristen ableitet.
Liegt isoliert in `fristpilot/`; die Liegestütz-PWA im Repo-Root ist davon unabhängig.

**Stand: Meilenstein 1 (Grundgerüst).** Login, geschützte Routen, leeres Dashboard, erste Migration mit RLS.
Upload, KI-Analyse, Aufgaben und Erinnerungen folgen in den nächsten Meilensteinen.

## Stack
Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind CSS 4, Supabase (`@supabase/ssr`), Zod, Vitest.

## Einrichtung
1. **Supabase-Projekt** anlegen, Region **EU** wählen (z. B. Frankfurt `eu-central-1`; Region ist nachträglich nicht änderbar).
2. **Registrierung abschalten:** Authentication → Sign In / Providers → „Allow new users to sign up“ ausschalten
   (Bezeichnung ggf. prüfen, sie ändert sich gelegentlich).
3. **Deinen Benutzer anlegen:** Authentication → Users → „Add user“ (E-Mail + Passwort, „Auto Confirm“ an).
   Starkes Passwort verwenden, optional MFA aktivieren.
4. **Migration einspielen:** Inhalt von `supabase/migrations/*.sql` im SQL Editor ausführen (oder Supabase CLI: `supabase db push`).
   Einen vor der Migration angelegten Benutzer ggf. neu anlegen, damit sein Profil erzeugt wird.
5. `cp .env.example .env.local` und ausfüllen (URL und Publishable Key unter Project Settings → API; `ALLOWED_USER_EMAIL` = deine E-Mail).
6. `npm install`, dann `npm run dev` → http://localhost:3000

## Befehle
`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run check` (alles)

## Sicherheitsmodell (Single-User)
Mehrere unabhängige Schichten, keine reine Client-Sperre:
1. Supabase: Registrierung deaktiviert, Benutzer nur manuell angelegt.
2. `proxy.ts`: leitet Nicht-Angemeldete serverseitig zu `/login` (optimistische Vorprüfung).
3. `requireUser()` (Server): prüft per `getUser()` beim Auth-Server und gleicht die E-Mail mit `ALLOWED_USER_EMAIL` ab.
4. Datenbank: Row Level Security auf jeder Tabelle (`user_id = auth.uid()`), dadurch später mehrbenutzerfähig.
5. Der Service-Role-Key kommt nie in den Client und wird erst für den Erinnerungs-Cron gebraucht.

## Konten und Kosten (Stand der Planung, Preise bitte aktuell prüfen)
| Dienst | Zweck | Wann nötig | Kosten |
|---|---|---|---|
| Supabase | DB, Auth, Dateispeicher | jetzt | Free-Tier genügt für den Start (Projekte können bei Inaktivität pausiert werden) |
| Anthropic API | Dokumentenanalyse | ab Meilenstein 3 | nutzungsbasiert, Guthaben nötig |
| Resend | Erinnerungs-E-Mails | ab Meilenstein 5 | Free-Tier; für Versand an beliebige Empfänger ist eine **verifizierte Domain** nötig, ohne Domain nur an die eigene Kontoadresse; lokal wird ein Konsolen-Fallback verwendet |
| Hosting (z. B. Vercel) | Betrieb | optional | Hobby-Tier; Region EU wählen |

## Datenschutz (vor echten Dokumenten klären)
- Dokumentinhalte gehen für die Analyse an die Claude-API (separate Datenübermittlung, Drittland-Verarbeitung möglich).
  Vor Meilenstein 3 prüfen: aktuelle Aufbewahrungsfrist, Training auf API-Daten (laut Anthropic bei Commercial-API standardmäßig nein),
  Zero-Data-Retention (nur nach Freigabe) und die DPA/Standardvertragsklauseln im Anthropic-Konto.
- Nicht analysierte Dateien bleiben im privaten Supabase-Bucket; Löschung entfernt Datei und Datenbankzeilen.
