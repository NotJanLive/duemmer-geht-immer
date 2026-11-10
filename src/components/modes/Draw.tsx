"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction } from "@/lib/socket";
import { useServerNow } from "@/lib/useServerNow";
import { play } from "@/lib/sounds";
import { DRAW_FIRST_STOP_MS, DRAW_STEP_MS, FINAL_MODE, Mode, PLANNABLE_MODES, SCREEN_LABELS, drawDuration } from "@/types/game";
import { Button } from "@/components/ui";
import { ModeHeading, ModeLayout } from "@/components/room/Shell";

const ROW_H = 76; // px per name on a reel; a window shows three
const LOOPS = 6; // full turns before a reel lands
const STRIP = PLANNABLE_MODES;

// Where reel `i` stands at time `t` (ms since start), in names. It spins top
// to bottom and slows down until it lands exactly on its game.
function reelPosition(i: number, mode: Mode, t: number) {
  const stopAt = DRAW_FIRST_STOP_MS + i * DRAW_STEP_MS;
  const target = (LOOPS + i) * STRIP.length + STRIP.indexOf(mode);
  const k = Math.min(1, Math.max(0, t / stopAt));
  // Fast start, long ease out like a real reel.
  const eased = 1 - (1 - k) ** 3;
  return { pos: target * eased, stopped: t >= stopAt, stopAt };
}

// Slot machine at the start of every show: one row per game, the reels spin
// and stop one after another from the top, then Jeopardy locks in as the
// final. Timed from the server, so everyone sees the same.
export default function Draw() {
  const game = useGame();
  const isHost = useRoomStore((s) => s.role) === "host";
  const drawn = game.plan.filter((m) => m !== FINAL_MODE);
  const started = game.drawStartedAt ?? 0;
  const total = drawDuration(drawn.length);
  const now = useServerNow(true, 30);
  const elapsed = now - started;
  const done = elapsed >= total;
  const reels = drawn.map((mode, i) => reelPosition(i, mode, elapsed));
  const stopped = reels.filter((r) => r.stopped).length;
  const finalIn = elapsed >= DRAW_FIRST_STOP_MS + drawn.length * DRAW_STEP_MS;

  // Ticks while names pass the line, a clunk when a reel stops, a jingle when
  // the final locks in. Late joiners stay quiet for what already happened.
  const lastTick = useRef({ names: -1, at: 0, stops: -1, final: false });
  useEffect(() => {
    const st = lastTick.current;
    const names = reels.reduce((sum, r) => sum + Math.floor(r.pos), 0);
    if (st.stops === -1) {
      lastTick.current = { names, at: 0, stops: stopped, final: finalIn };
      return;
    }
    if (stopped > st.stops) play("clunk");
    else if (finalIn && !st.final) play("reveal");
    else if (names > st.names && now - st.at > 45) {
      play("tick");
      st.at = now;
    }
    st.names = names;
    st.stops = stopped;
    st.final = finalIn;
  });

  return (
    <ModeLayout
      fill
      actions={
        isHost &&
        drawn[0] && (
          <Button size="lg" disabled={!done} onClick={() => hostAction({ type: "draw.done" })}>
            Los geht&apos;s mit {SCREEN_LABELS[drawn[0]]} <ArrowRight />
          </Button>
        )
      }
    >
      <ModeHeading eyebrow={`${drawn.length} ${drawn.length === 1 ? "Spiel" : "Spiele"} + Finale`} title={done ? "Das wird gespielt" : "Die Spiele werden ausgelost …"} />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-2">
        {/* The machine: reels side by side, all spin, they stop left to right. */}
        <div className="flex max-w-full items-stretch gap-3 overflow-x-auto rounded-3xl border-2 border-line-strong bg-gradient-to-b from-zinc-900 to-black p-4 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]">
          {drawn.map((mode, i) => (
            <ReelColumn key={i} index={i} pos={reels[i].pos} stopped={reels[i].stopped} />
          ))}
        </div>
        <div
          className={cn(
            "flex w-full max-w-xl items-center justify-center gap-3 rounded-2xl border-2 px-6 py-3",
            finalIn ? "draw-flash-gold border-yellow-500 bg-yellow-500/10" : "border-dashed border-line opacity-40",
          )}
        >
          <Crown className={cn("size-6", finalIn ? "text-yellow-400" : "text-faint")} />
          <span className="label">Finale</span>
          <span className="headline text-2xl sm:text-3xl">{SCREEN_LABELS[FINAL_MODE]}</span>
        </div>
      </div>
    </ModeLayout>
  );
}

// One reel: a window showing three names, the middle one on the pay line is
// the one that counts. Names run from top to bottom; the frame flashes once
// when the reel stops.
function ReelColumn({ index, pos, stopped }: { index: number; pos: number; stopped: boolean }) {
  const base = Math.floor(pos);
  const frac = pos - base;
  // Top to bottom: higher positions above, so the strip moves down.
  const names = [3, 2, 1, 0, -1, -2, -3].map((d) => STRIP[(((base + d) % STRIP.length) + STRIP.length) % STRIP.length]);
  return (
    <div className="flex w-44 shrink-0 flex-col items-center gap-2 sm:w-52">
      <div
        className={cn("relative w-full overflow-hidden rounded-xl border-2 bg-zinc-950", stopped ? "draw-flash border-accent" : "border-line-strong")}
        style={{ height: ROW_H * 3 }}
      >
        <div className="absolute inset-x-0" style={{ top: -2 * ROW_H + frac * ROW_H }}>
          {names.map((m, j) => (
            <div
              key={j}
              className={cn(
                "headline grid place-items-center px-3 text-center text-xl leading-tight",
                j === 3 && stopped ? "text-white" : "text-zinc-500",
                !stopped && "blur-[0.7px]",
              )}
              style={{ height: ROW_H }}
            >
              {SCREEN_LABELS[m]}
            </div>
          ))}
        </div>
        {/* Pay line in the middle, shading above and below like a real reel. */}
        <span
          className={cn("pointer-events-none absolute inset-x-0 border-y-2", stopped ? "border-accent/80 bg-accent/10" : "border-white/10")}
          style={{ top: ROW_H, height: ROW_H }}
        />
        <span className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black via-black/70 to-transparent" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black via-black/70 to-transparent" />
      </div>
      <span className={cn("grid size-8 place-items-center rounded-lg font-mono font-bold", stopped ? "bg-accent-strong text-white" : "bg-raised text-faint")}>{index + 1}</span>
    </div>
  );
}
