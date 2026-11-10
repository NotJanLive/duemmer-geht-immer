"use client";

import { ArrowRight, Check, Eye, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction, playerAction } from "@/lib/socket";
import { Button, Panel, Pill } from "@/components/ui";
import { ModeHeading, ModeLayout, Scoreboard, StatusBanner } from "@/components/room/Shell";
import { Avatar } from "@/components/stats";
import { Player, WwmState } from "@/types/game";
import { useState } from "react";

// Same result the server computes, for the host's instant reveal.
function revealLocally(wwm: WwmState): WwmState {
  const answers = Object.fromEntries(
    Object.entries(wwm.answers).map(([id, a]) => [id, { ...a, correct: a.locked && a.answer === wwm.question.correctAnswer }]),
  );
  return { ...wwm, answers, revealed: true };
}

function Pickers({ players }: { players: Player[] }) {
  if (!players.length) return null;
  return (
    <span className="flex shrink-0 -space-x-2">
      {players.slice(0, 8).map((p) => (
        <span key={p.id} title={p.name} className="animate-pop rounded-full ring-2 ring-zinc-900">
          <Avatar name={p.name} src={p.avatar} className="size-7 text-xs" />
        </span>
      ))}
      {players.length > 8 && <span className="grid size-7 place-items-center rounded-full bg-raised text-xs font-bold ring-2 ring-zinc-900">+{players.length - 8}</span>}
    </span>
  );
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function Millionaire() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const server = game.wwm!;
  // The host shows the reveal at once instead of waiting for the round trip.
  const [revealing, setRevealing] = useState<number | null>(null);
  const wwm = revealing === server.index && !server.revealed ? revealLocally(server) : server;
  const q = wwm.question;
  const isHost = role === "host";
  const mine = meId ? wwm.answers[meId] : undefined;
  const lockedCount = game.players.filter((p) => wwm.answers[p.id]?.locked).length;
  const isLast = wwm.index === wwm.total - 1;

  const optionState = (i: number) => {
    if (wwm.revealed || isHost) {
      if (i === q.correctAnswer) return "correct";
      if (!isHost && mine?.answer === i) return "wrong";
      return "idle";
    }
    if (mine?.answer === i) return mine.locked ? "locked" : "selected";
    return "idle";
  };

  // Who picked which answer: the host sees it live, everyone else after the reveal.
  const pickers = (i: number) =>
    isHost || wwm.revealed
      ? game.players.filter((p) => {
          const a = wwm.answers[p.id];
          return a?.answer === i && (isHost || a.locked);
        })
      : [];

  let banner = null;
  if (!isHost) {
    if (wwm.revealed) {
      banner = mine?.correct ? (
        <StatusBanner tone="good">Richtig! +{q.points} {q.points === 1 ? "Punkt" : "Punkte"}</StatusBanner>
      ) : (
        <StatusBanner tone="bad">{mine?.locked ? "Leider falsch" : "Keine Antwort eingeloggt"}</StatusBanner>
      );
    } else if (mine?.locked) {
      banner = <StatusBanner tone="accent">Eingeloggt. Warte auf die Auflösung.</StatusBanner>;
    }
  }

  return (
    <ModeLayout
      board={
        <Scoreboard
          players={game.players}
          meId={meId}
          tone={(p) => (wwm.revealed ? (wwm.answers[p.id]?.correct ? "good" : "bad") : null)}
          tag={(p) => {
            const a = wwm.answers[p.id];
            if (wwm.revealed) {
              if (!a?.locked || a.answer === null) return <X className="size-3.5" strokeWidth={3} />;
              return (
                <span className="inline-flex items-center gap-0.5">
                  {a.correct ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
                  {LETTERS[a.answer]}
                </span>
              );
            }
            if (a?.locked) {
              return (
                <span className="inline-flex items-center gap-0.5 text-green-400">
                  <Lock className="size-3.5" strokeWidth={3} />
                  {isHost && a.answer != null && LETTERS[a.answer]}
                </span>
              );
            }
            if (isHost && a?.answer != null) return <span className="opacity-60">{LETTERS[a.answer]}</span>;
            return null;
          }}
        />
      }
      actions={
        isHost ? (
          !wwm.revealed ? (
            <Button
              onClick={() => {
                setRevealing(wwm.index);
                hostAction({ type: "wwm.reveal" });
              }}
            >
              <Eye /> Auflösen ({lockedCount} / {game.players.length} eingeloggt)
            </Button>
          ) : isLast ? (
            <Button onClick={() => hostAction({ type: "showLeaderboard" })}>
              Zum Punktestand <ArrowRight />
            </Button>
          ) : (
            <Button onClick={() => hostAction({ type: "wwm.next" })}>
              Nächste Frage <ArrowRight />
            </Button>
          )
        ) : undefined
      }
    >
      <ModeHeading
        eyebrow={`Frage ${wwm.index + 1} von ${wwm.total}`}
        title="Wer wird Millionär?"
        meta={<Pill tone="accent">{q.points} {q.points === 1 ? "Punkt" : "Punkte"}</Pill>}
      />
      <div className="h-1.5 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full bg-accent-strong transition-all duration-500" style={{ width: `${((wwm.index + 1) / wwm.total) * 100}%` }} />
      </div>

      <Panel key={q.id} className="stripe animate-pop p-6 sm:p-8">
        <p className="text-center text-2xl font-bold leading-snug sm:text-3xl">{q.question}</p>
      </Panel>

      {banner}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {q.options.map((option, i) => {
          const state = optionState(i);
          const clickable = !!meId && !wwm.revealed && !mine?.locked;
          return (
            <button
              key={i}
              disabled={!clickable}
              onClick={() => playerAction({ type: "wwm.select", answer: i })}
              className={cn(
                "flex min-h-16 items-center gap-4 rounded-xl border-2 px-4 py-3 text-left text-lg font-bold transition-all",
                state === "idle" && "border-line bg-surface",
                state === "idle" && clickable && "hover:border-line-strong hover:bg-raised",
                state === "idle" && (isHost || wwm.revealed) && "text-muted",
                state === "selected" && "border-accent bg-accent-soft",
                state === "locked" && "border-accent-light bg-accent-strong text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]",
                state === "correct" && "border-green-500 bg-green-950/40 text-text",
                state === "wrong" && "border-red-500 bg-red-950/40 text-text",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold",
                  state === "locked" ? "bg-white/20" : "bg-raised",
                  state === "correct" && "bg-green-600 text-white",
                  state === "wrong" && "bg-red-600 text-white",
                )}
              >
                {state === "correct" ? <Check className="size-4" /> : state === "wrong" ? <X className="size-4" /> : LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1">{option}</span>
              <Pickers players={pickers(i)} />
            </button>
          );
        })}
      </div>

      {/* Next to the answers, so nothing moves the cams below. */}
      {!!meId && !wwm.revealed && !mine?.locked && (
        <div className="flex justify-center">
          <Button size="lg" className="w-full sm:w-auto" disabled={mine?.answer == null} onClick={() => playerAction({ type: "wwm.lock" })}>
            <Lock /> Antwort einloggen
          </Button>
        </div>
      )}
    </ModeLayout>
  );
}
