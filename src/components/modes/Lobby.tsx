"use client";

import { ButtonHTMLAttributes, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Dices, GripVertical, Lock, Minus, Play, Plus, X } from "lucide-react";
import { useGame, useRoomStore } from "@/lib/store";
import { getSocket, hostAction } from "@/lib/socket";
import { FINAL_MODE, Mode, PLANNABLE_MODES, SCREEN_LABELS } from "@/types/game";
import { cn } from "@/lib/utils";
import { Button, Panel, PanelTitle } from "@/components/ui";
import { ModeLayout } from "@/components/room/Shell";
import { Avatar } from "@/components/stats";


export default function Lobby() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const playerId = useRoomStore((s) => s.playerId);
  const router = useRouter();
  const isHost = role === "host";
  const players = [...game.players].sort((a, b) => a.name.localeCompare(b.name, "de"));

  const random = game.randomCount !== null;
  const empty = random ? [] : game.plan.filter((m) => game.poolCounts?.[m] === 0);
  const playable = PLANNABLE_MODES.filter((m) => (game.poolCounts?.[m] ?? 1) > 0);

  const leave = () => {
    getSocket().emit("leaveShow");
    router.replace("/");
  };

  return (
    <ModeLayout
      fill
      actions={
        isHost ? (
          <>
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm("Show abbrechen?")) {
                hostAction({ type: "closeShow" });
                router.replace("/");
              }
            }}
          >
            Abbrechen
          </Button>
          <Button size="lg" className="w-full sm:w-auto" disabled={players.length === 0 || empty.length > 0} onClick={() => hostAction({ type: "start" })}>
            <Play />{" "}
            {empty.length > 0
              ? `Keine Inhalte für ${SCREEN_LABELS[empty[0]]}`
              : players.length === 0
                ? "Warte auf Spieler"
                : random
                  ? `Auslosen und starten (${players.length} ${players.length === 1 ? "Spieler" : "Spieler"})`
                  : `Spiel starten mit ${players.length} ${players.length === 1 ? "Spieler" : "Spielern"}`}
          </Button>
          </>
        ) : undefined
      }
    >
      <Panel className="stripe flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
        <p className="headline text-2xl sm:text-3xl">{isHost ? "Warte auf Spieler" : role === "player" ? "Du bist dabei" : "Gleich geht's los"}</p>
        <p className="text-sm text-muted">
          {isHost ? "Alle auf dem Server sehen die Show auf der Startseite." : `Sobald ${game.host.name} startet, geht es los.`}
        </p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 lg:min-h-0 lg:flex-1 [&>*]:min-w-0 lg:[&>*]:min-h-0 lg:[&>*]:overflow-y-auto">
        <Panel className="scrollbar-thin p-4">
          <PanelTitle className="mb-2">Spieler ({players.length})</PanelTitle>
          {players.length === 0 ? (
            <p className="label py-6 text-center">Noch niemand da</p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {players.map((p) => (
                <li key={p.id} className={`flex min-w-0 items-center gap-2.5 rounded-xl border py-1 pr-1 pl-2 ${p.id === playerId ? "border-white/20 bg-white/10" : "border-transparent bg-black/20"}`}>
                  <span className="relative">
                    <Avatar name={p.name} src={p.avatar} className="size-7" />
                    <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-zinc-900 ${p.connected ? "bg-good" : "bg-bad"}`} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold uppercase italic">{p.name}</span>
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

        <Panel className="scrollbar-thin p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <PanelTitle>Ablauf</PanelTitle>
            {isHost && (
              <div className="flex rounded-lg border border-line p-0.5 text-xs font-bold uppercase">
                {[
                  ["Selbst wählen", null],
                  ["Auslosen", Math.min(3, playable.length)],
                ].map(([label, count]) => (
                  <button
                    key={String(label)}
                    type="button"
                    onClick={() => hostAction({ type: "plan.random", count: count as number | null })}
                    className={cn("rounded-md px-3 py-1.5", (count === null) === !random ? "bg-white text-black" : "text-muted hover:text-white")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {random ? (
            <RandomSettings count={game.randomCount!} max={playable.length} isHost={isHost} />
          ) : isHost ? (
            <PlanEditor plan={game.plan} counts={game.poolCounts} />
          ) : (
            // Players do not see the chosen games, the slot machine shows them at the start.
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Dices className="size-8 text-accent-light" />
              <p className="text-muted">Die Spiele werden zu Beginn enthüllt. Jeopardy ist immer das Finale.</p>
            </div>
          )}
        </Panel>
      </div>

      {role === "player" && (
        <div className="text-center">
          <Button variant="ghost" onClick={leave}>
            Show verlassen
          </Button>
        </div>
      )}
    </ModeLayout>
  );
}

// Drawn at the start: how many games before the Jeopardy final.
function RandomSettings({ count, max, isHost }: { count: number; max: number; isHost: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <Dices className="size-8 text-accent-light" />
      <p className="text-muted">Die Spiele werden beim Start zufällig ausgelost. Jeopardy ist immer das Finale.</p>
      <div className="flex items-center gap-3">
        {isHost && (
          <IconButton title="Weniger" disabled={count <= 1} onClick={() => hostAction({ type: "plan.random", count: count - 1 })}>
            <Minus />
          </IconButton>
        )}
        <span className="headline text-4xl tabular-nums">{count}</span>
        {isHost && (
          <IconButton title="Mehr" disabled={count >= max} onClick={() => hostAction({ type: "plan.random", count: count + 1 })}>
            <Plus />
          </IconButton>
        )}
      </div>
      <p className="label">{count === 1 ? "Spiel" : "Spiele"} + Jeopardy</p>
    </div>
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
    <div className="space-y-2">
      <ol className="space-y-1">
        {chosen.map((mode, i) => (
          <li
            key={mode}
            draggable
            onDragStart={() => setDragging(mode)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dragging && dragging !== mode && move(dragging, i)}
            className={cn("flex items-center gap-2 rounded-xl border border-line bg-black/20 py-1 pr-1.5 pl-2", dragging === mode && "opacity-50")}
          >
            <GripVertical className="hidden size-4 shrink-0 cursor-grab text-faint sm:block" />
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-raised font-mono text-sm font-bold">{i + 1}</span>
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="truncate font-black uppercase italic">{SCREEN_LABELS[mode]}</span>
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
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate font-black uppercase italic">{SCREEN_LABELS[FINAL_MODE]}</span>
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
