"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { LeaderboardRow, PlayerStats } from "@/types/stats";
import { MODE_ORDER, SCREEN_LABELS } from "@/types/game";

const fmt = (n: number, digits = 0) => n.toLocaleString("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function Avatar({ name, src, className }: { name: string; src: string | null; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn("shrink-0 rounded-full bg-raised object-cover", className)} />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-raised font-black uppercase", className)}>{name.slice(0, 1)}</span>
  );
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: "gold" }) {
  return (
    <div className="rounded-xl border border-line bg-black/30 px-4 py-3">
      <p className="label">{label}</p>
      <p className={cn("headline mt-1 text-3xl tabular-nums", tone === "gold" && "text-gold")}>{value}</p>
    </div>
  );
}

export function StatTiles({ stats }: { stats: PlayerStats }) {
  if (stats.shows === 0) return <p className="py-6 text-center text-muted">Noch keine Show gespielt.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Tile label="Siege" value={stats.wins} tone="gold" />
      <Tile label="Podest" value={stats.podiums} />
      <Tile label="Shows" value={stats.shows} />
      <Tile label="Ø Platz" value={fmt(stats.avgPlace, 1)} />
      <Tile label="Ø Punkte" value={fmt(stats.points / stats.shows)} />
      <Tile label="Bestwert" value={stats.bestTotal} />
    </div>
  );
}

export function DetailStats({ stats }: { stats: PlayerStats }) {
  const t = stats.tally;
  const rows: [string, string][] = [];
  if (t.wwmSeen) rows.push(["Millionär richtig", `${fmt((t.wwmCorrect / t.wwmSeen) * 100)} % (${t.wwmCorrect} von ${t.wwmSeen})`]);
  if (t.geoGuesses) rows.push(["Wo liegt das? Ø daneben", `${fmt(t.geoKm / t.geoGuesses)} km`]);
  if (t.picSolved) rows.push(["Bilder erkannt", String(t.picSolved)]);
  if (t.jeoCorrect + t.jeoWrong) rows.push(["Jeopardy", `${t.jeoCorrect} richtig, ${t.jeoWrong} falsch`]);
  if (t.songSeen) rows.push(["Songs erkannt", `${t.songSolved ?? 0} von ${t.songSeen}${t.songSolved ? `, Ø Stufe ${fmt(t.songStages / t.songSolved, 1)}` : ""}`]);
  const modes = MODE_ORDER.filter((m) => stats.modes[m]);

  return (
    <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
      <div>
        <p className="label mb-2">Punkte pro Spiel (Ø)</p>
        <ul className="space-y-1">
          {modes.map((m) => {
            const v = stats.modes[m]!;
            return (
              <li key={m} className="flex items-baseline justify-between gap-3 rounded-lg bg-black/20 px-3 py-2">
                <span className="truncate font-bold uppercase italic">{SCREEN_LABELS[m]}</span>
                <span className="font-mono tabular-nums">
                  {fmt(v.total / v.shows, 1)} <span className="text-faint">({v.shows}×)</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {rows.length > 0 && (
        <div>
          <p className="label mb-2">Details</p>
          <ul className="space-y-1">
            {rows.map(([k, v]) => (
              <li key={k} className="flex items-baseline justify-between gap-3 rounded-lg bg-black/20 px-3 py-2">
                <span className="truncate text-muted">{k}</span>
                <span className="font-mono tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const rankColor = (i: number) => (i === 0 ? "text-gold" : i === 1 ? "text-silver" : i === 2 ? "text-bronze" : "text-faint");

export function LeaderboardTable({ rows, meId, compact }: { rows: LeaderboardRow[]; meId?: string; compact?: boolean }) {
  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.id}>
          <Link
            href={`/stats/${r.id}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors hover:border-line-strong",
              r.id === meId ? "border-white/20 bg-white/10" : "border-transparent bg-black/20",
            )}
          >
            <span className={cn("w-6 font-mono text-sm font-bold tabular-nums", rankColor(i))}>{i + 1}</span>
            <Avatar name={r.name} src={r.avatar} className="size-8" />
            <span className="min-w-0 flex-1 truncate font-bold uppercase italic">{r.name}</span>
            {!compact && (
              <span className="hidden font-mono text-sm text-muted tabular-nums sm:inline">
                {r.shows} Shows · {r.podiums}× Podest · Ø {fmt(r.avgPoints)} P
              </span>
            )}
            <span className="headline w-12 text-right text-xl tabular-nums text-gold">{r.wins}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
