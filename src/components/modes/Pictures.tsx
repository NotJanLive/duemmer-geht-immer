"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Eye, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction, playerAction } from "@/lib/socket";
import { useServerNow } from "@/lib/useServerNow";
import { Button, Panel } from "@/components/ui";
import { ModeHeading, ModeLayout, Scoreboard, StatusBanner } from "@/components/room/Shell";
import { PicState, picPoints, picProgress } from "@/types/game";
import { PICTURE_KINDS } from "@/types/pool";

const COLS = 8;
const ROWS = 6;

// Small seeded random, so every device uncovers the same tiles in the same order.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draws the picture with big pixels that get finer until it is sharp.
function PixelImage({ src, progress }: { src: string; progress: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !img) return;
    // 6 pixels across at the start, full size at the end, growing evenly.
    const width = Math.max(6, Math.round(6 * (img.naturalWidth / 6) ** (progress ** 1.3)));
    const height = Math.max(1, Math.round((width * img.naturalHeight) / img.naturalWidth));
    el.width = width;
    el.height = height;
    el.getContext("2d")?.drawImage(img, 0, 0, width, height);
  }, [img, progress]);

  return <canvas ref={canvas} className="absolute inset-0 size-full object-contain" style={{ imageRendering: "pixelated" }} />;
}

function PictureView({ pic, progress }: { pic: PicState; progress: number }) {
  const order = useMemo(() => {
    const rand = seeded(pic.seed);
    const tiles = Array.from({ length: COLS * ROWS }, (_, i) => i);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles.map((tile, rank) => ({ tile, rank })).sort((a, b) => a.tile - b.tile).map((t) => t.rank);
  }, [pic.seed]);

  if (!pic.image) {
    return <div className="grid aspect-video w-full place-items-center rounded-xl bg-zinc-950 text-muted">Gleich geht&apos;s los</div>;
  }

  const shown = Math.floor(progress * COLS * ROWS);

  if (pic.kind === "pixel" && progress < 1) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <PixelImage src={pic.image} progress={progress} />
      </div>
    );
  }

  // Blur: heavy blur and grey at the start, grey until 30 %, in full colour
  // from 70 %, sharp at the end.
  // The blur is relative to the box width, so phones and big screens match.
  const blur = pic.kind === "blur" && progress < 1;
  const blurStyle = blur
    ? {
        filter: `blur(${(7 * (1 - progress) ** 1.8).toFixed(3)}cqw) grayscale(${Math.min(1, Math.max(0, (0.7 - progress) / 0.4)).toFixed(3)})`,
        transform: "scale(1.08)",
        transition: "filter 0.3s linear",
      }
    : undefined;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black" style={{ containerType: "inline-size" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pic.image}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-contain select-none"
        style={blurStyle}
      />
      {pic.kind === "reveal" && (
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
          {order.map((rank, i) => (
            <div key={i} className={cn("border border-zinc-800 bg-zinc-900 transition-opacity duration-500", rank < shown && "opacity-0")} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Pictures() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const pic = game.pic!;
  const isHost = role === "host";
  const now = useServerNow(pic.status === "running");
  const elapsed = pic.elapsedMs + (pic.runningSince ? Math.max(0, now - pic.runningSince) : 0);
  const progress = pic.status === "solved" ? 1 : picProgress(pic, elapsed);
  const name = (id: string | null) => game.players.find((p) => p.id === id)?.name ?? "";
  const isLast = pic.roundIndex === pic.roundCount - 1 && pic.itemIndex === pic.itemCount - 1;
  const myBuzz = pic.queue.find((b) => b.playerId === meId);
  const wrong = new Set(pic.queue.filter((b) => b.wrong).map((b) => b.playerId));

  const canBuzz = !isHost && !!meId && (pic.status === "running" || pic.status === "paused") && !myBuzz;
  useEffect(() => {
    if (!canBuzz) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        playerAction({ type: "pic.buzz" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canBuzz]);

  let status = null;
  if (pic.status === "paused" && pic.answeringId) status = <StatusBanner tone="accent">{pic.answeringId === meId ? "Du bist dran!" : `${name(pic.answeringId)} ist dran`}</StatusBanner>;
  else if (pic.status === "solved")
    status = pic.winnerId ? (
      <StatusBanner tone="good">{pic.winnerId === meId ? "Richtig!" : name(pic.winnerId)} +{pic.awarded} {pic.awarded === 1 ? "Punkt" : "Punkte"}: {pic.answer}</StatusBanner>
    ) : (
      <StatusBanner>Lösung: {pic.answer}</StatusBanner>
    );

  return (
    <ModeLayout
      side={
        <>
          <BuzzQueue pic={pic} name={name} meId={meId} />
          <Scoreboard players={game.players} meId={meId} turnId={pic.answeringId} dimmed={(p) => pic.status !== "solved" && wrong.has(p.id)} />
        </>
      }
      actions={isHost && <HostActions pic={pic} isLast={isLast} />}
    >
      <ModeHeading
        eyebrow={`${pic.category} · Bild ${pic.itemIndex + 1} von ${pic.itemCount} · Runde ${pic.roundIndex + 1} von ${pic.roundCount}`}
        title={PICTURE_KINDS[pic.kind]}
      />

      {isHost && pic.status !== "solved" && (
        <Panel className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="label">Lösung</span>
          <span className="font-bold">{pic.answer}</span>
        </Panel>
      )}

      <Panel className="stripe space-y-3 p-2 sm:p-3">
        <PictureView pic={pic} progress={progress} />
        <ProgressBar pic={pic} progress={progress} />
      </Panel>

      {status}

      {!isHost && (pic.status === "running" || pic.status === "paused") && (
        <button
          disabled={!canBuzz}
          onPointerDown={() => canBuzz && playerAction({ type: "pic.buzz" })}
          className={cn(
            "headline mx-auto grid aspect-square w-full max-w-56 place-items-center rounded-full border-4 text-4xl transition-transform select-none",
            canBuzz ? "border-red-400 bg-red-600 text-white shadow-[0_0_70px_-5px_rgba(220,38,38,0.7)] active:scale-95 active:bg-red-700" : "border-line bg-surface text-base text-faint",
          )}
        >
          {canBuzz ? "BUZZ" : myBuzz?.wrong ? "Leider falsch" : "In der Queue"}
        </button>
      )}
    </ModeLayout>
  );
}

// Red progress like Schmobin's: markers show up to where each tier counts.
function ProgressBar({ pic, progress }: { pic: PicState; progress: number }) {
  const points = picPoints(pic, progress);
  return (
    <div className="px-1 pb-1">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="headline text-2xl tabular-nums">
          {pic.status === "solved" ? "" : `${points} ${points === 1 ? "Punkt" : "Punkte"}`}
        </span>
        <span className="font-mono text-xs text-faint">{Math.round(progress * 100)} %</span>
      </div>
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-0 h-2 overflow-hidden rounded-full bg-raised">
          <div className="h-full rounded-full bg-red-500" style={{ width: `${progress * 100}%`, transition: "width 0.25s linear" }} />
        </div>
        {pic.tiers.map((t) => (
          <div
            key={t.until}
            className={cn("absolute top-0 flex flex-col", t.until >= 95 ? "-translate-x-full items-end" : "-translate-x-1/2 items-center")}
            style={{ left: `${t.until}%` }}
          >
            <span className="h-3 w-0.5 bg-yellow-400" />
            <span className="mt-0.5 rounded bg-black/70 px-1 font-mono text-[11px] font-bold whitespace-nowrap text-yellow-400">{t.points} P</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuzzQueue({ pic, name, meId }: { pic: PicState; name: (id: string) => string; meId: string | null }) {
  return (
    <Panel className="p-4">
      <p className="label mb-3">Buzz Queue</p>
      {pic.queue.length === 0 ? (
        <p className="text-sm text-faint">Noch niemand</p>
      ) : (
        <ol className="space-y-1">
          {pic.queue.map((b, i) => (
            <li
              key={b.playerId}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2",
                b.playerId === pic.answeringId ? "border-accent/60 bg-accent-soft" : b.wrong ? "border-red-900/50 bg-bad-soft text-red-400" : "border-transparent bg-black/20",
              )}
            >
              <span className="w-4 font-mono text-sm text-faint">{i + 1}</span>
              <span className={cn("min-w-0 flex-1 truncate font-bold uppercase italic", b.wrong && "line-through")}>
                {name(b.playerId)}
                {b.playerId === meId && <span className="ml-1.5 font-mono text-xs not-italic text-faint normal-case">(du)</span>}
              </span>
              <span className="font-mono text-sm tabular-nums text-accent-light">{Math.round(b.progress * 100)} %</span>
              <span className="font-mono text-xs text-faint">{picPoints(pic, b.progress)} P</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function HostActions({ pic, isLast }: { pic: PicState; isLast: boolean }) {
  const head = pic.queue.find((b) => !b.wrong);
  switch (pic.status) {
    case "ready":
      return (
        <Button size="lg" className="w-full sm:w-auto" onClick={() => hostAction({ type: "pic.start" })}>
          <Play /> Bild starten
        </Button>
      );
    case "paused": {
      const more = pic.queue.filter((b) => !b.wrong).length > 1;
      return (
        <>
          <Button size="lg" variant="bad" className="flex-1 sm:flex-none" onClick={() => hostAction({ type: "pic.judge", correct: false })}>
            <X /> {more ? "Falsch, nächster" : "Falsch"}
          </Button>
          <Button size="lg" variant="good" className="flex-1 sm:flex-none" onClick={() => hostAction({ type: "pic.judge", correct: true })}>
            <Check /> Richtig (+{head ? picPoints(pic, head.progress) : 0})
          </Button>
        </>
      );
    }
    case "running":
      return (
        <Button size="lg" variant="secondary" className="w-full sm:w-auto" onClick={() => hostAction({ type: "pic.solve" })}>
          <Eye /> Auflösen ohne Punkte
        </Button>
      );
    case "solved":
      return isLast ? (
        <Button size="lg" className="w-full sm:w-auto" onClick={() => hostAction({ type: "showLeaderboard" })}>
          Zum Punktestand <ArrowRight />
        </Button>
      ) : (
        <Button size="lg" className="w-full sm:w-auto" onClick={() => hostAction({ type: "pic.next" })}>
          Nächstes Bild <ArrowRight />
        </Button>
      );
  }
}
