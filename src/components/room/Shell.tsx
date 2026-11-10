"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Users, Volume2, VolumeX, WifiOff } from "lucide-react";
import { setSoundOn, soundOn, unlockAudio } from "@/lib/sounds";
import { AnimatedPoints } from "@/components/room/Cams";
import { cn } from "@/lib/utils";
import { useBoardStore, useHeaderStore, useRoomStore } from "@/lib/store";
import { Mode, Player, SCREEN_LABELS } from "@/types/game";
import { Panel, PanelTitle, Pill } from "@/components/ui";

export function TopBar({ overlay = false }: { overlay?: boolean }) {
  const state = useRoomStore((s) => s.state!);
  const role = useRoomStore((s) => s.role);
  const online = state.players.filter((p) => p.connected).length;

  return (
    <header className="z-30 shrink-0 border-b border-line bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-3 px-4">
        <Link href="/" className="hidden shrink-0 text-xs font-semibold text-muted hover:text-white sm:block">
          Dümmer geht Immer
        </Link>
        <span className="hidden h-5 w-px bg-line sm:block" />
        <p className="headline min-w-0 flex-1 truncate pr-1 text-xl sm:text-2xl">{SCREEN_LABELS[state.screen]}</p>
        {state.plan.length > 0 && state.screen !== "lobby" && state.screen !== "draw" && <PlanProgress plan={state.plan} current={state.modeIndex} done={state.screen === "finale"} />}
        {role === "host" && (
          <span className="hidden items-center gap-1.5 text-sm font-semibold text-muted sm:flex" title="Spieler online">
            <Users className="size-4" />
            <span className="tabular-nums">
              {online}/{state.players.length}
            </span>
          </span>
        )}
        {role === "viewer" && !overlay && <Pill>Zuschauer</Pill>}
        {!overlay && <SoundToggle />}
      </div>
      <ConnectionNotice />
    </header>
  );
}

// The show's modes as segments: done, current (with its number), still to come.
function PlanProgress({ plan, current, done }: { plan: Mode[]; current: number; done: boolean }) {
  const at = done ? plan.length : Math.max(current, 0);
  const info = useHeaderStore((s) => s.info);
  return (
    <div className="flex flex-col items-end gap-1">
    <div className="flex items-center gap-2" title={plan.map((m) => SCREEN_LABELS[m]).join(" → ")}>
      <div className="hidden gap-1 sm:flex">
        {plan.map((m, i) => (
          <span
            key={m}
            title={SCREEN_LABELS[m]}
            className={cn("h-1.5 w-7 rounded-full", i < at ? "bg-white/70" : i === at ? "bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-raised")}
          />
        ))}
      </div>
      <span className="font-mono text-sm text-muted tabular-nums">
        {done ? "Finale" : `Spiel ${at + 1}/${plan.length}`}
      </span>
    </div>
      {info && <span className="max-w-[50vw] truncate font-mono text-[11px] tracking-wide text-faint uppercase">{info}</span>}
    </div>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOn(soundOn()), []);
  return (
    <button
      type="button"
      title={on ? "Ton aus" : "Ton an"}
      onClick={() => {
        setSoundOn(!on);
        setOn(!on);
        unlockAudio();
      }}
      className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-white [&_svg]:size-4.5"
    >
      {on ? <Volume2 /> : <VolumeX />}
    </button>
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
  if (role !== "host" && !hostConnected) {
    return <div className="border-t border-line bg-raised px-4 py-2 text-center text-sm text-muted">Der Host ist gerade offline.</div>;
  }
  return null;
}

// Page body for a mode: the stage and, on the right, the points list for
// everyone (the host also gets its controls). `fill` makes the stage exactly
// as high as the space above the cams, so a child with `flex-1 min-h-0` can
// scroll inside instead of the page.
export function ModeLayout({
  children,
  side,
  board,
  actions,
  fill,
}: {
  children: ReactNode;
  side?: ReactNode;
  board?: ReactNode;
  actions?: ReactNode;
  fill?: boolean;
}) {
  const column = side || board;
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSlot(document.getElementById("host-actions")), []);

  return (
    <>
      <div
        className={cn(
          "mx-auto grid max-w-[1800px] gap-4 px-4 py-4 lg:gap-6",
          column && "lg:grid-cols-[minmax(0,1fr)_300px]",
          fill && "lg:h-full lg:grid-rows-[minmax(0,1fr)]",
        )}
      >
        <div className={cn("flex min-w-0 flex-col gap-3", fill && "lg:min-h-0")}>{children}</div>
        {column && (
          <aside className={cn("min-w-0 space-y-4 lg:self-start", fill && "lg:max-h-full lg:overflow-y-auto")}>
            {side}
            {board}
          </aside>
        )}
      </div>
      {actions && slot && createPortal(<div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-end gap-2 px-4 py-2.5">{actions}</div>, slot)}
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

// Title of a mode screen. The eyebrow ("Runde 2 von 5") goes to the top bar
// to leave more room for the stage.
export function ModeHeading({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: ReactNode }) {
  useEffect(() => {
    useHeaderStore.setState({ info: eyebrow });
  }, [eyebrow]);
  useEffect(() => () => useHeaderStore.setState({ info: null }), []);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 className="headline min-w-0 text-2xl sm:text-3xl">{title}</h2>
      {meta && <div className="flex flex-wrap gap-2">{meta}</div>}
    </div>
  );
}

interface ScoreboardProps {
  players?: Player[];
  meId?: string | null;
  title?: string;
  turnId?: string | null;
  dimmed?: (p: Player) => boolean;
  tone?: (p: Player) => "good" | "bad" | null;
  note?: (p: Player) => ReactNode;
  tag?: (p: Player) => ReactNode;
  score?: (p: Player) => number;
  controls?: (p: Player) => ReactNode;
  onSelect?: (p: Player) => void;
}

// Publishes what the mode says about each player to the cam tiles. The host
// also gets the full list with the controls in the column on the right.
export function Scoreboard({ players = [], title, meId, turnId, dimmed, tone, note, tag, score, controls: hostControls, onSelect: hostSelect }: ScoreboardProps) {
  const role = useRoomStore((s) => s.role);
  useEffect(() => {
    useBoardStore.setState({ board: { turnId, dimmed, tone, note, tag, score } });
  });
  useEffect(() => () => useBoardStore.setState({ board: null }), []);
  // Everyone sees the list; controls and the host's title only for the host.
  const isHost = role === "host";
  const controls = isHost ? hostControls : undefined;
  const onSelect = isHost ? hostSelect : undefined;
  if (!isHost) title = undefined;
  title ??= "Punkte dieser Runde";

  const points = (p: Player) => score?.(p) ?? p.modeScore;
  const sorted = [...players].sort((a, b) => points(b) - points(a) || a.name.localeCompare(b.name, "de"));
  return (
    <Panel className="p-3">
      <PanelTitle className="mb-2">{title}</PanelTitle>
      <ol className="space-y-1">
        {sorted.map((p, i) => {
          const Row = onSelect ? "button" : "div";
          return (
            <li key={p.id}>
              <Row
                {...(onSelect ? { onClick: () => onSelect(p), type: "button" as const } : {})}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
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
                    <span className={cn("truncate font-bold uppercase italic", dimmed?.(p) && "line-through")}>{p.name}</span>
                    {tag && <span className="flex shrink-0 items-center text-sm">{tag(p)}</span>}
                  </span>
                  {note?.(p) != null && <span className="mt-0.5 block text-sm text-muted">{note(p)}</span>}
                </span>
                <AnimatedPoints value={points(p)} bubble={false} className="text-xl font-black italic" />
              </Row>
              {controls && <div className="mt-1 mb-2 flex flex-wrap gap-1.5 pl-8">{controls(p)}</div>}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
