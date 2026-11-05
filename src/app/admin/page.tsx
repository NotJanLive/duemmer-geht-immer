"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, LogOut, Pencil, Plus, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { Button, Panel, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/adminApi";
import { cn } from "@/lib/utils";
import { SCREEN_LABELS } from "@/types/game";
import { POOL_MODES, PoolContent, PoolData, PoolEntry, PoolMode, PoolSettings, WWM_MAX_POINTS, WWM_PER_LEVEL, WWM_QUESTIONS } from "@/types/pool";
import { EMPTY, GeoEditor, HolEditor, JeoEditor, LmsEditor, PicEditor, WwmEditor, contentOf, entryDetail, entryTitle } from "@/components/admin/Editors";
import { Field, PointsPill, Select, TextArea, TextInput } from "@/components/admin/fields";

type Tab = PoolMode | "settings" | "import";
type Sort = "fresh" | "played" | "newest" | "name" | "points";

const levels = Array.from({ length: WWM_MAX_POINTS }, (_, i) => i + 1);
const pointsOf = (e: PoolEntry<PoolMode>) => ("points" in e ? e.points : 0);

const ENTRY_WORD: Record<PoolMode, string> = {
  lastManStanding: "Themen",
  millionaire: "Fragen",
  higherLower: "Themen",
  geo: "Kategorien",
  pictures: "Kategorien",
  jeopardy: "Kategorien",
};

export default function AdminPage() {
  const [pool, setPool] = useState<PoolData | null>(null);
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");
  const [tab, setTab] = useState<Tab>("lastManStanding");

  const load = useCallback(async () => {
    try {
      setPool(await api<PoolData>("pool"));
      setState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setState("login");
      else throw err;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const logout = async () => {
    await api("logout", "POST", {});
    setPool(null);
    setState("login");
  };

  if (state === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center">
        <Spinner />
      </main>
    );
  }
  if (state === "login" || !pool) return <Login onDone={load} />;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="headline text-3xl sm:text-4xl">Fragenpool</h1>
          <Link href="/" className="text-sm text-faint hover:text-white">
            Dümmer geht Immer
          </Link>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut /> Abmelden
        </Button>
      </header>

      <nav className="flex flex-wrap gap-1.5">
        {[...POOL_MODES, "settings" as const, "import" as const].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-2 text-sm font-bold uppercase",
              tab === t ? "border-white bg-white text-black" : "border-line text-muted hover:border-line-strong hover:text-white",
            )}
          >
            {t === "settings" ? "Einstellungen" : t === "import" ? "Import / Export" : SCREEN_LABELS[t]}
            {t !== "settings" && t !== "import" && <span className="ml-1.5 font-mono text-xs opacity-60">{pool.entries[t].length}</span>}
          </button>
        ))}
      </nav>

      {tab === "settings" && <Settings settings={pool.settings} onSaved={(settings) => setPool({ ...pool, settings })} />}
      {tab === "import" && <ImportExport onImported={load} />}
      {tab !== "settings" && tab !== "import" && <ModePool key={tab} mode={tab} pool={pool} reload={load} />}
    </main>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("login", "POST", { password });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Das hat nicht geklappt");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4">
      <Panel className="stripe p-6">
        <form onSubmit={submit} className="space-y-4">
          <h1 className="headline text-3xl">Admin</h1>
          <Field label="Passwort">
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
          </Field>
          {error && <p className="text-sm text-bad">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !password}>
            Anmelden
          </Button>
        </form>
      </Panel>
    </main>
  );
}

function playedText(e: PoolEntry<PoolMode>) {
  if (!e.lastPlayedAt) return "Nie gespielt";
  const date = new Date(e.lastPlayedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `${e.playCount}× gespielt, zuletzt ${date}`;
}

function ModePool({ mode, pool, reload }: { mode: PoolMode; pool: PoolData; reload: () => Promise<void> }) {
  const entries = pool.entries[mode] as PoolEntry<PoolMode>[];
  const [query, setQuery] = useState("");
  const isWwm = mode === "millionaire";
  const [level, setLevel] = useState(0); // Millionaire points filter, 0 = all
  const [sort, setSort] = useState<Sort>(isWwm ? "points" : "fresh");
  const [editing, setEditing] = useState<{ id: string | null; content: PoolContent[PoolMode] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter(
      (e) =>
        (!q || JSON.stringify(contentOf(mode, e)).toLowerCase().includes(q)) &&
        (!level || pointsOf(e) === level),
    );
    const sorters: Record<Sort, (a: PoolEntry<PoolMode>, b: PoolEntry<PoolMode>) => number> = {
      fresh: (a, b) => (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0),
      played: (a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0),
      newest: (a, b) => b.createdAt - a.createdAt,
      name: (a, b) => entryTitle(mode, a).localeCompare(entryTitle(mode, b), "de"),
      points: (a, b) => pointsOf(a) - pointsOf(b) || (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0),
    };
    return [...list].sort(sorters[sort]);
  }, [entries, mode, query, level, sort]);

  const unplayed = entries.filter((e) => !e.lastPlayedAt).length;
  const perShow = { lastManStanding: pool.settings.lmsRounds, millionaire: WWM_QUESTIONS, higherLower: pool.settings.holRounds, geo: 1, pictures: pool.settings.picRounds, jeopardy: pool.settings.jeoCategories }[mode];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Das hat nicht geklappt");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (content: PoolContent[PoolMode]) => {
    const id = editing?.id;
    const ok = await run(() => (id ? api(`entries/${mode}/${id}`, "PUT", content) : api(`entries/${mode}`, "POST", content)));
    if (ok) setEditing(null);
  };

  const remove = (e: PoolEntry<PoolMode>) => {
    if (confirm(`"${entryTitle(mode, e)}" wirklich löschen?`)) run(() => api(`entries/${mode}/${e.id}`, "DELETE", {}));
  };

  const resetAll = () => {
    if (confirm(`Alle ${ENTRY_WORD[mode]} wieder als "nie gespielt" markieren?`)) run(() => api(`reset/${mode}`, "POST", {}));
  };

  const editorProps = {
    isNew: !editing?.id,
    error,
    busy,
    onCancel: () => {
      setEditing(null);
      setError("");
    },
  };

  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-muted">
          <span className="font-bold text-white">{entries.length}</span> {ENTRY_WORD[mode]} im Pool, davon{" "}
          <span className="font-bold text-white">{unplayed}</span> nie gespielt. Pro Show werden {perShow} gezogen.
          {unplayed < perShow && entries.length >= perShow && <span className="text-yellow-400"> Bald kommen Wiederholungen.</span>}
          {entries.length < perShow && <span className="text-bad"> Zu wenig für eine volle Show.</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetAll} disabled={busy}>
            <RotateCcw /> Gespielt zurücksetzen
          </Button>
          <Button size="sm" onClick={() => { setError(""); setEditing({ id: null, content: structuredClone(EMPTY[mode]) }); }}>
            <Plus /> Neu
          </Button>
        </div>
      </Panel>

      {isWwm && <LevelOverview entries={entries} active={level} onPick={(p) => setLevel(level === p ? 0 : p)} />}

      {editing && (
        <div key={editing.id ?? "new"}>
          {mode === "lastManStanding" && <LmsEditor initial={editing.content as PoolContent["lastManStanding"]} onSave={save} {...editorProps} />}
          {mode === "millionaire" && <WwmEditor initial={editing.content as PoolContent["millionaire"]} onSave={save} {...editorProps} />}
          {mode === "higherLower" && <HolEditor initial={editing.content as PoolContent["higherLower"]} onSave={save} {...editorProps} />}
          {mode === "geo" && <GeoEditor initial={editing.content as PoolContent["geo"]} onSave={save} {...editorProps} />}
          {mode === "pictures" && <PicEditor initial={editing.content as PoolContent["pictures"]} onSave={save} {...editorProps} />}
          {mode === "jeopardy" && <JeoEditor initial={editing.content as PoolContent["jeopardy"]} onSave={save} {...editorProps} />}
        </div>
      )}
      {!editing && error && <p className="text-sm text-bad">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_16rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-faint" />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" className="pl-9" />
        </div>
        {isWwm ? (
          <Select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            <option value={0}>Alle Punkte</option>
            {levels.map((p) => (
              <option key={p} value={p}>{p} {p === 1 ? "Punkt" : "Punkte"}</option>
            ))}
          </Select>
        ) : (
          <span className="hidden sm:block" />
        )}
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {isWwm && <option value="points">Nach Punkten</option>}
          <option value="fresh">Lange nicht gespielt zuerst</option>
          <option value="played">Zuletzt gespielt zuerst</option>
          <option value="newest">Neueste zuerst</option>
          <option value="name">Alphabetisch</option>
        </Select>
      </div>

      <ul className="space-y-1.5">
        {shown.length === 0 && <li className="py-10 text-center text-faint">Nichts gefunden</li>}
        {shown.map((e) => (
          <li key={e.id} className={cn("card flex items-start gap-3 rounded-xl p-3", editing?.id === e.id && "border-accent")}>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-bold">{entryTitle(mode, e)}</p>
              <p className="truncate text-sm text-muted">{entryDetail(mode, e)}</p>
              <div className="flex flex-wrap items-center gap-2">
                {"points" in e && <PointsPill value={e.points} />}
                <span className={cn("font-mono text-xs", e.lastPlayedAt ? "text-faint" : "text-good")}>{playedText(e)}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" title="Bearbeiten" onClick={() => { setError(""); setEditing({ id: e.id, content: structuredClone(contentOf(mode, e)) }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="sm" title="Löschen" className="hover:text-bad" onClick={() => remove(e)} disabled={busy}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Millionaire always plays two questions per points level. This shows per
// level how many questions there are and how many were never played.
function LevelOverview({ entries, active, onPick }: { entries: PoolEntry<PoolMode>[]; active: number; onPick: (p: number) => void }) {
  return (
    <Panel className="space-y-3 p-4">
      <p className="label">Ungespielt pro Punktestufe</p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
        {levels.map((p) => {
          const all = entries.filter((e) => pointsOf(e) === p);
          const fresh = all.filter((e) => !e.lastPlayedAt).length;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPick(p)}
              title={`${p} Punkte: ${all.length} Fragen, ${fresh} nie gespielt`}
              className={cn(
                "rounded-lg border px-1 py-1.5 text-center",
                active === p ? "border-white bg-white/10" : fresh < WWM_PER_LEVEL ? "border-bad/50 bg-bad-soft" : "border-line hover:border-line-strong",
              )}
            >
              <span className="block font-mono text-xs text-faint">{p} P</span>
              <span className={cn("block text-lg font-bold tabular-nums", fresh < WWM_PER_LEVEL && "text-bad")}>{fresh}</span>
              <span className="block font-mono text-[11px] text-faint">von {all.length}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

type NumberKey =
  | "lmsRounds"
  | "lmsPointsPerPlace"
  | "holRounds"
  | "holPoints"
  | "geoMaxPoints"
  | "geoRounds"
  | "geoSeconds"
  | "picRounds"
  | "picPerRound"
  | "picRevealSeconds"
  | "jeoCategories";
type ListKey = "jeoPoints";

const SECTIONS: { title: string; note?: string; numbers: { key: NumberKey; label: string; hint: string }[]; list?: { key: ListKey; label: string; hint: string; unit: string }; tiers?: boolean }[] = [
  {
    title: "Last Man Standing",
    numbers: [
      { key: "lmsRounds", label: "Runden", hint: "Themen pro Show" },
      { key: "lmsPointsPerPlace", label: "Punkte pro Platz", hint: "Letzter Platz bekommt das einmal, jeder Platz darüber einmal mehr" },
    ],
  },
  {
    title: "Wer wird Millionär?",
    numbers: [],
    note: `Fest: ${WWM_QUESTIONS} Fragen, je ${WWM_PER_LEVEL} pro Stufe von 1 bis ${WWM_MAX_POINTS} Punkten. Die Punkte einer Frage legst du beim Anlegen der Frage fest.`,
  },
  {
    title: "Higher or Lower",
    numbers: [
      { key: "holRounds", label: "Runden", hint: "Themen pro Show" },
      { key: "holPoints", label: "Punkte pro richtiger Einordnung", hint: "Wert der Plus- und Minus-Knöpfe beim Spielleiter" },
    ],
  },
  {
    title: "Wo liegt das?",
    numbers: [
      { key: "geoMaxPoints", label: "Punkte genau drauf", hint: "Sinkt mit jedem Kilometer bis auf 1" },
      { key: "geoRounds", label: "Orte pro Show", hint: "Aus einer Kategorie" },
      { key: "geoSeconds", label: "Sekunden pro Ort", hint: "Zeit zum Pin setzen" },
    ],
  },
  {
    title: "Bildrätsel",
    numbers: [
      { key: "picRounds", label: "Runden", hint: "Kategorien pro Show" },
      { key: "picPerRound", label: "Bilder pro Runde", hint: "" },
      { key: "picRevealSeconds", label: "Sekunden bis ganz aufgedeckt", hint: "" },
    ],
    tiers: true,
  },
  {
    title: "Jeopardy",
    numbers: [{ key: "jeoCategories", label: "Kategorien", hint: "Spalten auf dem Board" }],
    list: { key: "jeoPoints", label: "Punkte pro Zeile", hint: "Von oben (leicht) nach unten (schwer). Die Anzahl ist die Zahl der Fragen pro Kategorie.", unit: "Zeilen" },
  },
];

const parseList = (text: string) =>
  text
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number);

// "15:5, 35:3, 100:1" <-> [{ until: 15, points: 5 }, ...]
const formatTiers = (tiers: PoolSettings["picTiers"]) => tiers.map((t) => `${t.until}:${t.points}`).join(", ");
const parseTiers = (text: string) =>
  text
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((part) => {
      const [until, points] = part.split(":").map(Number);
      return { until, points };
    });

function Settings({ settings, onSaved }: { settings: PoolSettings; onSaved: (s: PoolSettings) => void }) {
  const [numbers, setNumbers] = useState(settings);
  const [lists, setLists] = useState({ jeoPoints: settings.jeoPoints.join(", ") });
  const [tiers, setTiers] = useState(formatTiers(settings.picTiers));
  const [message, setMessage] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = { ...numbers, jeoPoints: parseList(lists.jeoPoints), picTiers: parseTiers(tiers) };
      const saved = await api<PoolSettings>("settings", "PUT", body);
      onSaved(saved);
      setLists({ jeoPoints: saved.jeoPoints.join(", ") });
      setTiers(formatTiers(saved.picTiers));
      setMessage("Gespeichert");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Das hat nicht geklappt");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {SECTIONS.map((section) => {
        const list = section.list ? parseList(lists[section.list.key]) : [];
        const valid = list.every((n) => Number.isInteger(n) && n >= 0);
        return (
          <Panel key={section.title} className="space-y-4 p-4 sm:p-5">
            <h2 className="headline text-2xl">{section.title}</h2>
            {section.note && <p className="text-sm text-muted">{section.note}</p>}
            {section.numbers.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {section.numbers.map((f) => (
                  <Field key={f.key} label={f.label} hint={f.hint}>
                    <TextInput type="number" min={1} value={numbers[f.key]} onChange={(e) => setNumbers({ ...numbers, [f.key]: Number(e.target.value) })} />
                  </Field>
                ))}
              </div>
            )}
            {section.tiers && (
              <Field label="Punkte nach Fortschritt" hint="Prozent:Punkte. Wer bis zu diesem Fortschritt buzzert, bekommt die Punkte.">
                <TextInput value={tiers} onChange={(e) => setTiers(e.target.value)} className="font-mono" />
              </Field>
            )}
            {section.list && (
              <Field label={section.list.label} hint={section.list.hint}>
                <TextInput value={lists[section.list.key]} onChange={(e) => setLists({ ...lists, [section.list!.key]: e.target.value })} className="font-mono" />
                <span className={cn("mt-1.5 block font-mono text-xs", valid ? "text-muted" : "text-bad")}>
                  {valid
                    ? `${list.length} ${section.list.unit}, zusammen ${list.reduce((a, b) => a + b, 0)} Punkte${section.list.key === "jeoPoints" ? ` pro Kategorie, ${list.reduce((a, b) => a + b, 0) * numbers.jeoCategories} auf dem Board` : ""}`
                    : "Nur ganze Zahlen ab 0"}
                </span>
              </Field>
            )}
          </Panel>
        );
      })}
      <div className="flex items-center justify-end gap-3">
        {message && <span className="text-sm text-muted">{message}</span>}
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
}

const IMPORT_EXAMPLE = `{
  "mode": "millionaire",
  "entries": [
    {
      "question": "Wie viele Beine hat eine Spinne?",
      "options": ["6", "8", "10", "12"],
      "answer": 1,
      "points": 1
    }
  ]
}`;

const FORMATS: Record<PoolMode, string> = {
  lastManStanding: '{ "topic": "Bundesländer", "items": ["Bayern", "Hessen"] }',
  millionaire: '{ "question": "…", "options": ["A", "B", "C", "D"], "answer": 0, "points": 1 }',
  higherLower: '{ "topic": "Kalorien pro 100 g", "unit": "kcal", "items": [{ "label": "Apfel", "value": 52 }] }',
  geo: '{ "name": "Deutsche Städte", "map": "de", "minKm": 400, "places": [{ "name": "Kiel", "lat": 54.32, "lng": 10.12 }] }',
  pictures: '{ "name": "Flaggen", "kind": "reveal", "items": [{ "image": "/media/….png", "answer": "Japan" }] }',
  jeopardy: '{ "name": "Geschichte", "questions": [{ "question": "…", "answer": "…" }] }',
};

function ImportExport({ onImported }: { onImported: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const readFile = async (file: File | undefined) => {
    if (file) setText(await file.text());
  };

  const submit = async () => {
    setResult(null);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      return setResult({ ok: false, message: "Das ist kein gültiges JSON" });
    }
    if (replace && !confirm("Ersetzen löscht die bisherigen Einträge der importierten Modi. Fortfahren?")) return;
    setBusy(true);
    try {
      const r = await api<{ added: Record<PoolMode, number> }>("import", "POST", { ...data, replace });
      const summary = Object.entries(r.added).map(([m, n]) => `${n} bei ${SCREEN_LABELS[m as PoolMode]}`).join(", ");
      setResult({ ok: true, message: `Importiert: ${summary}` });
      setText("");
      await onImported();
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Import fehlgeschlagen", details: err instanceof ApiError ? err.details : [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Panel className="space-y-4 p-4 sm:p-5">
        <h2 className="headline text-2xl">Import</h2>
        <p className="text-sm text-muted">
          JSON-Datei hochladen oder einfügen. Entweder ein Modus mit Einträgen wie im Beispiel, oder ein kompletter Export (dann
          werden alle enthaltenen Modi importiert). Es wird erst alles geprüft. Bei einem Fehler wird nichts geändert.
        </p>
        <input type="file" accept="application/json,.json" onChange={(e) => readFile(e.target.files?.[0])} className="block text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:font-bold file:text-white" />
        <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder={IMPORT_EXAMPLE} className="min-h-72" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="size-4 accent-blue-600" />
          Bisherige Einträge der importierten Modi ersetzen statt ergänzen
        </label>
        {result && (
          <div className={cn("rounded-xl border px-3 py-2 text-sm", result.ok ? "border-good/50 text-good" : "border-bad/50 bg-bad-soft text-bad")}>
            <p>{result.message}</p>
            {result.details && result.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                {result.details.map((d) => <li key={d}>{d}</li>)}
              </ul>
            )}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy || !text.trim()}>
            <Upload /> Importieren
          </Button>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel className="space-y-3 p-4 sm:p-5">
          <h2 className="headline text-2xl">Export</h2>
          <p className="text-sm text-muted">Lädt den ganzen Pool mit Spielstatistik als JSON. Gut als Backup.</p>
          <a href="/api/admin/export" download>
            <Button variant="secondary" className="w-full">
              <Download /> Pool herunterladen
            </Button>
          </a>
        </Panel>
        <Panel className="space-y-3 p-4 sm:p-5">
          <h2 className="headline text-2xl">Formate</h2>
          <p className="text-sm text-muted">
            <code className="font-mono">mode</code> ist einer von {POOL_MODES.map((m) => <code key={m} className="font-mono"> {m}</code>)}.{" "}
            Bei Millionär ist <code className="font-mono">points</code> 1 bis {WWM_MAX_POINTS} (mehr Punkte = schwerer), <code className="font-mono">answer</code> zählt ab 0.
          </p>
          {POOL_MODES.map((m) => (
            <div key={m}>
              <p className="label">{SCREEN_LABELS[m]}</p>
              <code className="block rounded-lg bg-black/40 p-2 font-mono text-xs break-all text-muted">{FORMATS[m]}</code>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
