# Kuratierter Katalog
Lege hier `*.json`-Dateien ab (Array oder `{ "bikes": [...] }`). Es dürfen nur **real geprüfte** Modelle eingetragen werden. Jeder Eintrag braucht die Produkt-`url` und `lastVerified` (ISO-Datum der Prüfung auf der Herstellerseite); andere Einträge werden verworfen.

Felder: siehe `shared/bikeSchema.js` (brand, model, year, type, drive, url, price.amount, frameSizes, weightKg, motor, battery, drivetrain, brakes, suspension, features …). Unbekannte Werte weglassen – nie schätzen.
