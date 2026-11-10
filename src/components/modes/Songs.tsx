"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, AudioLines, Check, Eye, Lock, Pause, Play, SkipForward, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction, playerAction } from "@/lib/socket";
import { useServerNow } from "@/lib/useServerNow";
import { getVolume, playSnippet, setVolume, songAudioReady, stopSong, unlockSongAudio, waveform } from "@/lib/songAudio";
import { SongHit } from "@/lib/itunes";
import { SONG_POINTS, SONG_STAGES } from "@/types/pool";
import { Player, SongState } from "@/types/game";
import { Avatar } from "@/components/stats";
import { Button, Panel, Pill } from "@/components/ui";
import { ModeHeading, ModeLayout, Scoreboard, StatusBanner } from "@/components/room/Shell";
import { SongSearch } from "@/components/SongSearch";

const MAX = SONG_STAGES[SONG_STAGES.length - 1];
const BARS = 90;
const REVEAL_SECONDS = 30; // the whole preview plays at the reveal

export const stageLabel = (i: number) => `${SONG_STAGES[i].toLocaleString("de-DE")} s`;

export default function Songs() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const clockOffset = useRoomStore((s) => s.clockOffset);
  const song = game.song!;
  const isHost = role === "host";
  const isLast = song.roundIndex === song.roundCount - 1 && song.itemIndex === song.itemCount - 1;
  const key = `${song.roundIndex}-${song.itemIndex}`;

  // Audio: load the preview, play every new play command at its server time.
  const [ready, setReady] = useState(true);
  const [bars, setBars] = useState<number[]>([]);
  useEffect(() => {
     
    setBars([]);
    let alive = true;
    waveform(song.preview, song.offset, MAX, BARS)
      .then((b) => alive && setBars(b))
      .catch(() => {});
    return () => {
      alive = false;
      stopSong();
    };
  }, [song.preview, song.offset]);

  useEffect(() => {
    const check = () => setReady(songAudioReady());
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, []);

  // What plays right now on this device, in local time, for the playhead.
  const [run, setRun] = useState<{ start: number; seconds: number; from: number } | null>(null);
  const handled = useRef<string>("");
  const hostClick = useRef(0);

  const start = (offset: number, seconds: number, at: number, catchUp: boolean, from: number) => {
    void playSnippet(song.preview, offset, seconds, at, catchUp).then((r) => {
      if (r) setRun({ start: r.startedAt, seconds: catchUp ? seconds - Math.max(0, (Date.now() - at) / 1000) : seconds, from });
    });
  };

  // A snippet command: play it at once, whole. The host already plays it on
  // the click, so the echo from the server is skipped there.
  useEffect(() => {
    if (!song.play) return;
    const id = `${key}-${song.play.at}`;
    if (handled.current === id) return;
    handled.current = id;
    if (isHost && Date.now() - hostClick.current < 3000) return;
    start(song.offset, SONG_STAGES[song.play.stage], Date.now(), false, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.play, key]);

  // The whole preview after the reveal, pausable by the host.
  useEffect(() => {
    if (!song.revealed) return;
    const id = `${key}-reveal-${song.reveal?.at ?? "paused"}`;
    if (handled.current === id) return;
    handled.current = id;
    if (!song.reveal) {
      stopSong();
       
      setRun(null);
      return;
    }
    const { at, from } = song.reveal;
    start(from, REVEAL_SECONDS - from, at - clockOffset, true, from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.revealed, song.reveal, key]);

   
  useEffect(() => setRun(null), [key]);

  // Playhead, local clock.
  const tick = useServerNow(!!run, 40);
  const local = tick - clockOffset;
  const elapsed = run ? (local - run.start) / 1000 : -1;
  const playing = !!run && elapsed >= 0 && elapsed < run.seconds;
  const playSeconds = run?.seconds ?? 0;
  const waiting = false;

  const mine = meId ? song.guesses[meId] : undefined;
  const wantsLonger = !!meId && song.extend.includes(meId);
  const [pick, setPick] = useState<SongHit | null>(null);
   
  useEffect(() => setPick(null), [key]);

  const lockIn = () => {
    if (!pick) return;
    playerAction({ type: "song.guess", trackId: pick.trackId, title: pick.title, artist: pick.artist, cover: pick.cover });
    setPick(null);
  };

  // Host click on the disc: play here at once, tell everyone else.
  const hostPlay = () => {
    unlockSongAudio();
    hostClick.current = Date.now();
    start(song.offset, SONG_STAGES[song.stage], Date.now(), false, 0);
    hostAction({ type: "song.play" });
  };
  const allIn = game.players.length > 0 && game.players.every((p) => song.guesses[p.id]);
  const canReveal = song.stage >= SONG_STAGES.length - 1 || allIn;

  let banner = null;
  if (meId && song.revealed) {
    banner = mine?.correct ? (
      <StatusBanner tone="good">Richtig bei {stageLabel(mine.stage)}! +{mine.points} Punkte</StatusBanner>
    ) : (
      <StatusBanner tone="bad">{mine ? "Leider falsch" : "Kein Tipp abgegeben"}</StatusBanner>
    );
  }

  return (
    <ModeLayout
      board={
        <Scoreboard
          players={game.players}
          meId={meId}
          tone={(p) => (song.revealed ? (song.guesses[p.id]?.correct ? "good" : "bad") : null)}
          tag={(p) => {
            const g = song.guesses[p.id];
            if (!g) return null;
            if (song.revealed) return g.correct ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />;
            return <span className="inline-flex items-center gap-0.5"><Lock className="size-3" strokeWidth={3} />{stageLabel(g.stage)}</span>;
          }}
        />
      }
      actions={
        isHost &&
        (!song.revealed ? (
          <>
            <Button variant="secondary" disabled={song.stage >= SONG_STAGES.length - 1} onClick={() => hostAction({ type: "song.stage" })}>
              <SkipForward /> {song.stage < SONG_STAGES.length - 1 ? `Länger: ${stageLabel(song.stage + 1)}` : "Längste Stufe"}
              {song.extend.length > 0 && <span className="ml-1 rounded-full bg-yellow-500 px-1.5 text-black">{song.extend.length}</span>}
            </Button>
            <Button
              disabled={!canReveal}
              title={canReveal ? undefined : "Erst bei der letzten Stufe oder wenn alle eingeloggt haben"}
              onClick={() => {
                unlockSongAudio();
                hostAction({ type: "song.reveal" });
              }}
            >
              <Eye /> Auflösen
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                unlockSongAudio();
                hostAction({ type: "song.pause" });
              }}
            >
              {song.reveal && playing ? <><Pause /> Pause</> : <><Play /> Abspielen</>}
            </Button>
            {isLast ? (
              <Button onClick={() => hostAction({ type: "showLeaderboard" })}>
                Zum Punktestand <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => hostAction({ type: "song.next" })}>
                Nächster Song <ArrowRight />
              </Button>
            )}
          </>
        ))
      }
    >
      <ModeHeading
        eyebrow={`${song.category} · Song ${song.itemIndex + 1} von ${song.itemCount} · Runde ${song.roundIndex + 1} von ${song.roundCount}`}
        title={song.revealed ? "Auflösung" : "Welcher Song ist das?"}
        meta={!song.revealed && <Pill tone="accent">{SONG_POINTS[song.stage]} Punkte bei {stageLabel(song.stage)}</Pill>}
      />

      {!ready && (
        <button
          type="button"
          onClick={() => {
            unlockSongAudio();
            setReady(songAudioReady());
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-yellow-500/60 bg-yellow-500/10 px-4 py-3 font-bold text-yellow-300 uppercase"
        >
          <Volume2 className="size-5" /> Ton aktivieren
        </button>
      )}

      <Panel className="stripe relative overflow-hidden p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="relative grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
          <PlayDisc
            playing={playing}
            waiting={waiting}
            progress={playing ? (song.revealed ? (run!.from + elapsed) / REVEAL_SECONDS : elapsed / playSeconds) : 0}
            onClick={isHost && !song.revealed ? hostPlay : undefined}
            cover={song.revealed ? song.answer?.cover : undefined}
          />
          <div className="min-w-0 space-y-5">
            <Timeline stage={song.stage} revealed={song.revealed} position={!song.revealed && playing ? elapsed : null} lockedAt={mine?.stage} lockedRight={song.revealed ? mine?.correct ?? null : null} />
            <Waveform bars={bars} unlocked={song.revealed ? MAX : SONG_STAGES[song.stage]} position={!song.revealed && playing ? elapsed : null} />
          </div>
        </div>
      </Panel>

      {(song.revealed || isHost) && song.answer && (
        <Panel className={cn("flex items-center gap-4 p-3", song.revealed ? "animate-pop border-green-500/50 bg-green-950/30" : "")}>
          {song.answer.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={song.answer.cover} alt="" className={cn("shrink-0 rounded-lg object-cover", song.revealed ? "size-20" : "size-12")} />
          )}
          <div className="min-w-0 flex-1">
            {!song.revealed && <p className="label">Lösung</p>}
            <p className={cn("truncate font-black uppercase italic", song.revealed ? "text-3xl" : "text-lg")}>{song.answer.title}</p>
            <p className="truncate text-muted">{song.answer.artist}</p>
          </div>
        </Panel>
      )}

      {banner}

      {meId && !song.revealed && !mine && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {pick ? (
            <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-accent bg-accent-soft px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {pick.cover && <img src={pick.cover} alt="" className="size-8 rounded object-cover" />}
              <span className="min-w-0 flex-1 truncate font-bold">
                {pick.title} <span className="font-normal text-muted">· {pick.artist}</span>
              </span>
              <button type="button" onClick={() => setPick(null)} className="text-faint hover:text-white" title="Anderen Song wählen">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <SongSearch className="min-w-0 flex-1" onPick={setPick} />
          )}
          <Button size="lg" className="h-12" disabled={!pick} onClick={lockIn}>
            <Lock /> Einloggen +{SONG_POINTS[song.stage]}
          </Button>
          {song.stage < SONG_STAGES.length - 1 && (
            <Button
              size="lg"
              variant="secondary"
              className={cn("h-12", wantsLonger && "border-yellow-500 text-yellow-300")}
              onClick={() => playerAction({ type: "song.extend" })}
              title="Dem Host sagen, dass du einen längeren Ausschnitt willst"
            >
              <SkipForward /> {wantsLonger ? "Verlängern gewünscht" : "Verlängern"}
            </Button>
          )}
        </div>
      )}

      {meId && mine && !song.revealed && (
        <StatusBanner tone="accent">
          Eingeloggt bei {stageLabel(mine.stage)}: {mine.title} · {mine.artist}
        </StatusBanner>
      )}

      <Answers song={song} players={game.players} meId={meId} isHost={isHost} />

      <VolumeControl />
    </ModeLayout>
  );
}

// Round play button: rings pulse while the snippet plays, a ring fills up.
function PlayDisc({ playing, waiting, progress, onClick, cover }: { playing: boolean; waiting: boolean; progress: number; onClick?: () => void; cover?: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, title: "Abspielen" } : {})}
      className={cn("relative mx-auto grid size-36 shrink-0 place-items-center rounded-full sm:size-44", onClick && "cursor-pointer")}
    >
      {playing && <span className="absolute inset-0 animate-ping rounded-full border-2 border-accent/40" />}
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(#3b82f6 ${progress * 360}deg, rgba(63,63,70,0.6) 0deg)` }}
      />
      <span className="absolute inset-1.5 rounded-full bg-gradient-to-b from-zinc-900 to-black shadow-[inset_0_0_30px_rgba(59,130,246,0.25)]" />
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="relative size-[78%] animate-pop rounded-full object-cover" />
      ) : (
        <span
          className={cn(
            "relative grid size-20 place-items-center rounded-full border transition-colors sm:size-24",
            playing ? "border-accent bg-accent-strong/30 text-white" : waiting ? "border-accent/60 text-accent-light" : "border-line-strong text-muted",
            onClick && !playing && "hover:border-white hover:text-white",
          )}
        >
          {onClick && !playing ? <Play className="size-9 translate-x-0.5" /> : <AudioLines className={cn("size-9", playing && "animate-pulse")} />}
        </span>
      )}
    </Tag>
  );
}

// 0 to 5 s with a marker per stage. Unlocked stages are lit, the playhead runs
// along while a snippet plays.
function Timeline({ stage, revealed, position, lockedAt, lockedRight }: { stage: number; revealed: boolean; position: number | null; lockedAt?: number; lockedRight: boolean | null }) {
  const solvedAt = lockedAt;
  const markColor = lockedRight === null ? "border-yellow-200 bg-yellow-400" : lockedRight ? "border-green-300 bg-green-500" : "border-red-300 bg-red-500";
  const at = (s: number) => `${(s / MAX) * 100}%`;
  return (
    <div className="relative mx-3 h-16">
      <div className="absolute inset-x-0 top-7 h-1.5 rounded-full bg-raised" />
      <div className="absolute top-7 left-0 h-1.5 rounded-full bg-accent/70" style={{ width: at(revealed ? MAX : SONG_STAGES[stage]) }} />
      {position !== null && (
        <div className="absolute top-7 left-0 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ width: at(Math.min(position, MAX)) }} />
      )}
      {SONG_STAGES.map((s, i) => {
        const open = revealed || i <= stage;
        return (
          <div key={s} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: at(s) }}>
            <span className={cn("font-mono text-[11px] font-bold", open ? "text-yellow-400" : "text-faint")}>+{SONG_POINTS[i]}</span>
            <span
              className={cn(
                "mt-1 size-4 rounded-full border-2",
                i === solvedAt ? markColor : i === stage && !revealed ? "border-white bg-accent shadow-[0_0_12px_rgba(59,130,246,0.9)]" : open ? "border-accent-light bg-accent-strong" : "border-line-strong bg-zinc-900",
              )}
            />
            <span className={cn("mt-1 font-mono text-xs whitespace-nowrap", open ? "text-white" : "text-faint")}>{stageLabel(i)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Waveform({ bars, unlocked, position }: { bars: number[]; unlocked: number; position: number | null }) {
  const list = bars.length ? bars : Array.from({ length: BARS }, () => 0.15);
  return (
    <div className="mx-3 flex h-16 items-center gap-[2px]">
      {list.map((v, i) => {
        const t = (i / list.length) * MAX;
        const lit = t < unlocked;
        const played = position !== null && t <= position;
        return (
          <span
            key={i}
            className={cn("min-w-0 flex-1 rounded-full transition-colors", played ? "bg-white" : lit ? "bg-accent" : "bg-raised")}
            style={{ height: `${Math.max(8, v * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

function VolumeControl() {
  const [v, setV] = useState(0.8);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setV(getVolume()), []);
  return (
    <label className="flex items-center justify-end gap-2 text-sm text-muted">
      <Volume2 className="size-4" />
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={v}
        onChange={(e) => {
          const next = Number(e.target.value);
          setV(next);
          setVolume(next);
        }}
        className="w-32 accent-blue-500"
      />
    </label>
  );
}

// Everyone's pick below the player: before the reveal only who locked in at
// which stage (the host sees the songs), after it the songs, right or wrong
// and the points.
function Answers({ song, players, meId, isHost }: { song: SongState; players: Player[]; meId: string | null; isHost: boolean }) {
  const list = [...players].sort((a, b) => {
    const ga = song.guesses[a.id];
    const gb = song.guesses[b.id];
    if (song.revealed) return (gb?.points ?? -1) - (ga?.points ?? -1) || a.name.localeCompare(b.name, "de");
    return a.name.localeCompare(b.name, "de");
  });
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((p) => {
        const g = song.guesses[p.id];
        const showSong = !!g && (song.revealed || isHost || p.id === meId) && !!g.title;
        const right = song.revealed ? !!g?.correct : null;
        return (
          <div
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
              right === true ? "animate-pop border-green-500/60 bg-green-950/40" : right === false ? "animate-pop border-red-900/60 bg-red-950/30" : g ? "border-accent/40 bg-accent-soft" : "border-line bg-surface/60",
            )}
          >
            <Avatar name={p.name} src={p.avatar} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate font-black uppercase italic">{p.name}</span>
                {g && <span className="shrink-0 font-mono text-xs text-faint">{stageLabel(g.stage)}</span>}
              </p>
              {showSong ? (
                <p className="truncate text-sm text-muted">
                  {g!.title} · {g!.artist}
                </p>
              ) : (
                <p className="text-sm text-faint">{g ? "Eingeloggt" : song.revealed ? "Kein Tipp" : "Überlegt noch …"}</p>
              )}
            </div>
            {showSong && g!.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g!.cover} alt="" className="size-10 shrink-0 rounded-md object-cover" />
            )}
            {right === true && <span className="headline shrink-0 text-xl text-green-400">+{g!.points}</span>}
            {right === false && <X className="size-5 shrink-0 text-red-500" strokeWidth={3} />}
            {right === null && g && <Lock className="size-4 shrink-0 text-accent-light" />}
          </div>
        );
      })}
    </div>
  );
}
