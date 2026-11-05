# Dümmer geht Immer

Eine Quizshow für Freunde. Eine Person moderiert, alle anderen spielen am eigenen Handy oder Rechner mit. Der Spielleiter stellt in der Lobby zusammen, welche Spiele in welcher Reihenfolge laufen:

1. **Last Man Standing**: Reihum Begriffe zu einem Thema nennen. Wer nichts mehr weiß, scheidet aus.
2. **Wer wird Millionär?**: Multiple Choice. Spätere Fragen bringen mehr Punkte.
3. **Higher or Lower**: Begriffe auf einer Skala richtig einordnen. Jeder hat zwei Leben.
4. **Wo liegt das?**: Orte aus einer Kategorie auf einer Karte ohne Beschriftung finden. Punkte nach Luftlinie, genau drauf gibt 20.
5. **Bildrätsel**: Bilder werden aufgedeckt, herangezoomt oder ganz gezeigt. Wer zuerst richtig buzzert, bekommt Punkte, je früher desto mehr.
6. **Jeopardy**: Fragen vom Spielbrett wählen und buzzern. Ist immer das Finale.

Nach jedem Spiel gibt es einen Punktestand und am Ende ein animiertes Finale.

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

`PORT` legt den Port fest (Standard 3000), `DATA_DIR` den Ordner für den Fragenpool, `ADMIN_PASSWORD` das Passwort für `/admin`. Alle Räume liegen im Speicher. Ein Neustart beendet also laufende Spiele.

## Fragen

Alle Inhalte liegen in einem Fragenpool außerhalb des Repos (`DATA_DIR/pool.json`, Standard `./data`). Beim ersten Start wird er aus `server/seedData.ts` gefüllt.

Hochgeladene Bilder liegen in `DATA_DIR/images` und werden unter `/media/` ausgeliefert. Die Umrisskarten in `public/maps` stammen aus Natural Earth (gemeinfrei) und werden mit `node scripts/build-maps.mjs` neu erzeugt.

Bearbeitet wird der Pool unter `/admin`. Dafür muss `ADMIN_PASSWORD` gesetzt sein, sonst ist der Adminbereich aus. Dort lassen sich Einträge anlegen, ändern und löschen, als JSON importieren und exportieren. Außerdem kann man einstellen, wie viel pro Show gezogen wird.

Pro Show zieht der Server zuerst Einträge, die noch nie gespielt wurden, danach die, die am längsten nicht dran waren. Wer wird Millionär hat immer 30 Fragen: je zwei pro Stufe von 1 bis 15 Punkten. Die Punkte einer Frage sind zugleich ihre Schwierigkeit und werden beim Anlegen festgelegt.

Der Spielleiter wählt in der Lobby, welche Spiele in welcher Reihenfolge laufen. Jeopardy ist immer das Finale.

## Aufbau

- `server.ts` startet Next.js und Socket.IO.
- `server/game.ts` enthält die Spielregeln, `server/rooms.ts` Räume, Sitzungen und die gefilterte Sicht für Spieler.
- `server/pool.ts` verwaltet den Fragenpool, `server/admin.ts` die API für `/admin`.
- `src/app` und `src/components` sind die Oberfläche. Host und Spieler nutzen dieselben Komponenten.
