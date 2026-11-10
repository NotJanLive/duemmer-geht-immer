"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Copy, Crown, Eye, LogOut, Play, Settings, Trophy } from "lucide-react";
import { Button, Panel, PanelTitle, Spinner } from "@/components/ui";
import { Avatar, LeaderboardTable, StatTiles } from "@/components/stats";
import { getSocket } from "@/lib/socket";
import { useApi, useMe } from "@/lib/me";
import { useRoomStore } from "@/lib/store";
import { LeaderboardRow, Me, PlayerStats } from "@/types/stats";
import { SCREEN_LABELS } from "@/types/game";

const ERRORS: Record<string, string> = {
  member: "Nur Mitglieder unserer Discord-Server können mitspielen.",
  state: "Die Anmeldung ist abgelaufen. Versuch es noch mal.",
  login: "Die Anmeldung hat nicht geklappt.",
  setup: "Die Discord-Anmeldung ist auf dem Server noch nicht eingerichtet.",
};

function Title({ small }: { small?: boolean }) {
  return (
    <h1 className={small ? "headline title-text text-3xl sm:text-4xl" : "headline title-text pb-1 text-center text-5xl sm:text-7xl"}>
      Dümmer{small ? " " : <br />}geht immer
    </h1>
  );
}

function Login() {
  const error = useSearchParams().get("error");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <Title />
      <div className="mt-12 animate-rise space-y-4">
        {error && <p className="text-center font-medium text-bad">{ERRORS[error] ?? ERRORS.login}</p>}
        <Button size="lg" className="w-full bg-[#5865F2] text-white hover:bg-[#4752c4]" onClick={() => window.location.assign("/auth/login")}>
          <DiscordLogo /> Mit Discord anmelden
        </Button>
      </div>
    </main>
  );
}

function DiscordLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-5">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.5 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.7.1 18.2a19.9 19.9 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.8-3.6-13.8ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}

// Listens to the live show status while the dashboard is open.
function useLive() {
  const live = useRoomStore((s) => s.live);
  useEffect(() => {
    const socket = getSocket();
    socket.on("live", (info) => useRoomStore.setState({ live: info }));
    if (!socket.connected) socket.connect();
    return () => {
      socket.off("live");
    };
  }, []);
  return live;
}

function LiveCard({ me }: { me: Me }) {
  const live = useLive();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = () => {
    setBusy(true);
    getSocket().emit("createShow", (r) => {
      if (r.ok) router.push("/show");
      else {
        setError(r.error ?? "Das hat nicht geklappt");
        setBusy(false);
      }
    });
  };

  if (!live) {
    return (
      <Panel className="stripe flex min-h-40 items-center justify-center p-6">
        <Spinner />
      </Panel>
    );
  }

  if (!live.active) {
    return (
      <Panel className="stripe p-6 sm:p-8">
        <p className="label">Live</p>
        <h2 className="headline mt-2 text-3xl sm:text-4xl">Gerade keine Show</h2>
        {me.isHost ? (
          <Button size="lg" className="mt-6 w-full sm:w-auto" disabled={busy} onClick={start}>
            <Play /> Show starten
          </Button>
        ) : (
          <p className="mt-3 text-muted">Sobald eine Quizshow startet, kannst du hier beitreten.</p>
        )}
        {error && <p className="mt-3 font-medium text-bad">{error}</p>}
      </Panel>
    );
  }

  const joined = live.playerIds?.includes(me.id);
  const lobby = live.screen === "lobby";
  return (
    <Panel className="stripe relative overflow-hidden p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <span className="size-2.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
        <p className="label">Live · {live.screen && SCREEN_LABELS[live.screen]}</p>
      </div>
      <h2 className="headline mt-2 text-4xl sm:text-5xl">Quizshow läuft</h2>
      <p className="mt-2 text-muted">
        Host: {live.host?.name} · {live.playerIds?.length ?? 0} Spieler
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {me.isHost ? (
          <Button size="lg" onClick={() => router.push("/show")}>
            <Crown /> Zur Show
          </Button>
        ) : joined ? (
          <Button size="lg" onClick={() => router.push("/show")}>
            Weiterspielen <ArrowRight />
          </Button>
        ) : lobby ? (
          <Button size="lg" onClick={() => router.push("/show?join=1")}>
            Beitreten <ArrowRight />
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={() => router.push("/show")}>
            <Eye /> Zuschauen
          </Button>
        )}
      </div>
    </Panel>
  );
}

function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const area = document.createElement("textarea");
      area.value = url;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      {copied ? <Check className="text-good" /> : <Copy />} {label}
    </Button>
  );
}

function Dashboard({ me }: { me: Me }) {
  const router = useRouter();
  const { data: stats } = useApi<PlayerStats>(`/api/players/${me.id}`);
  const { data: board } = useApi<LeaderboardRow[]>("/api/leaderboard");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <header className="mb-8 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <Title small />
        </div>
        <Link href={`/stats/${me.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-surface">
          <span className="hidden text-right sm:block">
            <span className="block font-bold">{me.name}</span>
            {me.isHost && <span className="block font-mono text-xs text-gold">Host</span>}
          </span>
          <Avatar name={me.name} src={me.avatar} className="size-10" />
        </Link>
        <a href="/auth/logout" title="Abmelden" className="grid size-10 place-items-center rounded-lg text-faint hover:bg-surface hover:text-white">
          <LogOut className="size-4.5" />
        </a>
      </header>

      <div className="space-y-4">
        <LiveCard me={me} />

        {me.isHost && (
          <Panel className="flex flex-wrap items-center gap-2 p-4">
            <PanelTitle className="mr-auto">Host</PanelTitle>
            {me.overlayUrl && <CopyLink url={me.overlayUrl} label="OBS-Overlay-Link" />}
            <Button variant="secondary" size="sm" onClick={() => router.push("/admin")}>
              <Settings /> Fragen verwalten
            </Button>
          </Panel>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] [&>*]:min-w-0">
          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <PanelTitle>Deine Stats</PanelTitle>
              <Link href={`/stats/${me.id}`} className="text-sm text-muted hover:text-white">
                Alle Stats
              </Link>
            </div>
            {stats ? <StatTiles stats={stats} /> : <p className="py-6 text-center text-muted">Noch keine Show gespielt.</p>}
          </Panel>

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <PanelTitle className="flex items-center gap-2">
                <Trophy className="size-4 text-gold" /> Bestenliste
              </PanelTitle>
              <Link href="/stats" className="text-sm text-muted hover:text-white">
                Ganze Liste
              </Link>
            </div>
            {board ? (
              board.length ? (
                <LeaderboardTable rows={board.slice(0, 5)} meId={me.id} compact />
              ) : (
                <p className="py-6 text-center text-muted">Noch keine Show gespielt.</p>
              )
            ) : (
              <div className="grid place-items-center py-6">
                <Spinner />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}

function Home() {
  const { me, loading } = useMe();
  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <Spinner />
      </main>
    );
  }
  return me ? <Dashboard me={me} /> : <Login />;
}

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
