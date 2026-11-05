"use client";

import { ArrowRight, Check, Eye, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction, playerAction } from "@/lib/socket";
import { Button, Panel, Pill } from "@/components/ui";
import { ModeHeading, ModeLayout, Scoreboard, StatusBanner } from "@/components/room/Shell";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function Millionaire() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const wwm = game.wwm!;
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
      side={
        <Scoreboard
          players={game.players}
          meId={meId}
          tone={(p) => (wwm.revealed ? (wwm.answers[p.id]?.correct ? "good" : "bad") : null)}
          note={(p) => {
            const a = wwm.answers[p.id];
            if (wwm.revealed) {
              if (!a?.locked || a.answer === null) return <span className="inline-flex items-center gap-1 font-bold uppercase text-red-500"><X className="size-3.5" /> Keine Antwort</span>;
              return a.correct ? (
                <span className="inline-flex items-center gap-1 font-bold uppercase text-green-500"><Check className="size-3.5" /> Richtig ({LETTERS[a.answer]})</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold uppercase text-red-500"><X className="size-3.5" /> Falsch ({LETTERS[a.answer]})</span>
              );
            }
            if (a?.locked) {
              return (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-600/20 px-2 py-0.5 text-xs font-bold uppercase text-green-500">
                  <Lock className="size-3" /> Eingeloggt{isHost && a.answer != null ? ` (${LETTERS[a.answer]})` : ""}
                </span>
              );
            }
            if (isHost && a?.answer != null) return `Wählt gerade ${LETTERS[a.answer]}`;
            return "Überlegt noch";
          }}
        />
      }
      actions={
        isHost ? (
          !wwm.revealed ? (
            <Button onClick={() => hostAction({ type: "wwm.reveal" })}>
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
        ) : (
          !wwm.revealed &&
          !mine?.locked && (
            <Button size="lg" className="w-full sm:w-auto" disabled={mine?.answer == null} onClick={() => playerAction({ type: "wwm.lock" })}>
              <Lock /> Antwort einloggen
            </Button>
          )
        )
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
          const clickable = !isHost && !wwm.revealed && !mine?.locked;
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
              {option}
            </button>
          );
        })}
      </div>
    </ModeLayout>
  );
}
