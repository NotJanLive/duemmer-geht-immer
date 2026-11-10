"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Heart, Minus, Plus, SkipForward, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction } from "@/lib/socket";
import { HOL_MAX_LIVES } from "@/types/game";
import { Button, Panel, PanelTitle, Pill } from "@/components/ui";
import { ModeHeading, ModeLayout, Scoreboard, StatusBanner } from "@/components/room/Shell";


function Lives({ count, small }: { count: number; small?: boolean }) {
  return (
    <span className="inline-flex gap-0.5 align-middle" title={`${count} von ${HOL_MAX_LIVES} Leben`}>
      {Array.from({ length: HOL_MAX_LIVES }, (_, i) => (
        <Heart key={i} className={cn(small ? "size-3.5" : "size-4", i < count ? "fill-red-500 text-red-500" : "text-white/50")} />
      ))}
    </span>
  );
}

function ScaleEnd({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-1 text-sm font-semibold text-muted [&_svg]:size-4 [&_svg]:text-accent-light">
      {icon}
      {text}
    </div>
  );
}

// No thousands dot below 10 000, so years read 1997, not 1.997.
const formatValue = (value: number | null) => (value === null ? "?" : value.toLocaleString("de-DE", { useGrouping: Math.abs(value) >= 10000 }));

export default function HigherLower() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const hol = game.hol!;
  const round = hol.rounds[hol.roundIndex];
  const isHost = role === "host";

  const lives = (id: string | null) => (id ? hol.lives[id] ?? 0 : 0);
  const current = game.players.find((p) => p.id === round.currentPlayerId);
  const open = round.items.filter((i) => !i.placed);
  const scale = round.items.filter((i) => i.placed).sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  const solution = isHost ? [...round.items].sort((a, b) => (a.value ?? 0) - (b.value ?? 0)) : [];
  const isLastRound = hol.roundIndex === hol.rounds.length - 1;

  // The newest item on the scale is highlighted and scrolled into view.
  const listRef = useRef<HTMLOListElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const [lastPlaced, setLastPlaced] = useState<string | null>(null);
  const placedIds = scale.map((i) => i.id).join(",");
  useEffect(() => {
    const ids = placedIds ? placedIds.split(",") : [];
    const before = seen.current;
    seen.current = new Set(ids);
    if (!before) return;
    const added = ids.find((id) => !before.has(id));
    if (!added) return;
    setLastPlaced(added);
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-id="${added}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [placedIds]);
  const everyoneOut = game.players.every((p) => lives(p.id) === 0);

  let banner;
  if (open.length === 0) banner = <StatusBanner tone="good">Alle Begriffe sind eingeordnet</StatusBanner>;
  else if (everyoneOut) banner = <StatusBanner>Niemand hat mehr Leben</StatusBanner>;
  else if (!isHost && lives(meId) === 0) banner = <StatusBanner tone="bad">Du hast keine Leben mehr</StatusBanner>;
  else if (!isHost && current?.id === meId) banner = <StatusBanner tone="accent">Du bist dran. Wo gehört der nächste Begriff hin?</StatusBanner>;
  else banner = <StatusBanner>{current?.name} ist dran <Lives count={lives(current?.id ?? null)} /></StatusBanner>;

  return (
    <ModeLayout
      fill
      board={
        <Scoreboard
          players={game.players}
          meId={meId}
          turnId={round.currentPlayerId}
          dimmed={(p) => lives(p.id) === 0}
          tag={(p) => (lives(p.id) === 0 ? <span className="normal-case">raus</span> : <Lives count={lives(p.id)} small />)}
          controls={
            isHost
              ? (p) => (
                  <>
                    <Button size="sm" variant="secondary" className="px-2" title="Leben abziehen" onClick={() => hostAction({ type: "hol.lives", playerId: p.id, delta: -1 })} disabled={lives(p.id) === 0}>
                      <Minus /><Heart />
                    </Button>
                    <Button size="sm" variant="secondary" className="px-2" title="Leben zurückgeben" onClick={() => hostAction({ type: "hol.lives", playerId: p.id, delta: 1 })} disabled={lives(p.id) === HOL_MAX_LIVES}>
                      <Plus /><Heart />
                    </Button>
                    <Button size="sm" variant="secondary" className="px-2.5" onClick={() => hostAction({ type: "hol.points", playerId: p.id, delta: -hol.points })}>
                      −{hol.points}
                    </Button>
                    <Button size="sm" variant="good" className="px-2.5" onClick={() => hostAction({ type: "hol.points", playerId: p.id, delta: hol.points })}>
                      +{hol.points}
                    </Button>
                  </>
                )
              : undefined
          }
        />
      }
      actions={
        isHost && (
          <>
            <Button variant="secondary" onClick={() => hostAction({ type: "hol.nextPlayer" })}>
              <SkipForward /> Nächster Spieler
            </Button>
            {isLastRound ? (
              <Button onClick={() => hostAction({ type: "showLeaderboard" })}>
                Zum Punktestand <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => hostAction({ type: "hol.nextRound" })}>
                Nächste Runde <ArrowRight />
              </Button>
            )}
          </>
        )
      }
    >
      <ModeHeading eyebrow={`Runde ${hol.roundIndex + 1} von ${hol.rounds.length}`} title={round.topic} meta={<Pill>Einheit: {round.unit}</Pill>} />
      {banner}

      {open.length > 0 && (
        <Panel className="p-3">
          <PanelTitle className="mb-2">Noch offen</PanelTitle>
          <div className="flex flex-wrap gap-1.5">
            {open.map((item) =>
              isHost ? (
                <button
                  key={item.id}
                  onClick={() => hostAction({ type: "hol.place", itemId: item.id })}
                  className="rounded-lg border border-line-strong bg-raised px-3 py-1.5 font-bold uppercase italic transition-colors hover:border-white"
                >
                  {item.label} <span className="ml-1 font-mono text-sm not-italic text-faint tabular-nums">{formatValue(item.value)}</span>
                </button>
              ) : (
                <span key={item.id} className="rounded-lg border border-line-strong bg-raised px-3 py-1.5 font-bold uppercase italic">
                  {item.label}
                </span>
              ),
            )}
          </div>
        </Panel>
      )}

      <Panel className="stripe flex min-h-40 flex-col p-3 pt-4 lg:min-h-32 lg:flex-1">
        <ScaleEnd icon={<ArrowUp />} text="Niedrigster Wert" />
        {/* Fixed height: a long scale scrolls inside, the page does not. */}
        <ol ref={listRef} className="scrollbar-thin my-1.5 max-h-[50vh] min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 lg:max-h-none">
          {scale.map((item, i) => (
            <li
              key={item.id}
              data-id={item.id}
              className={cn(
                "flex animate-pop items-center gap-3 rounded-lg border px-3 py-1.5",
                item.id === lastPlaced ? "border-accent bg-accent-strong/40" : "border-accent/30 bg-accent-soft",
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-strong font-mono text-xs font-bold">{i + 1}</span>
              <span className="min-w-0 flex-1 font-bold uppercase italic">
                {item.label}
                {item.initial && <span className="ml-2 font-mono text-xs font-normal not-italic normal-case text-faint">Startwert</span>}
              </span>
              <span className="text-lg font-black italic whitespace-nowrap tabular-nums">
                {formatValue(item.value)} <span className="hidden font-mono text-xs font-normal not-italic text-muted sm:inline">{round.unit}</span>
              </span>
              {isHost && !item.initial && (
                <button
                  onClick={() => hostAction({ type: "hol.unplace", itemId: item.id })}
                  className="grid size-7 place-items-center rounded-md text-faint hover:bg-bad-soft hover:text-bad"
                  title="Zurücknehmen"
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ol>
        <ScaleEnd icon={<ArrowDown />} text="Höchster Wert" />
      </Panel>

      {isHost && (
        <Panel className="p-3">
          <PanelTitle className="mb-2">Richtige Reihenfolge</PanelTitle>
          <div className="flex flex-wrap gap-1.5">
            {solution.map((item, i) => (
              <span key={item.id} className={cn("rounded-lg border px-2.5 py-1 font-mono text-sm", item.placed ? "border-green-500 bg-green-600 text-white" : "border-line bg-surface text-faint")}>
                {i + 1}. {item.label}
              </span>
            ))}
          </div>
        </Panel>
      )}
    </ModeLayout>
  );
}
