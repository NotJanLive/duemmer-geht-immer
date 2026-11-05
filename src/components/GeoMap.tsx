"use client";

import { CSSProperties, MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { ZoomBehavior, ZoomTransform, zoom, zoomIdentity } from "d3-zoom";
import type { Feature, MultiPoint } from "geojson";
import { Maximize, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAPS, MapId } from "@/types/pool";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label?: string;
  target?: boolean; // the correct place: bigger, white dot, drops in
  delay?: number; // ms before it pops in (reveal animation); undefined = no animation
}

export interface MapLine {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  color: string;
  label?: string; // shown in the middle, e.g. the distance
  delay?: number; // ms before it is drawn
}

const WIDTH = 1000;
const MAX_ZOOM: Record<MapId, number> = { de: 14, eu: 24, world: 40 };

let worldPromise: Promise<Feature[]> | null = null;
function loadWorld(): Promise<Feature[]> {
  worldPromise ??= fetch("/maps/world.json")
    .then((r) => r.json())
    .then((d) => d.features);
  return worldPromise;
}

// The region's corners and edge midpoints, so the fit covers all of it.
function viewShape([w, s, e, n]: [number, number, number, number]): MultiPoint {
  const mx = (w + e) / 2;
  const my = (s + n) / 2;
  return { type: "MultiPoint", coordinates: [[w, s], [e, s], [w, n], [e, n], [mx, s], [mx, n], [w, my], [e, my]] };
}

// Pill width for a label, measured once per text.
const widths = new Map<string, number>();
function textWidth(text: string): number {
  if (!widths.has(text)) {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) ctx.font = `700 12px ${getComputedStyle(document.body).fontFamily}`;
    widths.set(text, ctx ? ctx.measureText(text).width : text.length * 7);
  }
  return widths.get(text)!;
}

// Teardrop pin, 26 × 36 with the tip at the bottom centre.
const PIN_PATH = "M13 0C5.82 0 0 5.6 0 12.5 0 21.9 13 36 13 36s13-14.1 13-23.5C26 5.6 20.18 0 13 0z";

// Outline world map without labels. The region decides where it opens and how
// far it can be dragged. Countries are painted on a canvas, redrawn sharp on
// every zoom step; pins, lines and labels sit on an SVG layer on top in screen
// size. Wheel or pinch zooms, dragging pans, a click without dragging picks.
export default function GeoMap({
  map,
  markers = [],
  lines = [],
  onPick,
  className,
}: {
  map: MapId;
  markers?: MapMarker[];
  lines?: MapLine[];
  onPick?: (pos: { lat: number; lng: number }) => void;
  className?: string;
}) {
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [cssWidth, setCssWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<SVGSVGElement>(null);
  const behavior = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    let alive = true;
    loadWorld().then((f) => alive && setFeatures(f));
    return () => {
      alive = false;
    };
  }, []);

  const geo = useMemo(() => {
    if (!features) return null;
    const view = viewShape(MAPS[map].view);
    const projection = geoMercator().fitWidth(WIDTH, view);
    const [[, y0], [, y1]] = geoPath(projection).bounds(view);
    const height = Math.ceil(y1 - y0);
    projection.translate([projection.translate()[0], projection.translate()[1] - y0]);
    const path = geoPath(projection);
    const shapes = features.map((f) => new Path2D(path(f) ?? ""));
    return { projection, height, shapes };
  }, [features, map]);

  // Zoom and pan. The map cannot be dragged past the region's edges.
  useEffect(() => {
    const el = overlay.current;
    if (!el || !geo) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM[map]])
      .extent([[0, 0], [WIDTH, geo.height]])
      .translateExtent([[0, 0], [WIDTH, geo.height]])
      .clickDistance(6)
      .on("zoom", (e) => setTransform(e.transform));
    const selection = select(el);
    selection.call(z).on("dblclick.zoom", null);
    selection.call(z.transform, zoomIdentity);
    behavior.current = z;
    return () => {
      selection.on(".zoom", null);
    };
  }, [geo, map]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setCssWidth(el.clientWidth));
    observer.observe(el);
    setCssWidth(el.clientWidth);
    return () => observer.disconnect();
  }, [geo]);

  // Paint the countries at the device's real resolution.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !geo || !cssWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = cssWidth / WIDTH;
    const cssHeight = geo.height * scale;
    if (el.width !== Math.round(cssWidth * dpr)) el.width = Math.round(cssWidth * dpr);
    if (el.height !== Math.round(cssHeight * dpr)) el.height = Math.round(cssHeight * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, el.width, el.height);
    const f = dpr * scale;
    ctx.setTransform(f * transform.k, 0, 0, f * transform.k, f * transform.x, f * transform.y);
    ctx.fillStyle = "#27272a";
    ctx.strokeStyle = "#71717a";
    ctx.lineWidth = 1 / (scale * transform.k);
    ctx.lineJoin = "round";
    for (const shape of geo.shapes) {
      ctx.fill(shape);
      ctx.stroke(shape);
    }
  }, [geo, transform, cssWidth]);

  const click = (e: MouseEvent<SVGSVGElement>) => {
    if (!onPick || !geo || !overlay.current) return;
    const ctm = overlay.current.getScreenCTM();
    if (!ctm) return;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const pos = geo.projection.invert?.(transform.invert([point.x, point.y]));
    if (pos) onPick({ lng: Math.round(pos[0] * 10000) / 10000, lat: Math.round(pos[1] * 10000) / 10000 });
  };

  const zoomBy = (factor: number) => {
    if (overlay.current && behavior.current) select(overlay.current).call(behavior.current.scaleBy, factor);
  };
  const reset = () => {
    if (overlay.current && behavior.current) select(overlay.current).call(behavior.current.transform, zoomIdentity);
  };

  if (!geo) return <div className={cn("aspect-[4/3] w-full animate-pulse rounded-xl bg-surface", className)} />;

  // Screen position (in overlay units) and one screen pixel in overlay units.
  const at = (p: { lat: number; lng: number }) => transform.apply(geo.projection([p.lng, p.lat]) ?? [0, 0]);
  const px = cssWidth ? WIDTH / cssWidth : 1;

  return (
    <div
      ref={box}
      className={cn("relative mx-auto overflow-hidden rounded-xl border border-line bg-zinc-950", className)}
      style={{ width: `min(100%, calc(65vh * ${WIDTH / geo.height}))`, aspectRatio: `${WIDTH} / ${geo.height}` }}
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      <svg
        ref={overlay}
        viewBox={`0 0 ${WIDTH} ${geo.height}`}
        onClick={click}
        className={cn("absolute inset-0 size-full touch-none select-none", onPick ? "cursor-crosshair active:cursor-grabbing" : "cursor-grab active:cursor-grabbing")}
      >
        <defs>
          <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>
        {lines.map((l) => {
          const [x1, y1] = at(l.from);
          const [x2, y2] = at(l.to);
          const animated = l.delay !== undefined;
          return (
            <g key={l.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={l.color}
                strokeWidth={2.5 * px}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                className={animated ? "map-line-draw" : undefined}
                style={{ animationDelay: `${l.delay ?? 0}ms` } as CSSProperties}
              />
              {l.label && (
                <Pill x={(x1 + x2) / 2} y={(y1 + y2) / 2} px={px} color={l.color} text={l.label} delay={animated ? (l.delay ?? 0) + 600 : undefined} center />
              )}
            </g>
          );
        })}
        {markers.map((m) => {
          const [x, y] = at(m);
          const s = px * (m.target ? 1.15 : 0.95);
          const animated = m.delay !== undefined;
          return (
            <g key={m.id} transform={`translate(${x},${y})`}>
              <g
                className={animated ? (m.target ? "map-pin-drop" : "map-pin-pop") : undefined}
                style={{ animationDelay: `${m.delay ?? 0}ms` } as CSSProperties}
              >
                <g transform={`scale(${s}) translate(-13,-36)`} filter="url(#pin-shadow)">
                  <path d={PIN_PATH} fill={m.color} stroke="#fff" strokeWidth={2} />
                  <circle cx={13} cy={12.5} r={m.target ? 5.5 : 4.5} fill={m.target ? "#fff" : "rgba(255,255,255,0.9)"} />
                </g>
                {m.label && <Pill x={0} y={-(m.target ? 46 : 40) * px} px={px} color={m.color} text={m.label} />}
              </g>
            </g>
          );
        })}
      </svg>
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <ZoomButton title="Hineinzoomen" onClick={() => zoomBy(1.6)}>
          <Plus />
        </ZoomButton>
        <ZoomButton title="Herauszoomen" onClick={() => zoomBy(1 / 1.6)}>
          <Minus />
        </ZoomButton>
        <ZoomButton title="Ganze Karte" onClick={reset}>
          <Maximize />
        </ZoomButton>
      </div>
    </div>
  );
}

// A small dark pill with a coloured dot, drawn in screen size.
function Pill({ x, y, px, color, text, delay, center }: { x: number; y: number; px: number; color: string; text: string; delay?: number; center?: boolean }) {
  const w = textWidth(text) + 24;
  const h = 22;
  return (
    <g
      transform={`translate(${x},${y}) scale(${px})`}
      className={delay !== undefined ? "map-fade-in" : undefined}
      style={{ animationDelay: `${delay ?? 0}ms` } as CSSProperties}
    >
      <g transform={`translate(${-w / 2},${center ? -h / 2 : -h})`}>
        <rect width={w} height={h} rx={h / 2} fill="rgba(9,9,11,0.92)" stroke={color} strokeWidth={1.25} />
        <circle cx={10} cy={h / 2} r={3.5} fill={color} />
        <text x={18} y={h / 2 + 4.2} fontSize={12} fontWeight={700} fill="#fff">
          {text}
        </text>
      </g>
    </g>
  );
}

function ZoomButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg border border-line-strong bg-black/85 text-white hover:border-white [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
