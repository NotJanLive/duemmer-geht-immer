"use client";

import { ArrowRight, Eye, Timer } from "lucide-react";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction, playerAction } from "@/lib/socket";
import { useServerNow } from "@/lib/useServerNow";
import { Button, Panel, Pill } from "@/components/ui";
import { ModeHeading, ModeLayout, Scoreboard, StatusBanner } from "@/components/room/Shell";
import GeoMap, { MapCamera, MapLine, MapMarker } from "@/components/GeoMap";
import { MAPS } from "@/types/pool";
import { GEO_BACK_MS, GEO_INTRO_MS, GEO_LINE_MS, geoTimeline } from "@/lib/geoReveal";

// Pin colours per player, in alphabetical order of the names. Your own is blue.
const PLAYER_COLORS = ["#f97316", "#ec4899", "#a855f7", "#14b8a6", "#eab308", "#ef4444", "#84cc16", "#06b6d4"];
const OWN_COLOR = "#3b82f6";
const TARGET_COLOR = "#22c55e";

// Reveal, one player after another, farthest first (timeline in
// lib/geoReveal.ts): the map zooms to the place, then for each player it comes
// back to the place, the line runs out to their pin while the map follows and
// the distance counts up in the list, then their points show. At the end the
// map shows everyone.
const INTRO_MS = GEO_INTRO_MS;
const BACK_MS = GEO_BACK_MS;
const LINE_MS = GEO_LINE_MS;
const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

const km = (d: number) => (d < 10 ? `${d.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km` : `${Math.round(d).toLocaleString("de-DE")} km`);

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
  const guessed = order.filter((p) => geo.guesses[p.id]);

  // Reveal timeline.
  const revealNow = useServerNow(geo.revealed && geo.revealedAt !== null, 40);
  const { sequence, elapsed, done, stepAt, progressOf, shown, current, score } = geoTimeline(game, revealNow);

  const markers: MapMarker[] = [];
  const lines: MapLine[] = [];
  let camera: MapCamera | null = null;
  if (geo.revealed && target) {
    markers.push({ id: `${run}-target`, ...target, color: TARGET_COLOR, label: geo.place.name, target: true, delay: Math.min(0, -elapsed) });
    sequence.forEach((p, i) => {
      if (elapsed < stepAt(i)) return;
      const g = geo.guesses[p.id]!;
      const r = geo.results[p.id];
      const lineStart = stepAt(i) + BACK_MS;
      markers.push({ id: `${run}-${p.id}`, ...g, color: colorOf(p.id), label: p.name, delay: Math.min(0, stepAt(i) - elapsed) });
      if (elapsed >= lineStart) {
        lines.push({
          id: `${run}-${p.id}`,
          from: target,
          to: g,
          color: colorOf(p.id),
          label: r ? km(r.distanceKm) : undefined,
          delay: Math.min(0, lineStart - elapsed),
          duration: LINE_MS,
        });
      }
    });
    if (elapsed < INTRO_MS) camera = { key: `${run}-intro`, points: [target], duration: INTRO_MS - 200 };
    else if (done) camera = { key: `${run}-all`, points: [target, ...guessed.map((p) => geo.guesses[p.id]!)], duration: 1500 };
    else {
      const t = elapsed - stepAt(current);
      const pin = geo.guesses[sequence[current].id]!;
      camera = t < BACK_MS ? { key: `${run}-${current}-back`, points: [target], duration: BACK_MS } : { key: `${run}-${current}-line`, points: [target, pin], duration: LINE_MS };
    }
  } else {
    // A new place starts on the whole map again.
    camera = { key: `${run}-home`, points: [], duration: 900 };
  }
  if (!geo.revealed && isHost) {
    // The host watches the pins come in live.
    for (const p of guessed) markers.push({ id: `${run}-${p.id}`, ...geo.guesses[p.id]!, color: colorOf(p.id), label: p.name, delay: 0 });
  } else if (!geo.revealed && mine) {
    markers.push({ id: `${run}-mine`, ...mine, color: OWN_COLOR, delay: 0 });
  }

  let banner = null;
  if (!isHost) {
    if (geo.revealed && !(meId && shown(meId))) {
      banner = null;
    } else if (geo.revealed) {
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
      banner = mine ? <StatusBanner tone="accent">Pin gesetzt. Du kannst ihn noch verschieben.</StatusBanner> : null;
    }
  }

  return (
    <ModeLayout
      fill
      board={
        <Scoreboard
          players={game.players}
          meId={meId}
          tone={(p) => (geo.revealed && progressOf(p.id) >= 1 ? (geo.results[p.id] ? "good" : "bad") : null)}
          turnId={!done && current >= 0 && elapsed - stepAt(current) >= BACK_MS ? sequence[current]?.id : null}
          // Points this place gave only count once the player's line is done.
          score={score}
          note={(p) => {
            if (geo.revealed) {
              const r = geo.results[p.id];
              if (!r) return done ? "Kein Pin" : "…";
              const t = progressOf(p.id);
              if (t <= 0) return "…";
              return (
                <span className="inline-flex items-baseline gap-2 font-mono tabular-nums">
                  <span>{km(r.distanceKm * ease(t))}</span>
                  {t >= 1 && <span className="animate-pop font-bold text-green-500">+{r.points}</span>}
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
          <img src={geo.place.image} alt="" className="max-h-[45vh] w-full object-contain lg:max-h-[22vh]" />
        </Panel>
      )}

      {banner}

      {/* The map is as big as the space left above the cams. */}
      <Panel className="stripe flex flex-col p-2 sm:p-3 lg:min-h-0 lg:flex-1">
        <div className="fit-box">
        <GeoMap
          map={geo.map}
          camera={camera}
          markers={markers}
          lines={lines}
          onPick={!!meId && open ? (pos) => playerAction({ type: "geo.guess", ...pos }) : undefined}
        />
        </div>
      </Panel>
    </ModeLayout>
  );
}
