"use client";

import { useRouter } from "next/navigation";
import { Play, X } from "lucide-react";
import { useGame, useRoomStore } from "@/lib/store";
import { getSocket, hostAction } from "@/lib/socket";
import { clearSession } from "@/lib/session";
import { MODE_ORDER, SCREEN_LABELS } from "@/types/game";
import { Button, Panel, PanelTitle } from "@/components/ui";
import { CopyCode, ModeLayout } from "@/components/room/Shell";

const MODE_HINTS: Record<(typeof MODE_ORDER)[number], string> = {
  lastManStanding: "Reihum Begriffe nennen. Wer nichts mehr weiß, fliegt.",
  millionaire: "Multiple Choice. Je später die Frage, desto mehr Punkte.",
  higherLower: "Werte auf der Skala richtig einordnen.",
  jeopardy: "Kategorien wählen und buzzern.",
};

export default function Lobby() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const playerId = useRoomStore((s) => s.playerId);
  const router = useRouter();
  const isHost = role === "host";
  const players = [...game.players].sort((a, b) => a.name.localeCompare(b.name, "de"));

  const leave = () => {
    getSocket().emit("leaveRoom");
    clearSession();
    router.replace("/");
  };

  return (
    <ModeLayout
      actions={
        isHost ? (
          <Button size="lg" className="w-full sm:w-auto" disabled={players.length === 0} onClick={() => hostAction({ type: "start" })}>
            <Play /> {players.length === 0 ? "Warte auf Spieler" : `Spiel starten mit ${players.length} ${players.length === 1 ? "Spieler" : "Spielern"}`}
          </Button>
        ) : undefined
      }
    >
      {isHost ? (
        <Panel className="stripe flex flex-col items-center gap-3 p-6 text-center sm:p-8">
          <p className="label">Raumcode</p>
          <CopyCode code={game.roomCode} large />
          <p className="text-sm text-muted">Klick auf den Code kopiert einen Einladungslink für den Call.</p>
        </Panel>
      ) : (
        <Panel className="stripe p-6 text-center">
          <p className="headline text-4xl">Du bist dabei</p>
          <p className="mt-3 text-muted">Sobald {game.hostName} startet, geht es los.</p>
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="p-4">
          <PanelTitle className="mb-3">Spieler ({players.length})</PanelTitle>
          {players.length === 0 ? (
            <p className="label py-6 text-center">Noch niemand da</p>
          ) : (
            <ul className="space-y-1.5">
              {players.map((p) => (
                <li key={p.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${p.id === playerId ? "border-white/20 bg-white/10" : "border-transparent bg-black/20"}`}>
                  <span className={`size-2 rounded-full ${p.connected ? "bg-good" : "bg-bad"}`} />
                  <span className="flex-1 truncate text-lg font-bold uppercase italic">{p.name}</span>
                  {p.id === playerId && <span className="font-mono text-xs text-faint">(du)</span>}
                  {isHost && (
                    <button
                      onClick={() => hostAction({ type: "kick", playerId: p.id })}
                      className="grid size-8 place-items-center rounded-lg text-faint hover:bg-bad-soft hover:text-bad"
                      title={`${p.name} entfernen`}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-4">
          <PanelTitle className="mb-3">Ablauf</PanelTitle>
          <ol className="space-y-3">
            {MODE_ORDER.map((mode, i) => (
              <li key={mode} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-raised font-mono font-bold">{i + 1}</span>
                <span>
                  <span className="block text-lg font-black uppercase italic">{SCREEN_LABELS[mode]}</span>
                  <span className="block text-sm text-muted">{MODE_HINTS[mode]}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {!isHost && (
        <div className="text-center">
          <Button variant="ghost" onClick={leave}>
            Raum verlassen
          </Button>
        </div>
      )}
    </ModeLayout>
  );
}
