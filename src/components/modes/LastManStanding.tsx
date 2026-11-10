"use client";

import { ArrowRight, SkipForward, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction } from "@/lib/socket";
import { Button, Panel, Pill } from "@/components/ui";
import { ModeHeading, ModeLayout, Scoreboard, StatusBanner } from "@/components/room/Shell";

export default function LastManStanding() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const lms = game.lms!;
  const round = lms.rounds[lms.roundIndex];
  const isHost = role === "host";

  const name = (id: string | null) => game.players.find((p) => p.id === id)?.name;
  const alive = game.players.filter((p) => !round.eliminated.includes(p.id));
  const revealed = round.cards.filter((c) => c.revealed).length;
  const allNamed = revealed === round.cards.length;
  const lastStanding = game.players.length > 1 && alive.length === 1 ? alive[0] : null;
  const roundOver = allNamed || alive.length === 0 || !!lastStanding;
  const isLastRound = lms.roundIndex === lms.rounds.length - 1;
  const meOut = !!meId && round.eliminated.includes(meId);

  let banner;
  if (lastStanding) banner = <StatusBanner tone="good"><Trophy className="mr-1.5 inline size-4" />{lastStanding.name} ist noch übrig</StatusBanner>;
  else if (allNamed) banner = <StatusBanner tone="good">Alle Begriffe wurden genannt</StatusBanner>;
  else if (alive.length === 0) banner = <StatusBanner>Alle sind ausgeschieden</StatusBanner>;
  else if (!isHost && meOut) banner = <StatusBanner tone="bad">Du bist in dieser Runde ausgeschieden</StatusBanner>;
  else if (!isHost && round.currentPlayerId === meId) banner = <StatusBanner tone="accent">Du bist dran. Nenne einen Begriff!</StatusBanner>;
  else banner = <StatusBanner>{name(round.currentPlayerId)} ist dran</StatusBanner>;

  return (
    <ModeLayout
      board={
        <Scoreboard
          players={game.players}
          meId={meId}
          turnId={roundOver ? null : round.currentPlayerId}
          title={isHost ? "Spieler antippen zum Ausscheiden" : undefined}
          dimmed={(p) => round.eliminated.includes(p.id)}
          tag={(p) => {
            const at = round.eliminated.indexOf(p.id);
            return at === -1 ? null : <span className="normal-case">{at + 1}. raus</span>;
          }}
          onSelect={isHost && !round.scored ? (p) => hostAction({ type: "lms.toggleEliminated", playerId: p.id }) : undefined}
        />
      }
      actions={
        isHost && (
          <>
            {!roundOver && (
              <Button variant="secondary" disabled={alive.length < 2} onClick={() => hostAction({ type: "lms.skip" })}>
                <SkipForward /> Nächster Spieler
              </Button>
            )}
            {isLastRound ? (
              <Button onClick={() => hostAction({ type: "showLeaderboard" })}>
                Zum Punktestand <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => hostAction({ type: "lms.nextRound" })}>
                Nächste Runde <ArrowRight />
              </Button>
            )}
          </>
        )
      }
    >
      <ModeHeading
        eyebrow={`Runde ${lms.roundIndex + 1} von ${lms.rounds.length}`}
        title={round.topic}
        meta={<Pill>{revealed} / {round.cards.length} genannt</Pill>}
      />
      {banner}

      <Panel className="stripe p-3 pt-4 sm:p-4 sm:pt-5">
        <div className={cn("grid gap-2", isHost ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5")}>
          {round.cards.map((card) =>
            isHost ? (
              <button
                key={card.id}
                disabled={card.revealed}
                onClick={() => hostAction({ type: "lms.reveal", cardId: card.id })}
                className={cn(
                  "min-h-14 rounded-xl border px-3 py-2 font-bold uppercase italic transition-colors",
                  card.revealed ? "border-green-900 bg-green-950 text-good opacity-60" : "border-line-strong bg-raised hover:border-white",
                )}
              >
                {card.value}
              </button>
            ) : (
              <div key={card.id} className="flip-scene h-16 sm:h-20">
                <div className={cn("flip-card h-full w-full", card.revealed && "flip-flipped")}>
                  <div className="flip-face grid place-items-center rounded-xl border-2 border-line-strong bg-raised text-2xl font-black italic text-faint">?</div>
                  <div className="flip-face flip-back grid place-items-center rounded-xl border border-green-400 bg-green-600 px-1.5 text-center text-sm font-bold uppercase italic leading-tight text-white shadow-[0_0_30px_rgba(34,197,94,0.2)] sm:text-base">
                    {card.value}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </Panel>
    </ModeLayout>
  );
}
