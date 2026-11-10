"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Panel, PanelTitle, Spinner } from "@/components/ui";
import { Avatar, DetailStats, StatTiles } from "@/components/stats";
import { useApi } from "@/lib/me";
import { PlayerStats } from "@/types/stats";

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const { data: stats, error } = useApi<PlayerStats>(`/api/players/${id}`);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <Link href="/stats" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-white">
        <ArrowLeft className="size-4" /> Bestenliste
      </Link>
      {error ? (
        <p className="py-10 text-center text-muted">Spieler nicht gefunden.</p>
      ) : !stats ? (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mb-6 flex items-center gap-4">
            <Avatar name={stats.name} src={stats.avatar} className="size-16 text-2xl" />
            <h1 className="headline min-w-0 truncate text-4xl sm:text-5xl">{stats.name}</h1>
          </div>
          <Panel className="p-5">
            <StatTiles stats={stats} />
          </Panel>
          {stats.shows > 0 && (
            <>
              <Panel className="p-5">
                <DetailStats stats={stats} />
              </Panel>
              <Panel className="p-5">
                <PanelTitle className="mb-3">Letzte Shows</PanelTitle>
                <ul className="space-y-1">
                  {stats.history.map((h) => (
                    <li key={h.showId} className="flex items-baseline gap-3 rounded-lg bg-black/20 px-3 py-2">
                      <span className="font-mono text-sm text-muted">{new Date(h.endedAt).toLocaleDateString("de-DE")}</span>
                      <span className="flex-1 font-bold">
                        Platz {h.place} von {h.players}
                      </span>
                      <span className="font-mono tabular-nums">{h.total} P</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}
        </div>
      )}
    </main>
  );
}
