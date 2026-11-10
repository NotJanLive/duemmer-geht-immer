# Dümmer geht Immer

Eine Quizshow für Freunde. Alle melden sich mit Discord an (nur Mitglieder des Servers). Der Host startet die Show, alle anderen treten auf der Startseite mit einem Klick bei und spielen am eigenen Handy oder Rechner mit. Unten laufen die Kameras aller Spieler (Bild über VDO.Ninja, Ton bleibt im Discord-Call). Der Host stellt in der Lobby zusammen, welche Spiele in welcher Reihenfolge laufen:

1. **Last Man Standing**: Reihum Begriffe zu einem Thema nennen. Wer nichts mehr weiß, scheidet aus.
2. **Wer wird Millionär?**: Multiple Choice. Spätere Fragen bringen mehr Punkte.
3. **Higher or Lower**: Begriffe auf einer Skala richtig einordnen. Jeder hat zwei Leben.
4. **Wo liegt das?**: Orte aus einer Kategorie auf einer Karte ohne Beschriftung finden. Punkte nach Luftlinie, genau drauf gibt 20.
5. **Bildrätsel**: Bilder werden aufgedeckt, herangezoomt oder ganz gezeigt. Wer zuerst richtig buzzert, bekommt Punkte, je früher desto mehr.
6. **Songrätsel**: Songs nach 0,2 / 0,5 / 1 / 3 / 5 Sekunden erkennen (5 bis 1 Punkt). Der Host spielt die Ausschnitte für alle gleichzeitig ab, Spieler suchen den Song und loggen ihn ein. Andere Versionen desselben Songs zählen auch. Musik und Suche kommen von der iTunes Search API (30-s-Hörproben, kein Login nötig).
7. **Jeopardy**: Fragen vom Spielbrett wählen und buzzern. Ist immer das Finale.

Nach jedem Spiel gibt es einen Punktestand und am Ende ein animiertes Finale. Jede Show landet in der Statistik (Bestenliste unter `/stats`, Profile unter `/stats/<id>`). Der Bot gibt dem Gewinner die Gewinner-Rolle und hängt seine Siege als römische Zahl an den Namen, z. B. `Name [II]`. Im Discord gibt es `/stats`, `/bestenliste` und `/quiz`.

Für OBS gibt es `/overlay?key=...` (1920×1080), den Link kopiert der Host auf der Startseite.

## Entwicklung

```bash
npm install
npm run dev
```

Danach läuft das Spiel auf http://localhost:3000. Um es von einem anderen Gerät im Netzwerk zu öffnen, die Adresse in `ALLOWED_DEV_ORIGINS` eintragen:

```bash
ALLOWED_DEV_ORIGINS=192.168.1.20 npm run dev
```

## Produktion

```bash
npm run build
npm start
```

Umgebungsvariablen:

| Variable | Wofür |
| --- | --- |
| `PORT`, `HOST` | Port (Standard 3000) und Adresse (Standard alle) |
| `DATA_DIR` | Ordner für Fragenpool, Bilder und Statistik (`stats.json`) |
| `PUBLIC_URL` | Adresse der Seite, z. B. `https://quiz.notjan.de` (für den Discord-Login) |
| `SESSION_SECRET` | Schlüssel für Login-Cookies, Overlay-Link und Kamera-IDs |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord-App für den Login |
| `DISCORD_BOT_TOKEN` | Bot für Slash-Befehle, Gewinner-Rolle und Namen |
| `DISCORD_GUILD_ID` | Hauptserver: Host, Bot-Befehle, Gewinner-Rolle; seine Mitglieder dürfen sich anmelden |
| `DISCORD_EXTRA_GUILD_IDS` | Weitere Server (Komma-Liste), deren Mitglieder sich auch anmelden dürfen |
| `DISCORD_WINNER_ROLE_ID` | Rolle für den letzten Gewinner |
| `HOST_DISCORD_IDS` | Wer hosten darf (Komma-Liste). Leer = Eigentümer des Servers |
| `BOT_WINNER` | `on` = Rolle und Namen wirklich ändern (nur Produktion) |
| `ADMIN_PASSWORD` | Passwort für `/admin` (der Host kommt auch ohne rein) |
| `DEV_LOGIN` | `on` = Test-Logins unter `/auth/dev` ohne Discord. Nie öffentlich! |

Die Slash-Befehle laufen über den Interactions-Endpoint `https://<PUBLIC_URL>/api/discord/interactions`, der in der Discord-App eingetragen sein muss. Die laufende Show liegt im Speicher, ein Neustart beendet sie.

## Fragen

Alle Inhalte liegen in einem Fragenpool außerhalb des Repos (`DATA_DIR/pool.json`, Standard `./data`). Beim ersten Start wird er aus `server/seedData.ts` gefüllt.

Hochgeladene Bilder liegen in `DATA_DIR/images` und werden unter `/media/` ausgeliefert. Die Umrisskarten in `public/maps` stammen aus Natural Earth (gemeinfrei) und werden mit `node scripts/build-maps.mjs` neu erzeugt.

Bearbeitet wird der Pool unter `/admin`. Dafür muss `ADMIN_PASSWORD` gesetzt sein, sonst ist der Adminbereich aus. Dort lassen sich Einträge anlegen, ändern und löschen, als JSON importieren und exportieren. Außerdem kann man einstellen, wie viel pro Show gezogen wird.

Pro Show zieht der Server zuerst Einträge, die noch nie gespielt wurden, danach die, die am längsten nicht dran waren. Wer wird Millionär hat immer 30 Fragen: je zwei pro Stufe von 1 bis 15 Punkten. Die Punkte einer Frage sind zugleich ihre Schwierigkeit und werden beim Anlegen festgelegt.

Der Host wählt in der Lobby, welche Spiele in welcher Reihenfolge laufen. Jeopardy ist immer das Finale.

## Aufbau

- `server.ts` startet Next.js und Socket.IO.
- `server/game.ts` enthält die Spielregeln, `server/show.ts` die laufende Show und die gefilterte Sicht für Spieler.
- `server/auth.ts` (Discord-Login), `server/discord.ts` (Discord-API, Gewinner-Rolle), `server/bot.ts` (Slash-Befehle), `server/db.ts` und `server/record.ts` (Statistik), `server/api.ts` (JSON für die Seite).
- `server/pool.ts` verwaltet den Fragenpool, `server/admin.ts` die API für `/admin`.
- `src/app` und `src/components` sind die Oberfläche. Host und Spieler nutzen dieselben Komponenten.
