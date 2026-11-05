"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Crown, LogIn, Users } from "lucide-react";
import { Button, Panel, Spinner } from "@/components/ui";
import { connectSocket } from "@/lib/socket";
import { StoredSession, clearSession, lastName, loadSession, saveSession, sessionIdFor } from "@/lib/session";
import { SessionReply } from "@/types/game";

type View = "choose" | "create" | "join";

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<StoredSession | null>(null);

  useEffect(() => {
    // Reading storage and the URL only works after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setResume(loadSession());
    setName(lastName());
    const linked = new URLSearchParams(window.location.search).get("code");
    if (linked) {
      setCode(linked.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
      setView("join");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const open = (next: View) => {
    setError("");
    setView(next);
  };

  const finish = (r: SessionReply, trimmed: string) => {
    if (!r.ok || !r.roomCode || !r.sessionId || !r.role) {
      setError(r.error ?? "Das hat nicht geklappt");
      setBusy(false);
      return;
    }
    saveSession({ roomCode: r.roomCode, sessionId: r.sessionId, role: r.role, name: trimmed });
    router.push(`/room/${r.roomCode}`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Bitte gib deinen Namen ein");
    if (view === "join" && code.length !== 6) return setError("Der Raumcode hat 6 Zeichen");

    setBusy(true);
    setError("");
    try {
      const socket = await connectSocket();
      if (view === "create") socket.emit("createRoom", trimmed, (r) => finish(r, trimmed));
      else socket.emit("joinRoom", code, trimmed, sessionIdFor(code), (r) => finish(r, trimmed));
    } catch {
      setError("Keine Verbindung zum Server");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <h1 className="headline title-text mb-12 pb-1 text-center text-5xl sm:text-7xl">
        Dümmer
        <br />
        geht immer
      </h1>

      {view === "choose" && (
        <div className="animate-rise space-y-3">
          {resume && (
            <Panel className="mb-8 p-5">
              <p className="label">Offenes Spiel</p>
              <p className="mt-2 text-lg font-semibold">
                Raum <span className="font-mono">{resume.roomCode}</span> als {resume.role === "host" ? "Spielleiter" : resume.name}
              </p>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={() => router.push(`/room/${resume.roomCode}`)}>
                  Weiterspielen <ArrowRight />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearSession();
                    setResume(null);
                  }}
                >
                  Verwerfen
                </Button>
              </div>
            </Panel>
          )}
          <Button size="lg" className="w-full" onClick={() => open("join")}>
            <Users /> Spiel beitreten
          </Button>
          <Button size="lg" variant="secondary" className="w-full" onClick={() => open("create")}>
            <Crown /> Spiel erstellen
          </Button>
        </div>
      )}

      {view !== "choose" && (
        <Panel className="stripe animate-rise p-5 sm:p-7">
          <h2 className="headline text-3xl">{view === "create" ? "Neues Spiel" : "Beitreten"}</h2>
          <p className="mt-2 text-muted">
            {view === "create" ? "Du bist der Spielleiter und siehst alle Lösungen." : "Gib deinen Namen und den Raumcode ein."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <Field label="Dein Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus={!name}
                autoComplete="nickname"
                disabled={busy}
                className="h-12 w-full rounded-xl border border-line bg-zinc-950/60 px-4 text-lg outline-none transition-colors placeholder:text-faint focus:border-accent"
                placeholder={view === "create" ? "z. B. Jan" : "Wie sollen dich alle nennen?"}
              />
            </Field>

            {view === "join" && (
              <Field label="Raumcode">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  autoFocus={!!name && !code}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  className="h-16 w-full rounded-xl border border-line bg-zinc-950/60 px-4 text-center font-mono text-3xl font-bold tracking-[0.4em] uppercase outline-none transition-colors placeholder:text-line-strong focus:border-accent"
                  placeholder="ABC123"
                />
              </Field>
            )}

            {error && <p className="font-medium text-bad">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => open("choose")} disabled={busy}>
                <ArrowLeft /> Zurück
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? <Spinner className="size-4 border-black/30 border-t-black" /> : view === "create" ? "Raum erstellen" : <>Beitreten <LogIn /></>}
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
    </label>
  );
}
