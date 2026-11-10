"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardStore, useRoomStore } from "@/lib/store";
import { getSocket } from "@/lib/socket";
import { geoTimeline } from "@/lib/geoReveal";
import { useServerNow } from "@/lib/useServerNow";
import { Player, ShowHost } from "@/types/game";

// Cams through VDO.Ninja: each person publishes their own camera (video only,
// voice stays in Discord) and everyone else views it peer to peer. The iframes
// stay mounted across screens, otherwise every mode change would reconnect.

const VDO = "https://vdo.ninja/";
const CAM_PREF = "dgi_cam";

function pushUrl(id: string) {
  return `${VDO}?push=${id}&webcam&autostart&ad=0&q=2&cleanoutput&hidemenu&chroma=000000&cover&label=quiz`;
}

function viewUrl(id: string) {
  return `${VDO}?view=${id}&noaudio&cleanoutput&cleanviewer&chroma=000000&cover&buffer=0`;
}

// Cams start off on every new show. Turning one on is remembered for this
// show in this tab only, so a reload keeps it but the next show starts off.
function readPref(showId: string): boolean {
  try {
    return sessionStorage.getItem(`${CAM_PREF}:${showId}`) === "on";
  } catch {
    return false;
  }
}

function writePref(showId: string, on: boolean) {
  try {
    sessionStorage.setItem(`${CAM_PREF}:${showId}`, on ? "on" : "off");
  } catch {}
}

const CamFrame = memo(function CamFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      allow="camera; microphone; autoplay; fullscreen"
      className="absolute inset-0 size-full border-0"
    />
  );
});

function Avatar({ name, avatar }: { name: string; avatar: string | null }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-zinc-800 to-zinc-950">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="aspect-square h-1/2 rounded-full object-cover opacity-80" />
      ) : (
        <span className="headline grid aspect-square h-1/2 place-items-center rounded-full bg-zinc-800 text-3xl text-faint">{name.slice(0, 1)}</span>
      )}
    </div>
  );
}

// Points count up or down to the new value, with a floating "+10" / "-5".
export function AnimatedPoints({ value, className, bubble = true }: { value: number; className?: string; bubble?: boolean }) {
  const [shown, setShown] = useState(value);
  const [delta, setDelta] = useState<{ n: number; key: number } | null>(null);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    setDelta({ n: value - from, key: Date.now() });
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setShown(Math.round(from + (value - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const clear = setTimeout(() => setDelta(null), 1300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(clear);
      setShown(value);
    };
  }, [value]);

  return (
    <span className={cn("relative inline-flex", delta && (delta.n > 0 ? "points-up" : "points-down"), className)}>
      <span className="tabular-nums">{shown}</span>
      {bubble && delta && (
        <span key={delta.key} className={cn("points-float headline absolute top-0 left-full ml-1 text-sm", delta.n > 0 ? "text-green-400" : "text-red-400")}>
          {delta.n > 0 ? `+${delta.n}` : delta.n}
        </span>
      )}
    </span>
  );
}

interface TileProps {
  name: string;
  avatar: string | null;
  cam: string;
  self: boolean;
  camOn: boolean; // own preference for the self tile, the publisher's state for others
  onToggle?: () => void;
  points?: number | null;
  host?: boolean;
  online?: boolean;
  turn?: boolean;
  tone?: "good" | "bad" | null;
  dimmed?: boolean;
  tag?: React.ReactNode;
}

// Schmobin style: the video fills the tile, only the points top left and the
// name pill at the bottom (with the mode's tag: lock, check, hearts). The
// border colour shows turn, right and wrong.
function Tile({ name, avatar, cam, self, camOn, onToggle, points, host, online = true, turn, tone, dimmed, tag }: TileProps) {
  const bad = tone === "bad" || dimmed;
  const accent = bad ? "bad" : turn ? "turn" : tone === "good" ? "good" : host ? "host" : "idle";
  const border = {
    turn: "border-accent shadow-[0_0_18px_rgba(59,130,246,0.6)]",
    good: "border-good",
    bad: "border-bad",
    host: "border-yellow-500",
    idle: "border-line-strong",
  }[accent];
  const pill = {
    turn: "bg-accent-strong text-white",
    good: "bg-green-600 text-white",
    bad: "bg-red-600 text-white",
    host: "bg-yellow-500 text-black",
    idle: "bg-zinc-800 text-white",
  }[accent];

  return (
    <div
      className={cn(
        "relative aspect-video w-40 shrink-0 overflow-hidden rounded-xl border-2 bg-zinc-950 transition-colors",
        "sm:aspect-auto sm:h-full sm:w-auto sm:max-w-[calc(var(--cam-h)*16/9)] sm:min-w-0 sm:flex-1",
        border,
      )}
    >
      <Avatar name={name} avatar={avatar} />
      {camOn && <CamFrame src={self ? pushUrl(cam) : viewUrl(cam)} title={`Kamera ${name}`} />}
      {!online && <div className="absolute inset-0 grid place-items-center bg-black/70 font-mono text-xs uppercase tracking-wider text-bad">offline</div>}

      {points != null && (
        <span className={cn("headline absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-sm shadow-md", pill)}>
          <AnimatedPoints value={points} />
        </span>
      )}

      {self && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          title={camOn ? "Kamera aus" : "Kamera an"}
          className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-md bg-black/70 text-white hover:bg-black [&_svg]:size-4"
        >
          {camOn ? <Camera /> : <CameraOff className="text-bad" />}
        </button>
      )}

      <div className="absolute inset-x-0 bottom-1.5 flex justify-center px-2">
        <span className={cn("flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-wide uppercase shadow-md", pill)}>
          {host && <Crown className="size-3.5 shrink-0" />}
          <span className={cn("truncate", dimmed && "line-through")}>{name}</span>
          {tag && <span className="flex shrink-0 items-center">{tag}</span>}
        </span>
      </div>
    </div>
  );
}

type TileData = TileProps & { key: string };

// Everyone's tile: the host first, then the players alphabetically.
function useTiles(overlay: boolean): TileData[] | null {
  const state = useRoomStore((s) => s.state);
  const role = useRoomStore((s) => s.role);
  const playerId = useRoomStore((s) => s.playerId);
  const board = useBoardStore((s) => s.board);
  const [camOn, setCamOn] = useState(false);

  const seated = role === "host" || role === "player";
  const status = useRoomStore((s) => s.status);
  const isHost = !overlay && role === "host";
  const now = useServerNow(!!state?.geo?.revealed && state.geo.revealedAt !== null, 100);

  const showId = state?.showId ?? "";
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCamOn(showId ? readPref(showId) : false), [showId]);
  // Tell the server after every (re)connect whether this tab publishes.
  useEffect(() => {
    if (!overlay && seated && status === "online") getSocket().emit("cam", camOn);
  }, [overlay, seated, status, camOn]);

  if (!state) return null;
  const toggle = () => {
    writePref(showId, !camOn);
    setCamOn(!camOn);
  };
  const host: ShowHost = state.host;
  const players: Player[] = [...state.players].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const showPoints = state.screen !== "lobby" && state.screen !== "finale";
  // During the Wo liegt das? reveal the new points wait for each player's line.
  const geo = state.screen === "geo" && state.geo ? geoTimeline(state, now) : null;

  return [
    {
      key: `host-${host.id}`,
      name: host.name,
      avatar: host.avatar,
      cam: host.cam,
      host: true,
      self: isHost,
      camOn: isHost ? camOn : state.host.camOn,
      onToggle: toggle,
      online: state.hostConnected,
    },
    ...players.map((p) => ({
      key: p.id,
      name: p.name,
      avatar: p.avatar,
      cam: p.cam,
      self: !overlay && p.id === playerId,
      camOn: !overlay && p.id === playerId ? camOn : p.camOn,
      onToggle: toggle,
      points: showPoints ? (geo ? geo.score(p) : p.modeScore) : null,
      online: p.connected,
      turn: board?.turnId === p.id,
      tone: board?.tone?.(p) ?? null,
      dimmed: board?.dimmed?.(p),
      tag: board?.tag?.(p),
    })),
  ];
}

// All cams in one row under the stage (max 10 players plus the host). The row
// has a fixed height from the screen height; with few players the tiles stop
// at 16:9, with many they get narrower and the video is cropped to fill them.
export function CamRow({ overlay = false }: { overlay?: boolean }) {
  const tiles = useTiles(overlay);
  if (!tiles) return null;
  return (
    <div className={cn("border-t border-line bg-black/90", overlay ? "px-4 py-3" : "px-3 py-2")}>
      <div
        className="mx-auto flex gap-2 overflow-x-auto sm:h-(--cam-h) sm:justify-center sm:overflow-visible"
        style={{ "--cam-h": "clamp(130px, 23vh, 260px)" } as React.CSSProperties}
      >
        {tiles.map(({ key, ...t }) => (
          <Tile key={key} {...t} />
        ))}
      </div>
    </div>
  );
}
