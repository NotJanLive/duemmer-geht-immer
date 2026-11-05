"use client";

import { ButtonHTMLAttributes, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, Lock, Play, Plus, X } from "lucide-react";
import { useGame, useRoomStore } from "@/lib/store";
import { getSocket, hostAction } from "@/lib/socket";
import { clearSession } from "@/lib/session";
import { FINAL_MODE, MODE_ORDER, Mode, PLANNABLE_MODES, SCREEN_LABELS } from "@/types/game";
import { cn } from "@/lib/utils";
import { Button, Panel, PanelTitle } from "@/components/ui";
import { CopyCode, ModeLayout } from "@/components/room/Shell";

const MODE_HINTS: Record<(typeof MODE_ORDER)[number], string> = {
  lastManStanding: "Reihum Begriffe nennen. Wer nichts mehr weiß, fliegt.",
  millionaire: "Multiple Choice. Je später die Frage, desto mehr Punkte.",
  higherLower: "Werte auf der Skala richtig einordnen.",
  geo: "Orte auf einer leeren Karte finden.",
  pictures: "Bilder erkennen und buzzern. Je früher, desto mehr Punkte.",
  jeopardy: "Kategorien wählen und buzzern.",
};

export default function Lobby() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const playerId = useRoomStore((s) => s.playerId);
  const router = useRouter();
  const isHost = role === "host";
  const players = [...game.players].sort((a, b) => a.name.localeCompare(b.name, "de"));

  const empty = game.plan.filter((m) => game.poolCounts?.[m] === 0);

  const leave = () => {
    getSocket().emit("leaveRoom");
    clearSession();
    router.replace("/");
  };

  return (
    <ModeLayout
      actions={
        isHost ? (
          <Button size="lg" className="w-full sm:w-auto" disabled={players.length === 0 || empty.length > 0} onClick={() => hostAction({ type: "start" })}>
            <Play />{" "}
            {empty.length > 0
              ? `Keine Inhalte für ${SCREEN_LABELS[empty[0]]}`
              : players.length === 0
                ? "Warte auf Spieler"
                : `Spiel starten mit ${players.length} ${players.length === 1 ? "Spieler" : "Spielern"}`}
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

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
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
          {isHost ? (
            <PlanEditor plan={game.plan} counts={game.poolCounts} />
          ) : (
            <ol className="space-y-3">
              {game.plan.map((mode, i) => (
                <li key={mode} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-raised font-mono font-bold">{i + 1}</span>
                  <span>
                    <span className="block text-lg font-black uppercase italic">{SCREEN_LABELS[mode]}</span>
                    <span className="block text-sm text-muted">{MODE_HINTS[mode]}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
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

// The host picks which modes are played and in which order. Rows can be
// dragged on desktop, the arrows work everywhere. Jeopardy stays last.
function PlanEditor({ plan, counts }: { plan: Mode[]; counts?: Record<Mode, number> }) {
  const chosen = plan.filter((m) => m !== FINAL_MODE);
  const unused = PLANNABLE_MODES.filter((m) => !chosen.includes(m));
  const [dragging, setDragging] = useState<Mode | null>(null);
  const setPlan = (modes: Mode[]) => hostAction({ type: "plan.set", modes });

  const move = (mode: Mode, to: number) => {
    const next = chosen.filter((m) => m !== mode);
    next.splice(Math.max(0, Math.min(to, next.length)), 0, mode);
    setPlan(next);
  };

  const countLabel = (mode: Mode) => {
    const n = counts?.[mode];
    if (n === undefined) return null;
    return <span className={cn("font-mono text-xs", n === 0 ? "text-bad" : "text-faint")}>{n === 0 ? "Pool leer" : `${n} im Pool`}</span>;
  };

  return (
    <div className="space-y-3">
      <ol className="space-y-1.5">
        {chosen.map((mode, i) => (
          <li
            key={mode}
            draggable
            onDragStart={() => setDragging(mode)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dragging && dragging !== mode && move(dragging, i)}
            className={cn("flex items-center gap-2 rounded-xl border border-line bg-black/20 py-2 pr-1.5 pl-2", dragging === mode && "opacity-50")}
          >
            <GripVertical className="hidden size-4 shrink-0 cursor-grab text-faint sm:block" />
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-raised font-mono text-sm font-bold">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-black uppercase italic">{SCREEN_LABELS[mode]}</span>
              {countLabel(mode)}
            </span>
            <IconButton title="Nach oben" disabled={i === 0} onClick={() => move(mode, i - 1)}>
              <ArrowUp />
            </IconButton>
            <IconButton title="Nach unten" disabled={i === chosen.length - 1} onClick={() => move(mode, i + 1)}>
              <ArrowDown />
            </IconButton>
            <IconButton title="Entfernen" onClick={() => setPlan(chosen.filter((m) => m !== mode))}>
              <X />
            </IconButton>
          </li>
        ))}
        <li className="flex items-center gap-2 rounded-xl border border-line bg-black/20 py-2 pr-3 pl-2">
          <Lock className="hidden size-4 shrink-0 text-faint sm:block" />
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-raised font-mono text-sm font-bold">{chosen.length + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-black uppercase italic">{SCREEN_LABELS[FINAL_MODE]}</span>
            {countLabel(FINAL_MODE)}
          </span>
          <span className="font-mono text-xs text-faint">Finale</span>
        </li>
      </ol>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unused.map((mode) => (
            <Button key={mode} size="sm" variant="secondary" onClick={() => setPlan([...chosen, mode])}>
              <Plus /> {SCREEN_LABELS[mode]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-raised hover:text-white disabled:opacity-30 disabled:hover:bg-transparent [&_svg]:size-4", className)}
      {...props}
    />
  );
}
