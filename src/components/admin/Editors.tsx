"use client";

import { ChangeEvent, FormEvent, ReactNode, useState } from "react";
import { ImagePlus, MapPin, Plus, Search, X } from "lucide-react";
import PlaceMap from "./PlaceMap";
import { Button, Panel } from "@/components/ui";
import { cn } from "@/lib/utils";
import { GeoContent, HolContent, JeoContent, LmsContent, MAPS, MapId, PICTURE_KINDS, PicContent, PictureKind, PoolContent, PoolMode, SONG_PREVIEW_SECONDS, SongContent, WWM_MAX_POINTS, WwmContent } from "@/types/pool";
import { SongSearch } from "@/components/SongSearch";
import { playSnippet, stopSong, unlockSongAudio } from "@/lib/songAudio";
import { Field, Select, TextArea, TextInput } from "./fields";

export const EMPTY: { [M in PoolMode]: PoolContent[M] } = {
  lastManStanding: { topic: "", items: [] },
  millionaire: { question: "", options: ["", "", "", ""], answer: 0, points: 1 },
  higherLower: { topic: "", unit: "", items: [] },
  geo: { name: "", map: "de", minKm: MAPS.de.minKm, places: [] },
  pictures: { name: "", kind: "blur", items: [] },
  songs: { name: "", songs: [] },
  jeopardy: { name: "", questions: Array.from({ length: 5 }, () => ({ question: "", answer: "" })) },
};

// Strips ids and play stats so only editable content goes to the server.
export function contentOf<M extends PoolMode>(mode: M, entry: PoolContent[M]): PoolContent[M] {
  const keys = Object.keys(EMPTY[mode]) as (keyof PoolContent[M])[];
  return Object.fromEntries(keys.map((k) => [k, entry[k]])) as unknown as PoolContent[M];
}

export function entryTitle(mode: PoolMode, e: PoolContent[PoolMode]): string {
  if (mode === "millionaire") return (e as WwmContent).question;
  if (mode === "jeopardy" || mode === "geo" || mode === "pictures" || mode === "songs") return (e as JeoContent | GeoContent | PicContent | SongContent).name;
  return (e as LmsContent | HolContent).topic;
}

export function entryDetail(mode: PoolMode, e: PoolContent[PoolMode]): string {
  switch (mode) {
    case "lastManStanding":
      return `${(e as LmsContent).items.length} Begriffe: ${(e as LmsContent).items.slice(0, 6).join(", ")}${(e as LmsContent).items.length > 6 ? " …" : ""}`;
    case "millionaire": {
      const q = e as WwmContent;
      return q.options.map((o, i) => (i === q.answer ? `✓ ${o}` : o)).join(" · ");
    }
    case "higherLower": {
      const h = e as HolContent;
      return `${h.items.length} Begriffe${h.unit ? ` in ${h.unit}` : ""}`;
    }
    case "geo": {
      const g = e as GeoContent;
      return `${MAPS[g.map].label} · ${g.places.length} Orte: ${g.places.slice(0, 6).map((p) => p.name).join(", ")}${g.places.length > 6 ? " …" : ""}`;
    }
    case "pictures": {
      const p = e as PicContent;
      return `${PICTURE_KINDS[p.kind]} · ${p.items.length} Bilder: ${p.items.slice(0, 6).map((i) => i.answer).join(", ")}${p.items.length > 6 ? " …" : ""}`;
    }
    case "songs": {
      const s = e as SongContent;
      return `${s.songs.length} Songs: ${s.songs.slice(0, 5).map((x) => `${x.title} (${x.artist})`).join(", ")}${s.songs.length > 5 ? " …" : ""}`;
    }
    case "jeopardy":
      return `${(e as JeoContent).questions.length} Fragen`;
  }
}

interface EditorProps<M extends PoolMode> {
  initial: PoolContent[M];
  isNew: boolean;
  error: string;
  busy: boolean;
  onSave: (content: PoolContent[M]) => void;
  onCancel: () => void;
}

function EditorFrame({ title, error, busy, onCancel, onSubmit, children }: {
  title: string;
  error: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Panel className="stripe p-4 sm:p-5">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="headline text-2xl">{title}</h2>
        {children}
        {error && <p className="rounded-xl border border-bad/50 bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={busy}>
            Speichern
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function LmsEditor({ initial, isNew, onSave, ...rest }: EditorProps<"lastManStanding">) {
  const [topic, setTopic] = useState(initial.topic);
  const [items, setItems] = useState(initial.items.join("\n"));
  const list = items.split("\n").map((i) => i.trim()).filter(Boolean);
  return (
    <EditorFrame title={isNew ? "Neues Thema" : "Thema bearbeiten"} onSubmit={() => onSave({ topic, items: list })} {...rest}>
      <Field label="Thema">
        <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} autoFocus />
      </Field>
      <Field label={`Begriffe (${list.length})`} hint="Ein Begriff pro Zeile. Es müssen alle richtigen Antworten dabei sein.">
        <TextArea value={items} onChange={(e) => setItems(e.target.value)} className="min-h-64" />
      </Field>
    </EditorFrame>
  );
}

export function WwmEditor({ initial, isNew, onSave, ...rest }: EditorProps<"millionaire">) {
  const [question, setQuestion] = useState(initial.question);
  const [options, setOptions] = useState(initial.options);
  const [answer, setAnswer] = useState(initial.answer);
  const [points, setPoints] = useState(initial.points);
  return (
    <EditorFrame title={isNew ? "Neue Frage" : "Frage bearbeiten"} onSubmit={() => onSave({ question, options, answer, points })} {...rest}>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label="Frage">
          <TextInput value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus />
        </Field>
        <Field label="Punkte" hint="Mehr Punkte = schwerer">
          <Select value={points} onChange={(e) => setPoints(Number(e.target.value))}>
            {Array.from({ length: WWM_MAX_POINTS }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p} {p === 1 ? "Punkt" : "Punkte"}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="space-y-2">
        <span className="label block">Antworten (Kreis = richtig)</span>
        {options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAnswer(i)}
              title="Als richtige Antwort markieren"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl border font-mono font-bold",
                answer === i ? "border-green-400 bg-green-600 text-white" : "border-line text-faint hover:border-line-strong",
              )}
            >
              {"ABCD"[i]}
            </button>
            <TextInput value={option} onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))} />
          </div>
        ))}
      </div>
    </EditorFrame>
  );
}

// "Label; Zahl" per line keeps long lists quick to type and to paste.
function parseHolItems(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.lastIndexOf(";");
      const label = (at === -1 ? line : line.slice(0, at)).trim();
      // "12,5" and "12.5" both work. No thousands separators.
      const raw = at === -1 ? "" : line.slice(at + 1).trim().replace(/\s/g, "");
      const value = raw ? Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw) : NaN;
      return { label, value };
    });
}

export function HolEditor({ initial, isNew, onSave, ...rest }: EditorProps<"higherLower">) {
  const [topic, setTopic] = useState(initial.topic);
  const [unit, setUnit] = useState(initial.unit);
  const [items, setItems] = useState(initial.items.map((i) => `${i.label}; ${i.value}`).join("\n"));
  const parsed = parseHolItems(items);
  const broken = parsed.filter((i) => !Number.isFinite(i.value)).length;
  return (
    <EditorFrame title={isNew ? "Neues Thema" : "Thema bearbeiten"} onSubmit={() => onSave({ topic, unit, items: parsed })} {...rest}>
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field label="Thema">
          <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} autoFocus />
        </Field>
        <Field label="Einheit">
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </div>
      <Field
        label={`Begriffe (${parsed.length})`}
        hint={broken ? `${broken} Zeile(n) ohne gültige Zahl. Format: Name; Zahl` : "Eine Zeile pro Begriff: Name; Zahl (z. B. Berlin; 3645). Ohne Tausenderpunkt, Kommazahlen gehen mit Komma."}
      >
        <TextArea value={items} onChange={(e) => setItems(e.target.value)} className="min-h-64" />
      </Field>
    </EditorFrame>
  );
}

export function JeoEditor({ initial, isNew, onSave, ...rest }: EditorProps<"jeopardy">) {
  const [name, setName] = useState(initial.name);
  const [questions, setQuestions] = useState(initial.questions);
  const set = (i: number, key: "question" | "answer", value: string) =>
    setQuestions(questions.map((q, j) => (j === i ? { ...q, [key]: value } : q)));
  return (
    <EditorFrame title={isNew ? "Neue Kategorie" : "Kategorie bearbeiten"} onSubmit={() => onSave({ name, questions })} {...rest}>
      <Field label="Kategorie">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <div className="space-y-3">
        <span className="label block">Fragen von leicht nach schwer (Punkte pro Zeile stehen in den Einstellungen)</span>
        {questions.map((q, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[4rem_1fr_16rem_auto] sm:items-center">
            <span className="font-mono font-bold text-faint">Zeile {i + 1}</span>
            <TextInput value={q.question} onChange={(e) => set(i, "question", e.target.value)} placeholder="Frage" />
            <TextInput value={q.answer} onChange={(e) => set(i, "answer", e.target.value)} placeholder="Antwort" />
            <Button variant="ghost" size="sm" title="Frage entfernen" disabled={questions.length <= 1} onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </div>
        ))}
        {questions.length < 10 && (
          <Button variant="secondary" size="sm" onClick={() => setQuestions([...questions, { question: "", answer: "" }])}>
            <Plus /> Frage
          </Button>
        )}
      </div>
    </EditorFrame>
  );
}

// Uploads one image file and hands back its /media path.
function ImageUpload({ value, onChange, compact }: { value?: string; onChange: (url: string | undefined) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/images", { method: "POST", headers: { "Content-Type": file.type }, body: file, credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className={cn("shrink-0 rounded-lg border border-line bg-black object-cover", compact ? "size-11" : "size-16")} />
      )}
      <label className={cn("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-bold uppercase hover:border-white", busy && "opacity-50")}>
        <ImagePlus className="size-4" /> {busy ? "Lädt …" : value ? "Ändern" : "Bild"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" onChange={pick} disabled={busy} />
      </label>
      {value && (
        <button type="button" title="Bild entfernen" onClick={() => onChange(undefined)} className="text-faint hover:text-bad">
          <X className="size-4" />
        </button>
      )}
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  );
}

// "52.5200, 13.4050" as Google Maps copies it, also "52.52 13.405" or a maps
// link with "@52.52,13.405".
function parseCoords(text: string): { lat: number; lng: number } | null {
  const m = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 };
}

interface SearchHit {
  name: string;
  label: string;
  lat: number;
  lng: number;
}

// OpenStreetMap search, straight from the admin's browser.
async function searchPlaces(query: string): Promise<SearchHit[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=de&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Suche fehlgeschlagen");
  const data: { name?: string; display_name: string; lat: string; lon: string }[] = await res.json();
  return data.map((d) => ({ name: d.name || d.display_name.split(",")[0], label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
}

export function GeoEditor({ initial, isNew, onSave, ...rest }: EditorProps<"geo">) {
  const [name, setName] = useState(initial.name);
  const [map, setMap] = useState<MapId>(initial.map);
  const [minKm, setMinKm] = useState(initial.minKm);
  const [places, setPlaces] = useState(initial.places);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);

  const update = (i: number, patch: Partial<GeoContent["places"][number]>) => setPlaces(places.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const flyTo = (pos: { lat: number; lng: number }) => setFocus((f) => ({ ...pos, key: (f?.key ?? 0) + 1 }));

  const add = (place: GeoContent["places"][number]) => {
    setPlaces([...places, place]);
    setSelected(places.length);
    flyTo(place);
  };

  // Coordinates are taken directly, anything else is searched on OpenStreetMap.
  const search = async () => {
    const text = query.trim();
    if (!text) return;
    setSearchError("");
    const coords = parseCoords(text);
    if (coords) {
      if (selected !== null) {
        update(selected, coords);
        flyTo(coords);
      } else add({ name: "Neuer Ort", ...coords });
      setQuery("");
      setHits(null);
      return;
    }
    try {
      const found = await searchPlaces(text);
      setHits(found);
      if (!found.length) setSearchError("Nichts gefunden");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Suche fehlgeschlagen");
    }
  };

  const takeHit = (hit: SearchHit) => {
    add({ name: hit.name, lat: Math.round(hit.lat * 10000) / 10000, lng: Math.round(hit.lng * 10000) / 10000 });
    setHits(null);
    setQuery("");
  };

  // Distances that were still the old map's defaults follow the new map.
  const changeMap = (next: MapId) => {
    if (minKm === MAPS[map].minKm) setMinKm(MAPS[next].minKm);
    setMap(next);
  };

  return (
    <EditorFrame title={isNew ? "Neue Kategorie" : "Kategorie bearbeiten"} onSubmit={() => onSave({ name, map, minKm, places })} {...rest}>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_12rem_12rem]">
        <Field label="Kategorie">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Karte">
          <Select value={map} onChange={(e) => changeMap(e.target.value as MapId)}>
            {(Object.keys(MAPS) as MapId[]).map((m) => (
              <option key={m} value={m}>{MAPS[m].label}</option>
            ))}
          </Select>
        </Field>
        <Field label="1 Punkt ab (km)">
          <TextInput type="number" min={1} value={minKm} onChange={(e) => setMinKm(Number(e.target.value))} />
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-2">
          <div className="relative">
            <div className="flex gap-2">
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    search();
                  }
                }}
                placeholder="Ort suchen oder Koordinaten einfügen"
              />
              <Button variant="secondary" onClick={search}>
                <Search /> Los
              </Button>
            </div>
            {(hits?.length || searchError) && (
              <ul className="absolute inset-x-0 top-12 z-[1000] space-y-1 rounded-xl border border-line-strong bg-zinc-950 p-1.5 shadow-xl">
                {searchError && <li className="px-2 py-1.5 text-sm text-bad">{searchError}</li>}
                {hits?.map((h, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => takeHit(h)} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-raised">
                      <span className="block font-bold">{h.name}</span>
                      <span className="block truncate text-xs text-faint">{h.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <PlaceMap
            region={map}
            places={places}
            selected={selected}
            focus={focus}
            onSelect={setSelected}
            onPick={(pos) => (selected !== null ? update(selected, pos) : add({ name: "Neuer Ort", ...pos }))}
          />
          <p className="text-xs text-faint">
            {selected !== null ? `Klick auf die Karte verschiebt "${places[selected]?.name}".` : "Klick auf die Karte legt einen neuen Ort an."}
          </p>
        </div>
        <div className="space-y-2">
          <span className="label block">Orte ({places.length})</span>
          <ul className="max-h-[31rem] space-y-1 overflow-y-auto pr-1">
            {places.map((p, i) => (
              <li
                key={i}
                onClick={() => {
                  setSelected(i);
                  flyTo(p);
                }}
                className={cn("cursor-pointer space-y-1.5 rounded-lg border p-2", i === selected ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}
              >
                <div className="flex items-center gap-1.5">
                  <MapPin className={cn("size-4 shrink-0", i === selected ? "text-accent-light" : "text-faint")} />
                  <input value={p.name} onChange={(e) => update(i, { name: e.target.value })} className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
                  <button
                    type="button"
                    title="Ort entfernen"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaces(places.filter((_, j) => j !== i));
                      setSelected(null);
                    }}
                    className="text-faint hover:text-bad"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <p className="font-mono text-xs text-faint">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</p>
                <ImageUpload compact value={p.image} onChange={(image) => update(i, { image })} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </EditorFrame>
  );
}

export function PicEditor({ initial, isNew, onSave, ...rest }: EditorProps<"pictures">) {
  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState<PictureKind>(initial.kind);
  const [items, setItems] = useState(initial.items);
  const update = (i: number, patch: Partial<PicContent["items"][number]>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  return (
    <EditorFrame title={isNew ? "Neue Kategorie" : "Kategorie bearbeiten"} onSubmit={() => onSave({ name, kind, items })} {...rest}>
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field label="Kategorie">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Art">
          <Select value={kind} onChange={(e) => setKind(e.target.value as PictureKind)}>
            {(Object.keys(PICTURE_KINDS) as PictureKind[]).map((k) => (
              <option key={k} value={k}>{PICTURE_KINDS[k]}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="space-y-2">
        <span className="label block">Bilder ({items.length})</span>
        {items.map((it, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
            <ImageUpload value={it.image || undefined} onChange={(image) => update(i, { image: image ?? "" })} />
            <TextInput value={it.answer} onChange={(e) => update(i, { answer: e.target.value })} placeholder="Lösung" className="min-w-40 flex-1" />
            <Button variant="ghost" size="sm" title="Bild entfernen" onClick={() => setItems(items.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setItems([...items, { image: "", answer: "" }])}>
          <Plus /> Bild
        </Button>
      </div>
    </EditorFrame>
  );
}

// Songrätsel: songs come from the iTunes search. The start point decides which
// part of the 30 s preview the snippets play; the play button tries 5 s of it.
export function SongEditor({ initial, isNew, onSave, ...rest }: EditorProps<"songs">) {
  const [name, setName] = useState(initial.name);
  const [songs, setSongs] = useState(initial.songs);
  const [playing, setPlaying] = useState<number | null>(null);
  const update = (i: number, patch: Partial<SongContent["songs"][number]>) => setSongs(songs.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const tryOut = (i: number) => {
    unlockSongAudio();
    if (playing === i) {
      stopSong();
      setPlaying(null);
      return;
    }
    setPlaying(i);
    void playSnippet(songs[i].preview, songs[i].offset, 5, Date.now() + 50);
    setTimeout(() => setPlaying((p) => (p === i ? null : p)), 5100);
  };

  return (
    <EditorFrame title={isNew ? "Neue Kategorie" : "Kategorie bearbeiten"} onSubmit={() => onSave({ name, songs })} {...rest}>
      <Field label="Kategorie">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <div className="space-y-2">
        <span className="label block">Songs ({songs.length})</span>
        <SongSearch
          down
          placeholder="Song suchen und hinzufügen …"
          onPick={(hit) => {
            if (songs.some((s) => s.trackId === hit.trackId)) return;
            setSongs([...songs, { ...hit, offset: 0 }]);
          }}
        />
        {songs.map((s, i) => (
          <div key={s.trackId} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.cover && <img src={s.cover} alt="" className="size-12 rounded-md object-cover" />}
            <div className="min-w-40 flex-1">
              <p className="truncate font-bold">{s.title}</p>
              <p className="truncate text-sm text-muted">{s.artist}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted" title="Ab wo in der 30-s-Hörprobe der Ausschnitt startet">
              Start
              <input
                type="range"
                min={0}
                max={SONG_PREVIEW_SECONDS - 5}
                step={0.5}
                value={s.offset}
                onChange={(e) => update(i, { offset: Number(e.target.value) })}
                className="w-32 accent-blue-500"
              />
              <span className="w-12 font-mono tabular-nums">{s.offset.toLocaleString("de-DE")} s</span>
            </label>
            <Button variant="secondary" size="sm" onClick={() => tryOut(i)}>
              {playing === i ? "Stopp" : "Anhören"}
            </Button>
            <Button variant="ghost" size="sm" title="Song entfernen" onClick={() => setSongs(songs.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </div>
        ))}
      </div>
    </EditorFrame>
  );
}
