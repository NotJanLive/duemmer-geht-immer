"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, Play, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction } from "@/lib/socket";
import { clearSession } from "@/lib/session";
import { Button, Panel } from "@/components/ui";
import { ModeHeading, ModeLayout } from "@/components/room/Shell";

const RISE_MS = 5000;
const PAUSE_MS = 2000;
const STEP_MS = RISE_MS + PAUSE_MS;
const CONFETTI = ["#60a5fa", "#c084fc", "#f472b6", "#eab308"];

// Scores rise together. At each distinct score the players holding it drop out,
// until only the best score is left. Ties drop out (or win) together.
function timeline(scores: number[], elapsed: number) {
  const steps = [...new Set(scores)].sort((a, b) => a - b);
  for (let i = 0; i < steps.length; i++) {
    const from = i === 0 ? 0 : steps[i - 1];
    const t = elapsed - i * STEP_MS;
    if (t < RISE_MS) {
      return { level: from + (steps[i] - from) * Math.max(0, t / RISE_MS), outBelow: from, done: false };
    }
    if (t < STEP_MS || i === steps.length - 1) {
      const last = i === steps.length - 1;
      return { level: steps[i], outBelow: last ? steps[i] : steps[i] + 1e-9, done: last };
    }
  }
  return { level: 0, outBelow: 0, done: true };
}

// Local clock that ticks every frame until `until` (local time) has passed.
function useNow(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      const t = Date.now();
      setNow(t);
      if (t < until) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [until]);
  return now;
}

export default function Finale() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const offset = useRoomStore((s) => s.clockOffset);
  const router = useRouter();
  const startedAt = game.finaleStartedAt;

  const scores = game.players.map((p) => p.totalScore);
  const top = Math.max(1, ...scores);
  const endsAt = startedAt ? startedAt - offset + new Set(scores).size * STEP_MS + 100 : 0;
  const now = useNow(endsAt);
  const elapsed = startedAt ? now + offset - startedAt : -1;
  const { level, outBelow, done } = startedAt ? timeline(scores, elapsed) : { level: 0, outBelow: 0, done: false };

  const players = [...game.players].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const winners = done ? game.players.filter((p) => p.totalScore === Math.max(...scores)) : [];

  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: ((i * 53) % 40) / 10,
        duration: 3 + ((i * 29) % 20) / 10,
        color: CONFETTI[i % CONFETTI.length],
        wide: i % 3 === 0,
      })),
    [],
  );

  const close = () => {
    if (!confirm("Spiel wirklich beenden? Alle Spieler werden aus dem Raum entfernt.")) return;
    hostAction({ type: "closeRoom" });
    clearSession();
    router.replace("/");
  };

  return (
    <ModeLayout
      actions={
        role === "host" &&
        (!startedAt ? (
          <Button size="lg" className="w-full sm:w-auto" onClick={() => hostAction({ type: "finale.start" })}>
            <Play /> Auflösung starten
          </Button>
        ) : done ? (
          <Button size="lg" variant="secondary" onClick={close}>
            <DoorOpen /> Spiel beenden
          </Button>
        ) : undefined)
      }
    >
      {done && (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
          {confetti.map((c, i) => (
            <span
              key={i}
              className={cn("absolute top-0 rounded-sm opacity-0", c.wide ? "h-2 w-3.5" : "h-3 w-1.5")}
              style={{ left: `${c.left}%`, background: c.color, animation: `fall ${c.duration}s linear ${c.delay}s forwards` }}
            />
          ))}
        </div>
      )}

      <ModeHeading eyebrow="Gesamtwertung" title={!done ? "Wer gewinnt?" : winners.length > 1 ? "Wir haben Gewinner!" : "Wir haben einen Gewinner!"} />

      {done && winners.length > 0 && (
        <Panel className="animate-pop border-gold/50 bg-gold/10 p-6 text-center shadow-[0_0_40px_rgba(234,179,8,0.2)] sm:p-10">
          <Trophy className="mx-auto size-12 text-gold" />
          <p className="label mt-4">{winners.length > 1 ? "Gleichstand an der Spitze" : "Gewinner"}</p>
          <p className="headline mt-3 text-5xl text-gold sm:text-7xl">{winners.map((w) => w.name).join(" & ")}</p>
          <p className="mt-3 font-mono text-lg text-muted tabular-nums">{winners[0].totalScore} Punkte</p>
        </Panel>
      )}

      <Panel className="stripe space-y-2.5 p-4 pt-5 sm:p-5 sm:pt-6">
        {players.map((p) => {
          const shown = Math.min(p.totalScore, level);
          const out = startedAt !== null && p.totalScore < outBelow;
          const won = winners.includes(p);
          return (
            <div key={p.id} className={cn("transition-opacity duration-500", out && "opacity-35")}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className={cn("truncate text-lg font-bold uppercase italic", p.id === meId && "text-accent-light")}>
                  {p.name}
                  {won && <Trophy className="ml-2 inline size-4 text-gold" />}
                </span>
                <span className="text-2xl font-black italic tabular-nums">{Math.floor(shown)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-raised">
                <div
                  className={cn("h-full rounded-full", won ? "bg-gold shadow-[0_0_12px_rgba(234,179,8,0.6)]" : out ? "bg-red-900" : "bg-gradient-to-r from-accent-strong to-purple-500")}
                  style={{ width: `${(shown / top) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </Panel>

      {!startedAt && <p className="label text-center">{role === "host" ? "Starte die Auflösung, wenn alle bereit sind." : "Gleich wird aufgelöst …"}</p>}
    </ModeLayout>
  );
}
