"use client";

import { ArrowRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction } from "@/lib/socket";
import { SCREEN_LABELS } from "@/types/game";
import { Button, Panel } from "@/components/ui";
import { ModeHeading, ModeLayout, StatusBanner } from "@/components/room/Shell";

export default function Leaderboard() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const playedMode = game.plan[game.modeIndex];
  const nextMode = game.plan[game.modeIndex + 1];
  const ranked = [...game.players].sort((a, b) => b.modeScore - a.modeScore || a.name.localeCompare(b.name, "de"));
  const best = ranked[0]?.modeScore ?? 0;
  const rankOf = (score: number) => ranked.findIndex((p) => p.modeScore === score) + 1;
  const myRank = meId ? rankOf(game.players.find((p) => p.id === meId)?.modeScore ?? 0) : 0;

  return (
    <ModeLayout
      actions={
        role === "host" && (
          <Button size="lg" className="w-full sm:w-auto" onClick={() => hostAction({ type: "nextMode" })}>
            {nextMode ? <>Weiter mit {SCREEN_LABELS[nextMode]} <ArrowRight /></> : <><Trophy /> Zum Finale</>}
          </Button>
        )
      }
    >
      <ModeHeading eyebrow={`Ergebnis von ${SCREEN_LABELS[playedMode]}`} title="Rundenwertung" />
      {role === "player" && myRank > 0 && (
        <StatusBanner tone={myRank === 1 ? "good" : "neutral"}>
          {myRank === 1 ? "Du hast diese Runde gewonnen!" : `Du bist auf Platz ${myRank}`}
        </StatusBanner>
      )}
      <Panel className="stripe p-2 pt-3 sm:p-3 sm:pt-4">
        <ol className="space-y-1">
          {ranked.map((p) => {
            const rank = rankOf(p.modeScore);
            const first = rank === 1 && best > 0;
            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-4 rounded-xl border px-4 py-3",
                  first ? "border-gold/40 bg-gold/10" : p.id === meId ? "border-white/20 bg-white/10" : "border-transparent bg-black/20",
                )}
              >
                <span className={cn("w-8 font-mono text-lg font-bold tabular-nums", rank === 1 ? "text-gold" : rank === 2 ? "text-silver" : rank === 3 ? "text-bronze" : "text-faint")}>{rank}.</span>
                <span className="min-w-0 flex-1 truncate text-xl font-bold uppercase italic sm:text-2xl">
                  {p.name}
                  {p.id === meId && <span className="ml-2 font-mono text-xs not-italic text-faint normal-case">(du)</span>}
                </span>
                <span className="text-3xl font-black italic tabular-nums">{p.modeScore}</span>
              </li>
            );
          })}
        </ol>
      </Panel>
      <p className="label text-center">Der Gesamtstand bleibt bis zum Finale geheim</p>
    </ModeLayout>
  );
}
