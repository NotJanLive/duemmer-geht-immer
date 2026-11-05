"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Eye, Timer } from "lucide-react";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction, playerAction } from "@/lib/socket";
import { useServerNow } from "@/lib/useServerNow";
import { Button, Panel, Pill } from "@/components/ui";
import { ModeHeading, ModeLayout, Scoreboard, StatusBanner } from "@/components/room/Shell";
import GeoMap, { MapLine, MapMarker } from "@/components/GeoMap";
import { MAPS } from "@/types/pool";

// Pin colours per player, in alphabetical order of the names. Your own is blue.
const PLAYER_COLORS = ["#f97316", "#ec4899", "#a855f7", "#14b8a6", "#eab308", "#ef4444", "#84cc16", "#06b6d4"];
const OWN_COLOR = "#3b82f6";
const TARGET_COLOR = "#22c55e";

// Reveal timeline in ms: pins pop one after another, then the target drops,
// then the lines are drawn and the numbers count up.
const PIN_STEP = 180;
const TARGET_GAP = 300;
const LINE_GAP = 550;
const LINE_STEP = 120;
const COUNT_GAP = 400;
const COUNT_MS = 1100;

const km = (d: number) => (d < 10 ? `${d.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km` : `${Math.round(d).toLocaleString("de-DE")} km`);

// Counts from 0 to `value` after `delay`, easing out. Restarts when `run` changes.
function CountUp({ value, delay, run, format }: { value: number; delay: number; run: string; format: (n: number) => string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / COUNT_MS));
      setShown(value * (1 - (1 - p) ** 3));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay, run]);
  return <>{format(shown)}</>;
}

export default function Geo() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const geo = game.geo!;
  const isHost = role === "host";
  const now = useServerNow(!geo.revealed);
  const left = Math.max(0, Math.ceil((geo.endsAt - now) / 1000));
  const open = !geo.revealed && left > 0;
  const isLast = geo.index === geo.total - 1;
  const mine = meId ? geo.guesses[meId] : null;
  const myResult = meId ? geo.results[meId] : undefined;
  const pinned = game.players.filter((p) => p.id in geo.guesses).length;
  const target = geo.place.lat !== null && geo.place.lng !== null ? { lat: geo.place.lat, lng: geo.place.lng } : null;

  const order = [...game.players].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const colorOf = (id: string) => (id === meId ? OWN_COLOR : PLAYER_COLORS[order.findIndex((p) => p.id === id) % PLAYER_COLORS.length]);
  const run = `${geo.index}`;

  // Who set a pin, in a stable order, for the reveal timeline.
  const guessed = order.filter((p) => geo.guesses[p.id]);
  const targetDelay = guessed.length * PIN_STEP + TARGET_GAP;
  const lineDelay = (i: number) => targetDelay + LINE_GAP + i * LINE_STEP;
  const countDelay = lineDelay(guessed.length) + COUNT_GAP;

  const markers: MapMarker[] = [];
  const lines: MapLine[] = [];
  if (geo.revealed && target) {
    guessed.forEach((p, i) => {
      const g = geo.guesses[p.id]!;
      markers.push({ id: `${run}-${p.id}`, ...g, color: colorOf(p.id), label: p.name, delay: i * PIN_STEP });
      const r = geo.results[p.id];
      lines.push({ id: `${run}-${p.id}`, from: g, to: target, color: colorOf(p.id), label: r ? km(r.distanceKm) : undefined, delay: lineDelay(i) });
    });
    markers.push({ id: `${run}-target`, ...target, color: TARGET_COLOR, label: geo.place.name, target: true, delay: targetDelay });
  } else if (isHost) {
    // The host watches the pins come in live.
    for (const p of guessed) markers.push({ id: `${run}-${p.id}`, ...geo.guesses[p.id]!, color: colorOf(p.id), label: p.name, delay: 0 });
  } else if (mine) {
    markers.push({ id: `${run}-mine`, ...mine, color: OWN_COLOR, delay: 0 });
  }

  let banner = null;
  if (!isHost) {
    if (geo.revealed) {
      banner = myResult ? (
        <StatusBanner tone={myResult.points > 0 ? "good" : "bad"}>
          {km(myResult.distanceKm)} daneben, +{myResult.points} {myResult.points === 1 ? "Punkt" : "Punkte"}
        </StatusBanner>
      ) : (
        <StatusBanner tone="bad">Kein Pin gesetzt</StatusBanner>
      );
    } else if (!open) {
      banner = <StatusBanner>{mine ? "Zeit um. Warte auf die Auflösung." : "Zeit um, kein Pin gesetzt"}</StatusBanner>;
    } else {
      banner = <StatusBanner tone={mine ? "accent" : "neutral"}>{mine ? "Pin gesetzt. Du kannst ihn noch verschieben." : "Tippe auf die Karte"}</StatusBanner>;
    }
  }

  return (
    <ModeLayout
      side={
        <Scoreboard
          players={game.players}
          meId={meId}
          tone={(p) => (geo.revealed ? (geo.results[p.id] ? "good" : "bad") : null)}
          note={(p) => {
            if (geo.revealed) {
              const r = geo.results[p.id];
              if (!r) return "Kein Pin";
              return (
                <span className="inline-flex items-baseline gap-2 font-mono tabular-nums">
                  <span>
                    <CountUp value={r.distanceKm} delay={countDelay} run={run} format={(n) => km(n)} />
                  </span>
                  <span className="font-bold text-green-500">
                    +<CountUp value={r.points} delay={countDelay} run={run} format={(n) => String(Math.round(n))} />
                  </span>
                </span>
              );
            }
            return p.id in geo.guesses ? <span className="font-bold uppercase text-green-500">Pin gesetzt</span> : "Sucht noch …";
          }}
        />
      }
      actions={
        isHost &&
        (geo.revealed ? (
          isLast ? (
            <Button size="lg" className="w-full sm:w-auto" onClick={() => hostAction({ type: "showLeaderboard" })}>
              Zum Punktestand <ArrowRight />
            </Button>
          ) : (
            <Button size="lg" className="w-full sm:w-auto" onClick={() => hostAction({ type: "geo.next" })}>
              Nächster Ort <ArrowRight />
            </Button>
          )
        ) : (
          <Button size="lg" className="w-full sm:w-auto" onClick={() => hostAction({ type: "geo.reveal" })}>
            <Eye /> Auflösen ({pinned}/{game.players.length} gesetzt)
          </Button>
        ))
      }
    >
      <ModeHeading
        eyebrow={`${geo.category} · Ort ${geo.index + 1} von ${geo.total}`}
        title={geo.place.name}
        meta={
          <>
            <Pill>{MAPS[geo.map].label}</Pill>
            {!geo.revealed && (
              <Pill tone={left > 5 ? "accent" : "bad"}>
                <Timer className="size-3.5" /> {left > 0 ? `${left} s` : "Zeit um"}
              </Pill>
            )}
          </>
        }
      />

      {geo.place.image && (
        <Panel className="overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={geo.place.image} alt="" className="max-h-[45vh] w-full object-contain" />
        </Panel>
      )}

      {banner}

      <Panel className="stripe p-2 sm:p-3">
        <GeoMap
          map={geo.map}
          markers={markers}
          lines={lines}
          onPick={!isHost && open ? (pos) => playerAction({ type: "geo.guess", ...pos }) : undefined}
        />
      </Panel>
    </ModeLayout>
  );
}
