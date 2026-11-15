# Trainings-App

**Adresse:** https://matthias-724.github.io/training/

Prehab-Trainingsplan als Web-App fürs iPhone. Sie läuft in Safari, wird auf den Home-Bildschirm gelegt und funktioniert danach offline. Alle Trainingsdaten bleiben auf dem iPhone. Es gibt keinen Server, der Daten speichert, und kein Login.

> **Wichtig:** Der Trainingsplan ist ein Vorschlag und nicht ärztlich freigegeben. Vor dem Start mit Arzt oder Physio durchgehen.

## Inhalt

1. [Warum eine Web-App und kein Mac nötig ist](#warum-eine-web-app-und-kein-mac-nötig-ist)
2. [Lokal am Windows-PC starten](#lokal-am-windows-pc-starten)
3. [Veröffentlichen mit GitHub Pages](#veröffentlichen-mit-github-pages)
4. [Alternative: Telekom-Webspace](#alternative-telekom-webspace)
5. [Auf dem iPhone installieren](#auf-dem-iphone-installieren)
6. [Backup](#backup)
7. [Updates veröffentlichen](#updates-veröffentlichen)
8. [Was iOS erlaubt und was nicht](#was-ios-erlaubt-und-was-nicht)
9. [Aufbau des Projekts](#aufbau-des-projekts)

---

## Warum eine Web-App und kein Mac nötig ist

Eine echte iPhone-App bräuchte einen Mac und ein bezahltes Apple-Entwicklerkonto. Eine Web-App (PWA) braucht beides nicht. Sie besteht nur aus HTML, CSS und JavaScript, die Safari ausführt.

Eine HTML-Datei einfach aufs iPhone zu kopieren, reicht aber nicht. Safari öffnet lokale Dateien ohne Offline-Modus und ohne verlässlichen Speicher. Deshalb liegen die Dateien einmal im Internet, mit HTTPS. Das iPhone lädt sie einmal und speichert sie dann. Danach braucht die App kein Netz mehr.

Die Trainingsdaten wandern dabei nie ins Internet. Hochgeladen werden nur die Programmdateien.

## Lokal am Windows-PC starten

Python ist installiert. Im Ordner `Trainings-App` eine Eingabeaufforderung oder PowerShell öffnen:

```bash
python -m http.server 8090
```

Dann im Browser `http://localhost:8090` öffnen. Zum Ansehen in Handygröße in Chrome oder Edge `F12` drücken und die Geräteansicht wählen (Strg+Umschalt+M), z.B. „iPhone 14“.

Tests für die Logik laufen mit Node:

```bash
npm test
```

Hinweis: Vom iPhone über die WLAN-Adresse des PCs (`http://192.168...`) lässt sich die App zwar ansehen, aber nicht installieren. Offline-Betrieb geht nur über HTTPS.

## Veröffentlichen mit GitHub Pages

Kostenlos, mit HTTPS, alles im Browser. Git oder Kommandozeile sind nicht nötig.

**Vorher zur Privatsphäre:** Im kostenlosen Tarif muss das Repository öffentlich sein. Jeder mit dem Link sieht also den Programmcode samt Trainingsplan, aber keine Trainingsdaten. `AUFTRAG.md` enthält persönliche Angaben und gehört deshalb **nicht** mit hoch.

1. **Konto anlegen:** Auf [github.com](https://github.com) registrieren. Der Benutzername steht später in der Adresse der App.
2. **Repository anlegen:** Oben rechts auf **+** und dann **New repository**.
   - Repository name: z.B. `training`
   - **Public** auswählen
   - Auf **Create repository** klicken
3. **Dateien hochladen:** Auf der leeren Repository-Seite auf **uploading an existing file** klicken. Aus dem Ordner `Trainings-App` diese Dateien und Ordner in das Browserfenster ziehen:
   - `index.html`, `sw.js`, `manifest.webmanifest`, `.nojekyll`
   - die Ordner `css`, `js` und `icons`
   - optional `README.md`, `package.json` und `tests`

   Ordner lassen sich in Chrome und Edge direkt hineinziehen. `.nojekyll` ist eine leere, versteckte Datei. Im Windows-Explorer unter **Ansicht** die Option **Ausgeblendete Elemente** einschalten, damit sie sichtbar wird. Danach unten auf **Commit changes** klicken.
4. **Pages einschalten:** Im Repository auf **Settings**, links auf **Pages**. Unter „Build and deployment“:
   - Source: **Deploy from a branch**
   - Branch: **main**, Ordner **/ (root)**
   - Auf **Save** klicken
5. **Warten:** Nach ein bis zwei Minuten erscheint oben auf der Pages-Seite die Adresse, etwa
   `https://BENUTZERNAME.github.io/training/`
   Den Link einmal am PC öffnen und prüfen, dass die App lädt.

## Alternative: Telekom-Webspace

Für `hauprich-engineering.de` geht ein Unterordner oder eine Subdomain. **HTTPS muss aktiv sein**, sonst funktioniert der Offline-Modus nicht. Das im Telekom-Kundencenter prüfen. Die Adresse muss mit `https://` ohne Warnung laden.

**Unterordner** (einfacher):

1. Mit einem FTP-Programm (z.B. FileZilla) und den FTP-Zugangsdaten aus dem Kundencenter verbinden.
2. Einen Ordner `training` anlegen und dieselben Dateien wie oben hineinladen (ohne `AUFTRAG.md`).
3. Adresse: `https://hauprich-engineering.de/training/`

**Subdomain:** Im Kundencenter `training.hauprich-engineering.de` anlegen, auf einen eigenen Ordner zeigen lassen und für die Subdomain SSL aktivieren. Dann die Dateien in diesen Ordner laden.

Falls der Server die Manifest-Datei nicht kennt, im Ordner eine Datei `.htaccess` mit diesem Inhalt anlegen:

```
AddType application/manifest+json .webmanifest
AddType text/javascript .js
```

## Auf dem iPhone installieren

1. Auf dem iPhone **Safari** öffnen und die Adresse der App aufrufen (GitHub Pages oder Telekom).
2. Unten auf das **Teilen**-Symbol tippen (Quadrat mit Pfeil nach oben).
3. Nach unten scrollen und **Zum Home-Bildschirm** wählen.
4. Falls der Schalter **Als Web-App öffnen** erscheint, eingeschaltet lassen. Dann auf **Hinzufügen** tippen.
5. Die App einmal über das neue Symbol öffnen, solange Internet da ist. Dabei speichert sie alle Dateien. Danach läuft sie auch ohne Empfang.

**Wichtig:** Safari und die installierte App haben **getrennte Speicher**. Trainings, die im Safari-Tab eingetragen wurden, sind in der App nicht zu sehen. Deshalb ab jetzt nur noch das Symbol auf dem Home-Bildschirm benutzen.

## Backup

iOS kann Website-Daten löschen, z.B. wenn der Speicher knapp wird. Bei installierten Web-Apps passiert das selten, ausschließen lässt es sich nicht. Deshalb gilt:

- **Sichern:** **Mehr** → **Backup erstellen**. Es öffnet sich das Teilen-Menü. Dort **In Dateien sichern** und dann einen Ordner in iCloud Drive wählen. Am PC wird die Datei normal heruntergeladen.
- **Einspielen:** **Mehr** → **Backup einspielen** → Datei auswählen. Alle Daten in der App werden durch das Backup ersetzt, vorher kommt eine Rückfrage.
- **Erinnerung:** Ist das letzte Backup älter als 14 Tage, erscheint auf **Heute** ein Hinweis mit Knopf zum Sichern.

Die Backup-Datei ist reines JSON und lässt sich auch am PC lesen.

## Updates veröffentlichen

Wenn sich am Code etwas ändert:

1. In `sw.js` die Zeile `const VERSION = '1.0.0';` erhöhen, z.B. auf `'1.0.1'`.
2. In `js/version.js` dieselbe Nummer eintragen.
3. Hochladen. Der Ordner ist bereits mit dem Repository `Matthias-724/training` verbunden, im Ordner `Trainings-App` reicht:

   ```bash
   git add -A
   git commit -m "Kurz beschreiben, was sich geändert hat"
   git push
   ```

   Ohne Git geht es auch im Browser: Auf GitHub die geänderten Dateien erneut hochziehen, gleichnamige werden ersetzt. GitHub Pages veröffentlicht nach ein bis zwei Minuten.
4. Auf dem iPhone die App öffnen, solange Internet da ist. Unten erscheint **Neue Version verfügbar**. Auf **Aktualisieren** tippen.

Ohne neue Versionsnummer behält das iPhone die alten Dateien. Das ist Absicht, damit die App im Gym ohne Netz zuverlässig startet.

Die Trainingsdaten bleiben bei Updates erhalten. Änderungen an den Startdaten (`js/seed.js`) wirken nur bei einer frischen Installation oder über **Mehr** → **Plan auf Startdaten zurücksetzen**. Dabei gehen eigene Planänderungen verloren, der Verlauf bleibt.

## Was iOS erlaubt und was nicht

| Funktion | Auf dem iPhone |
|---|---|
| Offline | ja, nach dem ersten Öffnen über das Symbol |
| Bildschirm bleibt im Training an | ja, mit aktuellem iOS. Auf älteren Versionen in der Home-Bildschirm-App unzuverlässig. Dann unter Einstellungen → Anzeige & Helligkeit → Automatische Sperre die Zeit verlängern. |
| Vibration beim Pausenende | nein, Safari bietet das nicht an |
| Ton beim Pausenende | ja, solange die App offen ist und der Lautlos-Schalter aus ist. Läuft Musik, mischt sich der Ton dazu, statt sie anzuhalten. |
| Benachrichtigung bei gesperrtem Bildschirm | nein. Deshalb hält die App den Bildschirm an und zeigt das Pausenende groß an. |

## Aufbau des Projekts

Reines HTML, CSS und JavaScript ohne Bibliotheken und ohne Build-Schritt. Was im Ordner liegt, ist genau das, was der Browser lädt.

```
index.html             Grundgerüst, iOS-Einstellungen
manifest.webmanifest   Name, Icons, Vollbild
sw.js                  Service Worker: Offline-Cache, Updates
.nojekyll              sagt GitHub Pages, dass es nichts umbauen soll
css/app.css            Gestaltung, Dark Mode, Safe Areas
icons/                 App-Symbole
js/
  app.js               Start, Navigation, Kopfzeile, Kniecheck am Morgen
  logic.js             Fachregeln: Ampel, Steigerung, Wochenplan, Backup-Frist
  format.js            Datum, Uhrzeit, Sätze auf Deutsch
  seed.js              Startdaten: Übungen, Einheiten, Phasen
  store.js             Datenhaltung, Verlauf, Export und Import
  db.js                IndexedDB (Speicher im Browser)
  backup.js            Backup als Datei teilen oder laden
  version.js           App-Version
  ui/                  Dialoge, Timer, Diagramm, Ton, Bildschirmsperre
  views/               Heute, Training, Ausdauer, Verlauf, Plan, Mehr
tests/logic.test.mjs   Tests für Regeln und Startdaten
```

### Regeln an einer Stelle

Alle Trainingsregeln stehen in `js/logic.js` und sind getestet:

- **Knie-Ampel:** Schmerz 0 bis 3 grün, 4 bis 5 gelb, ab 6 oder bei Warnzeichen rot. Rot pausiert die Übung, bis sie im Plan oder im Training freigegeben wird.
- **Kniecheck am Folgetag:** „Schlimmer“ oder „Schwellung“ stuft Grün vom Vortag auf Gelb ab. Optional mit Stroke-Test: 1+ heißt halten, ab 2+ zurücknehmen.
- **Steigerungshinweis:** zweimal hintereinander alle Sätze am unteren Zielwert geschafft und die Ampel grün.
- **Vorbelegung:** Werte vom letzten Mal. Bei Beinübungen kommt das Gewicht nur aus derselben Phase, damit nach einer OP nicht das Gewicht von vorher vorgeschlagen wird.
- **Klausurmodus:** nur Montag, Dienstag und Freitag.

### Daten

Gespeichert wird in IndexedDB im Browser. Jedes Training speichert eine Kopie der Übungsdaten. Spätere Änderungen am Plan verändern den Verlauf deshalb nicht.
