"use client";

import { ReactNode, useState } from "react";
import { Check, Copy, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoomStore } from "@/lib/store";
import { Player, SCREEN_LABELS } from "@/types/game";
import { Panel, PanelTitle, Pill } from "@/components/ui";

export function TopBar() {
  const state = useRoomStore((s) => s.state!);
  const role = useRoomStore((s) => s.role);
  const playerId = useRoomStore((s) => s.playerId);
  const me = state.players.find((p) => p.id === playerId);
  const online = state.players.filter((p) => p.connected).length;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <p className="headline gradient-text truncate pr-1 text-xl sm:text-2xl">{SCREEN_LABELS[state.screen]}</p>
          <p className="truncate text-xs font-semibold text-muted">Dümmer geht Immer</p>
        </div>
        {role === "host" ? (
          <div className="flex items-center gap-2">
            <Pill className="hidden sm:inline-flex">
              {online} / {state.players.length} online
            </Pill>
            <CopyCode code={state.roomCode} />
          </div>
        ) : (
          <div className="min-w-0 text-right">
            <p className="truncate font-bold">{me?.name}</p>
            <p className="font-mono text-xs text-muted">Raum {state.roomCode}</p>
          </div>
        )}
      </div>
      <ConnectionNotice />
    </header>
  );
}

function ConnectionNotice() {
  const status = useRoomStore((s) => s.status);
  const role = useRoomStore((s) => s.role);
  const hostConnected = useRoomStore((s) => s.state?.hostConnected ?? true);

  if (status === "offline") {
    return (
      <div className="flex items-center justify-center gap-2 bg-bad px-4 py-2 text-sm font-bold text-white">
        <WifiOff className="size-4" /> Verbindung unterbrochen. Verbinde neu …
      </div>
    );
  }
  if (role === "player" && !hostConnected) {
    return <div className="border-t border-line bg-raised px-4 py-2 text-center text-sm text-muted">Der Spielleiter ist gerade offline.</div>;
  }
  return null;
}

// Copies an invite link. Clipboard needs a secure context, so fall back to the old API.
export function CopyCode({ code, large }: { code: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const link = `${window.location.origin}/?code=${code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const area = document.createElement("textarea");
      area.value = link;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      title="Einladungslink kopieren"
      className={cn(
        "inline-flex items-center gap-3 rounded-xl border border-line bg-surface font-mono font-bold tracking-[0.3em] transition-colors hover:border-line-strong",
        large ? "h-20 px-7 text-4xl sm:text-5xl" : "h-10 px-3 text-sm",
      )}
    >
      {code}
      {copied ? <Check className="size-4 text-good" /> : <Copy className="size-4 text-faint" />}
    </button>
  );
}

// Page body for a mode: content plus a scoreboard column on wide screens.
export function ModeLayout({ children, side, actions }: { children: ReactNode; side?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <div className={cn("mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:gap-6", side && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
        <div className="min-w-0 space-y-4">{children}</div>
        {side && <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">{side}</aside>}
      </div>
      {actions && (
        <>
          <div className="h-24" />
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-black/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-4 py-3">{actions}</div>
          </div>
        </>
      )}
    </>
  );
}

export function StatusBanner({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "good" | "bad"; children: ReactNode }) {
  const tones = {
    neutral: "border-line bg-surface/60 text-muted",
    accent: "border-accent-light bg-accent-strong text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]",
    good: "border-good/50 bg-good-soft text-good",
    bad: "border-bad/50 bg-bad-soft text-bad",
  };
  return (
    <div className={cn("animate-pop rounded-xl border px-4 py-3 text-center font-bold uppercase tracking-wide", tones[tone])}>{children}</div>
  );
}

export function ModeHeading({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="label mb-2">{eyebrow}</p>
        <h2 className="headline text-3xl sm:text-5xl">{title}</h2>
      </div>
      {meta && <div className="flex flex-wrap gap-2">{meta}</div>}
    </div>
  );
}

interface ScoreboardProps {
  players: Player[];
  title?: string;
  meId?: string | null;
  turnId?: string | null;
  dimmed?: (p: Player) => boolean;
  tone?: (p: Player) => "good" | "bad" | null;
  note?: (p: Player) => ReactNode;
  controls?: (p: Player) => ReactNode;
  onSelect?: (p: Player) => void;
}

export function Scoreboard({ players, title = "Punkte dieser Runde", meId, turnId, dimmed, tone, note, controls, onSelect }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.modeScore - a.modeScore || a.name.localeCompare(b.name, "de"));

  return (
    <Panel className="p-4">
      <PanelTitle className="mb-3">{title}</PanelTitle>
      <ol className="space-y-1">
        {sorted.map((p, i) => {
          const Row = onSelect ? "button" : "div";
          return (
            <li key={p.id}>
              <Row
                {...(onSelect ? { onClick: () => onSelect(p), type: "button" as const } : {})}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  p.id === turnId ? "border-accent/50 bg-accent-soft" : p.id === meId ? "border-white/20 bg-white/10" : "border-transparent bg-black/20",
                  (dimmed?.(p) || tone?.(p) === "bad") && "border-red-900/50 bg-bad-soft",
                  tone?.(p) === "good" && "border-green-500/30 bg-green-950/40",
                  onSelect && "hover:border-line-strong",
                  dimmed?.(p) && "text-red-400",
                )}
              >
                <span className={cn("w-5 font-mono text-sm font-bold tabular-nums", i === 0 ? "text-gold" : i === 1 ? "text-silver" : i === 2 ? "text-bronze" : "text-faint")}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", p.connected ? "bg-good" : "bg-bad")} title={p.connected ? "online" : "offline"} />
                    <span className={cn("truncate text-lg font-bold uppercase italic", dimmed?.(p) && "line-through")}>{p.name}</span>
                    {p.id === meId && <span className="font-mono text-xs text-faint">(du)</span>}
                    {p.id === turnId && <span className="size-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
                  </span>
                  {note && <span className="mt-0.5 block text-sm text-muted">{note(p)}</span>}
                </span>
                <span className="text-2xl font-black italic tabular-nums">{p.modeScore}</span>
              </Row>
              {controls && <div className="mt-1 mb-3 flex flex-wrap gap-1.5 pl-8">{controls(p)}</div>}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
