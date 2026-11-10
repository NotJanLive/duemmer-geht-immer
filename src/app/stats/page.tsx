"use client";

import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { Panel, PanelTitle, Spinner } from "@/components/ui";
import { LeaderboardTable } from "@/components/stats";
import { useApi, useMe } from "@/lib/me";
import { LeaderboardRow, ShowSummary } from "@/types/stats";
import { SCREEN_LABELS } from "@/types/game";

export default function StatsPage() {
  const { me } = useMe();
  const { data: board, error } = useApi<LeaderboardRow[]>("/api/leaderboard");
  const { data: shows } = useApi<ShowSummary[]>("/api/shows?limit=10");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-white">
        <ArrowLeft className="size-4" /> Zurück
      </Link>
      <h1 className="headline mb-6 text-4xl sm:text-5xl">Bestenliste</h1>

      <Panel className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <PanelTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-gold" /> Nach Siegen
          </PanelTitle>
          <span className="label">Siege</span>
        </div>
        {error ? (
          <p className="py-6 text-center text-muted">Bitte melde dich an.</p>
        ) : !board ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : board.length ? (
          <LeaderboardTable rows={board} meId={me?.id} />
        ) : (
          <p className="py-6 text-center text-muted">Noch keine Show gespielt.</p>
        )}
      </Panel>

      {shows && shows.length > 0 && (
        <>
          <h2 className="headline mt-10 mb-4 text-2xl">Letzte Shows</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {shows.map((s) => (
              <Panel key={s.id} className="p-4">
                <p className="label">
                  {new Date(s.endedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} ·{" "}
                  {s.plan.map((m) => SCREEN_LABELS[m]).join(", ")}
                </p>
                <ol className="mt-3 space-y-1">
                  {s.players.map((p) => (
                    <li key={p.id} className="flex items-baseline gap-3">
                      <span className="w-5 font-mono text-sm text-faint">{p.place}</span>
                      <Link href={`/stats/${p.id}`} className="min-w-0 flex-1 truncate font-bold uppercase italic hover:underline">
                        {p.name}
                      </Link>
                      <span className="font-mono tabular-nums">{p.total}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
