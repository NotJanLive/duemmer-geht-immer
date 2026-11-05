# Dümmer geht Immer

Eine Quizshow für Freunde. Eine Person moderiert, alle anderen spielen am eigenen Handy oder Rechner mit. Die Spiele laufen in dieser Reihenfolge:

1. **Last Man Standing**: Reihum Begriffe zu einem Thema nennen. Wer nichts mehr weiß, scheidet aus.
2. **Wer wird Millionär?**: Multiple Choice. Spätere Fragen bringen mehr Punkte.
3. **Higher or Lower**: Begriffe auf einer Skala richtig einordnen. Jeder hat zwei Leben.
4. **Jeopardy**: Fragen vom Spielbrett wählen und buzzern.

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

`PORT` legt den Port fest (Standard 3000). Alle Räume liegen im Speicher. Ein Neustart beendet also laufende Spiele.

## Fragen

Alle Fragen stehen in `src/lib/gameData.ts`:

- `lmsData`: Themen mit einer Liste von Begriffen.
- `millionaireData`: Frage `q`, Antworten `o` und Index der richtigen Antwort `a`.
- `higherLowerData`: Themen mit Einheit und Begriffen samt Zahlenwert.
- `jeopardyData`: Kategorien mit Frage `q` und Antwort `a`. Die Punkte steigen pro Zeile um 10.

## Aufbau

- `server.ts` startet Next.js und Socket.IO.
- `server/game.ts` enthält die Spielregeln, `server/rooms.ts` Räume, Sitzungen und die gefilterte Sicht für Spieler.
- `src/app` und `src/components` sind die Oberfläche. Host und Spieler nutzen dieselben Komponenten.
