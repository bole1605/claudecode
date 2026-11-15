# Prompt für die tägliche Daten-Aktualisierung

Diesen Text in eine geplante Claude-Routine einfügen, die **den Garmin-Connector** und **Schreibzugriff auf das private Repo `bole1605/garmin-daten`** hat (Zeitplan z. B. täglich 07:37 und 19:37, Europe/Berlin).
Er enthält keine persönlichen Daten.

```
Aufgabe: Halte die Datei garmin-data.json im PRIVATEN GitHub-Repo bole1605/garmin-daten (Branch main) aktuell. Die Datei speist ein persönliches Garmin-Dashboard (PWA), das sie regelmäßig abruft. Arbeite selbständig, ohne Rückfragen, und gib am Ende nur eine kurze Statuszeile aus (z. B. "OK: 2 neue Aktivitäten, Daten bis 2026-11-16" oder "Fehler: ..."). Schreibe KEINE Gesundheitsdaten in Chat-Ausgaben, Commit-Nachrichten, Issues oder irgendein anderes Repository.

SCHRITTE
1. Repo anhängen und klonen: add_repo(owner "bole1605", repo "garmin-daten", access "push"), danach genau EIN Klon: git clone --depth 1 https://github.com/bole1605/garmin-daten /home/user/garmin-daten (großzügiges Timeout). Existiert das Verzeichnis schon und git rev-parse HEAD klappt, benutze es (git pull --ff-only).
2. Lies /home/user/garmin-daten/garmin-data.json. Schema (Version 1, kompakte Zeilen):
   - "profile": {name, hrMax, lthr, zones:[Z1..Z5-Untergrenzen], stepGoal} – unverändert lassen, außer hrMax/zones/stepGoal haben sich in Garmin geändert (get_heart_rate_zones, get_userprofile_settings).
   - "today": {date, steps, stress, bb, bbWake, bbHigh, bbLow, rhr, rhr7, readiness:{score, level, feedback, recoveryH, hrvWeekly, factors:{sleep, recovery, load, hrv, stress, sleepHistory}}}
   - "predictions": {"5k","10k","hm","m"} in Sekunden.
   - "actCols": ["t","type","name","dist","dur","hr","hrMax","kcal","elev"] und "activities": Zeilen [Startzeit "YYYY-MM-DDTHH:MM:SS" (lokal), type (Garmin-Typ z. B. running, mountain_biking, gravel_cycling, cycling, walking, strength_training), name, Distanz in METERN, Dauer in SEKUNDEN, avg_hr, max_hr, kcal, Höhenmeter aufwärts]. Neueste zuerst.
   - "dailyCols": ["d","steps","act","sleep","score","deep","light","rem","awake","rhr","hrv","atl","ctl","acwr","vo2"] und "daily": Zeilen pro Tag, älteste zuerst: Datum, Schritte, aktive Kalorien, Schlafdauer in Stunden (sleep_hours), Schlafscore, Tief/Leicht/REM/Wach in MINUTEN (Sekunden/60, gerundet), Ruhepuls (resting_heart_rate_bpm aus der Schlafzusammenfassung), HRV (avg_overnight_hrv), Akutlast atl, chronische Last ctl, acwr, VO2max.
3. Bestimme das letzte Datum in "daily" (L) und heute (Europe/Berlin, T). Hole mit dem GARMIN-Connector (Tools mcp__GARMIN__*, ggf. zuerst per ToolSearch laden) alles von (L-2) bis T neu (überlappende Tage ersetzen):
   - get_activities_by_date(start (L-2), end T) → Aktivitäten (Duplikate über Startzeit vermeiden).
   - get_stats_range in Blöcken von höchstens 28 Tagen → steps, active_calories.
   - get_sleep_summary_range → sleep_hours, sleep_score, deep/light/rem/awake_sleep_seconds, resting_heart_rate_bpm, avg_overnight_hrv (Datum = Aufwachtag).
   - get_training_load_trend → atl, ctl, acwr.  get_vo2max_trend → vo2_max.
   - Für heute: get_user_summary(T) → totalSteps, averageStressLevel, bodyBatteryMostRecentValue (bb), bodyBatteryAtWakeTime, bodyBatteryHighestValue, bodyBatteryLowestValue, restingHeartRate, lastSevenDaysAvgRestingHeartRate; get_training_readiness(T) → score, level, feedback, recovery_time_hours, hrv_weekly_avg und die *_factor_percent-Werte; get_race_predictions → Sekunden.
   Fehlende Werte als null, nie erfinden. Tage ohne Daten weglassen.
4. Füge zusammen: daily nach Datum sortiert (nur die letzten 150 Tage behalten), activities neueste zuerst (letzte 150 Tage behalten). Setze "today.date" = T und "generated" = aktuelle Berliner Zeit als "YYYY-MM-DDTHH:MM:SS" (muss lexikografisch NEUER sein als der bisherige Wert, sonst ignoriert die App die Datei). "source" und "version" beibehalten. Schreibe gültiges JSON mit der kompakten Zeilenform (je eine Zeile pro Aktivität/Tag) und prüfe es mit python3 -c "import json;json.load(open('garmin-data.json'))".
5. Gibt es keine neueren Daten als bisher, committe nichts.
6. Committe mit der Nachricht "Garmin-Daten aktualisiert (T)" (ohne Gesundheitswerte) und pushe nach main: git -C /home/user/garmin-daten -c push.negotiate=true push origin main. Falls der Push auf main verweigert wird, melde das als Fehler (nicht auf einen anderen Branch ausweichen).
Wenn der GARMIN-Connector nicht erreichbar ist (keine mcp__GARMIN__-Tools auffindbar), brich ohne Änderung ab und melde "Fehler: GARMIN-Connector nicht verfügbar".
```
