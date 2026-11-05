"use client";

import { useEffect } from "react";
import { ArrowRight, Bell, BellOff, Check, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame, useRoomStore } from "@/lib/store";
import { hostAction, playerAction } from "@/lib/socket";
import { JeoState } from "@/types/game";
import { Button, Panel, Pill } from "@/components/ui";
import { ModeHeading, ModeLayout, Scoreboard, StatusBanner } from "@/components/room/Shell";

export default function Jeopardy() {
  const game = useGame();
  const role = useRoomStore((s) => s.role);
  const meId = useRoomStore((s) => s.playerId);
  const jeo = game.jeo!;
  const active = jeo.active;
  const isHost = role === "host";
  const name = (id: string | null) => game.players.find((p) => p.id === id)?.name ?? "";
  const remaining = jeo.categories.reduce((n, c) => n + c.questions.filter((q) => q.status === "open").length, 0);

  const canBuzz = !isHost && !!meId && !!active?.buzzerOpen && !active.answeringId && !active.tried.includes(meId);
  useEffect(() => {
    if (!canBuzz) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        playerAction({ type: "jeo.buzz" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canBuzz]);

  return (
    <ModeLayout
      side={<Scoreboard players={game.players} meId={meId} turnId={active ? active.answeringId : jeo.chooserId} />}
      actions={
        isHost &&
        (active ? <HostQuestionActions jeo={jeo} /> : remaining === 0 ? (
          <Button onClick={() => hostAction({ type: "showLeaderboard" })}>
            Zum Punktestand <ArrowRight />
          </Button>
        ) : undefined)
      }
    >
      <ModeHeading eyebrow="Jeopardy" title={active ? jeo.categories[active.categoryIndex].name : "Spielbrett"} meta={<Pill>{remaining} Fragen offen</Pill>} />

      {!active ? (
        <>
          {remaining === 0 ? (
            <StatusBanner tone="good">Alle Fragen sind gespielt</StatusBanner>
          ) : jeo.chooserId === meId ? (
            <StatusBanner tone="accent">Du bist dran. Sag dem Spielleiter, welche Frage du willst.</StatusBanner>
          ) : (
            <StatusBanner>{name(jeo.chooserId)} wählt eine Frage</StatusBanner>
          )}
          <Board jeo={jeo} isHost={isHost} name={name} />
        </>
      ) : (
        <ActiveQuestion jeo={jeo} isHost={isHost} meId={meId} canBuzz={canBuzz} name={name} />
      )}
    </ModeLayout>
  );
}

function Board({ jeo, isHost, name }: { jeo: JeoState; isHost: boolean; name: (id: string | null) => string }) {
  const rows = Math.max(...jeo.categories.map((c) => c.questions.length));
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="grid min-w-[520px] gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${jeo.categories.length}, minmax(0, 1fr))` }}>
        {jeo.categories.map((cat) => (
          <div key={cat.name} className="flex min-h-12 items-end justify-center px-1 pb-1 text-center text-xs font-bold uppercase italic leading-tight sm:text-base">
            {cat.name}
          </div>
        ))}
        {Array.from({ length: rows }, (_, qi) =>
          jeo.categories.map((cat, ci) => {
            const q = cat.questions[qi];
            if (!q) return <div key={`${ci}-${qi}`} />;
            const open = q.status === "open";
            return (
              <button
                key={q.id}
                disabled={!isHost || !open}
                onClick={() => hostAction({ type: "jeo.select", categoryIndex: ci, questionIndex: qi })}
                title={q.answeredBy ? `Beantwortet von ${name(q.answeredBy)}` : undefined}
                className={cn(
                  "grid aspect-[4/3] place-items-center rounded-xl border-2 text-xl font-black italic tabular-nums transition-all sm:text-4xl",
                  open ? "border-blue-400 bg-blue-600 text-white shadow-lg" : q.status === "discarded" ? "border-red-900/50 bg-bad-soft text-red-500/70" : "border-line bg-zinc-950 text-line-strong",
                  open && isHost && "hover:scale-105 hover:bg-blue-500 active:scale-95",
                )}
              >
                {open ? q.points : q.status === "discarded" ? <X className="size-5" /> : <Check className="size-5" />}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function ActiveQuestion({
  jeo,
  isHost,
  meId,
  canBuzz,
  name,
}: {
  jeo: JeoState;
  isHost: boolean;
  meId: string | null;
  canBuzz: boolean;
  name: (id: string | null) => string;
}) {
  const active = jeo.active!;
  const question = jeo.categories[active.categoryIndex].questions[active.questionIndex];
  const halved = active.points < active.originalPoints;

  let status;
  if (active.answeringId === meId) status = <StatusBanner tone="accent">Du antwortest jetzt!</StatusBanner>;
  else if (active.answeringId) status = <StatusBanner>{name(active.answeringId)} {active.firstAttempt ? "darf zuerst antworten" : "hat gebuzzert"}</StatusBanner>;
  else if (active.buzzerOpen) status = <StatusBanner tone="good">Buzzer ist offen</StatusBanner>;
  else status = <StatusBanner>Buzzer ist geschlossen</StatusBanner>;

  return (
    <>
      <Panel key={question.id} className="stripe animate-pop border-blue-800 bg-gradient-to-br from-blue-900 to-black p-6 text-center sm:p-10">
        <div className="mb-4 flex justify-center gap-2">
          {halved && <Pill className="line-through">{active.originalPoints}</Pill>}
          <Pill tone="accent">{active.points} Punkte</Pill>
        </div>
        <p className="text-2xl font-bold leading-snug sm:text-4xl">{question.question}</p>
        {isHost && (
          <p className="mt-6 inline-block rounded-xl border border-good/50 bg-good-soft px-4 py-2 font-bold text-good">Lösung: {question.answer}</p>
        )}
      </Panel>

      {status}

      {!isHost && (active.buzzerOpen || active.tried.includes(meId ?? "")) && (
        <button
          disabled={!canBuzz}
          onPointerDown={() => canBuzz && playerAction({ type: "jeo.buzz" })}
          className={cn(
            "headline mx-auto grid aspect-square w-full max-w-64 place-items-center rounded-full border-4 text-4xl transition-transform select-none",
            canBuzz ? "border-red-400 bg-red-600 text-white shadow-[0_0_70px_-5px_rgba(220,38,38,0.7)] active:scale-95 active:bg-red-700" : "border-line bg-surface text-base text-faint",
          )}
        >
          {canBuzz ? "BUZZ" : "Schon geraten"}
        </button>
      )}
    </>
  );
}

function HostQuestionActions({ jeo }: { jeo: JeoState }) {
  const active = jeo.active!;
  if (active.answeringId) {
    return (
      <>
        <Button variant="ghost" onClick={() => hostAction({ type: "jeo.discard" })}>
          <Trash2 /> Verwerfen
        </Button>
        <Button variant="bad" onClick={() => hostAction({ type: "jeo.judge", correct: false })}>
          <X /> Falsch
        </Button>
        <Button variant="good" onClick={() => hostAction({ type: "jeo.judge", correct: true })}>
          <Check /> Richtig (+{active.points})
        </Button>
      </>
    );
  }
  return (
    <>
      <Button variant="ghost" onClick={() => hostAction({ type: "jeo.discard" })}>
        <Trash2 /> Verwerfen
      </Button>
      <Button variant="secondary" onClick={() => hostAction({ type: "jeo.resetBuzzer" })}>
        <RotateCcw /> Alle dürfen wieder
      </Button>
      <Button variant={active.buzzerOpen ? "secondary" : "primary"} onClick={() => hostAction({ type: "jeo.buzzer", open: !active.buzzerOpen })}>
        {active.buzzerOpen ? <><BellOff /> Buzzer schließen</> : <><Bell /> Buzzer öffnen</>}
      </Button>
    </>
  );
}
