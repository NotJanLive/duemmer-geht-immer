"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Music, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SongHit, searchSongs } from "@/lib/itunes";

// Search field with a result list from iTunes. Typing waits a moment before
// searching, so the API is not asked on every key.
export function SongSearch({
  onPick,
  disabled,
  placeholder = "Songtitel oder Interpret …",
  autoFocus,
  className,
  down,
}: {
  onPick: (hit: SongHit) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  down?: boolean; // force the list below the field (default: where there is more room)
}) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SongHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // The list is fixed to the window: it opens where there is more room and
  // never runs out of the screen.
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const showList = open && term.trim().length >= 2;
  useEffect(() => {
    if (!showList) return;
    const update = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const gap = 8;
      const below = window.innerHeight - r.bottom - gap * 2;
      const above = r.top - gap * 2;
      // Upwards by default (the cams are below), down only when there is no room above.
      const goDown = down ?? (above < 240 && below > above);
      setPlace({
        left: r.left,
        width: r.width,
        ...(goDown ? { top: r.bottom + gap } : { bottom: window.innerHeight - r.top + gap }),
        maxHeight: Math.max(140, Math.min(420, goDown ? below : above)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [showList, down]);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      setBusy(true);
      searchSongs(q)
        .then((list) => {
          if (!alive) return;
          setHits(list);
          setError(false);
          setActive(0);
        })
        .catch(() => alive && setError(true))
        .finally(() => alive && setBusy(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      const target = e.target as Node;
      if (box.current && !box.current.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  const pick = (hit: SongHit) => {
    onPick(hit);
    setTerm("");
    setHits([]);
    setOpen(false);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      <div className="flex h-12 items-center gap-2 rounded-xl border border-line-strong bg-zinc-950/70 px-3 focus-within:border-accent">
        <Search className="size-4 shrink-0 text-faint" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!hits.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(hits[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint disabled:opacity-50"
        />
        {busy && <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-accent" />}
        {term && !busy && (
          <button type="button" onClick={() => setTerm("")} className="text-faint hover:text-white" title="Leeren">
            <X className="size-4" />
          </button>
        )}
      </div>
      {showList && place && createPortal(
        <div
          ref={list}
          className="fixed z-50 overflow-y-auto rounded-xl border border-line-strong bg-zinc-900 p-1 shadow-2xl"
          style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
        >
          {error ? (
            <p className="px-3 py-3 text-sm text-bad">Suche gerade nicht erreichbar, gleich nochmal versuchen.</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-faint">{busy ? "Suche …" : "Nichts gefunden"}</p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.trackId}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(hit)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left", i === active ? "bg-raised" : "hover:bg-raised")}
              >
                {hit.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hit.cover} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-raised">
                    <Music className="size-4 text-faint" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{hit.title}</span>
                  <span className="block truncate text-sm text-muted">{hit.artist}</span>
                </span>
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
