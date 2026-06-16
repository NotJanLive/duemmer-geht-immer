"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminJeopardy() {
  const { gameState } = useGameStore();
  const [leaderboardOpen, setLeaderboardOpen] = useState(true);

  if (!gameState || !gameState.jeopardy) return null;

  const jeo = gameState.jeopardy;
  const sortedPlayers = [...gameState.players].sort((a, b) => 
    a.name.localeCompare(b.name, "de")
  );
  const currentPlayer = sortedPlayers[jeo.currentPlayerIndex % sortedPlayers.length];
  const buzzedPlayer = gameState.players.find(p => p.id === jeo.buzzedPlayer);
  
  const isFirstAttempt = jeo.buzzedPlayer === currentPlayer?.id && !jeo.openForAll;

  const handleSelectQuestion = (categoryIndex: number, questionIndex: number) => {
    const socket = getSocket();
    socket.emit("selectCategory", categoryIndex, questionIndex);
  };

  const handleOpenBuzzer = () => {
    const socket = getSocket();
    socket.emit("openBuzzer");
  };

  const handleCloseBuzzer = () => {
    const socket = getSocket();
    socket.emit("closeBuzzer");
  };

  const handleAnswerCorrect = (correct: boolean) => {
    const socket = getSocket();
    socket.emit("answerCorrect", correct);
  };

  const handleDiscard = () => {
    const socket = getSocket();
    socket.emit("jeopardyDiscard");
  };

  const handleResetBuzzer = () => {
    const socket = getSocket();
    socket.emit("jeopardyResetBuzzer");
  };

  const handleShowLeaderboard = () => {
    const socket = getSocket();
    socket.emit("showLeaderboard");
  };

  const allQuestionsAnswered = jeo.categories.every(cat => 
    cat.questions.every(q => q.revealed)
  );

  const playersWhoCanBuzz = gameState.players.filter(p => p.canBuzz && !p.hasBuzzed).length;

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6 pb-24">
        {/* Current Player Info */}
        {!jeo.currentQuestion && (
          <Card className="bg-zinc-900/50 border-zinc-800 shadow-xl rounded-2xl">
            <CardContent className="p-3">
              <div className="flex items-center justify-center gap-3">
                <span className="text-zinc-500 text-xs uppercase font-black tracking-widest">Am Zug:</span>
                <span className="text-white font-black uppercase italic tracking-tight text-xl">{currentPlayer?.name}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Question & Control */}
        {jeo.currentQuestion && (
        <Card className="bg-gradient-to-br from-blue-900 to-black border-blue-800 shadow-2xl overflow-hidden relative rounded-3xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="flex items-baseline gap-1 bg-white text-black px-4 py-1 rounded-full shadow-lg">
                  {jeo.currentQuestion.originalPoints && jeo.currentQuestion.originalPoints > jeo.currentQuestion.points && (
                    <span className="text-sm font-black italic line-through text-red-600 mr-2 opacity-70">
                      {jeo.currentQuestion.originalPoints}
                    </span>
                  )}
                  <span className="text-xl font-black italic">{jeo.currentQuestion.points}</span>
                  <span className="text-[10px] font-black uppercase opacity-50">PKT</span>
                </div>
              </div>
              <h3 className="text-3xl font-black text-white italic tracking-tighter leading-tight mb-4">
                {jeo.currentQuestion.question}
              </h3>
              <div className="inline-flex items-center gap-2 bg-green-600/20 text-green-400 border border-green-500/30 px-4 py-1 rounded-full font-black uppercase italic tracking-widest text-sm">
                Lösung: {jeo.currentQuestion.answer}
              </div>
            </div>

            {/* Answer & Buzzer Control */}
            <div className="p-6 rounded-2xl bg-black/40 border border-zinc-800 shadow-inner">
              {jeo.buzzedPlayer ? (
                <div className="text-center">
                  <p className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.2em] mb-2 italic">
                    {isFirstAttempt ? "Eigene Frage für:" : "Gebuzzert von:"}
                  </p>
                  <p className="text-4xl font-black text-white uppercase italic tracking-tighter mb-6 drop-shadow-lg">{buzzedPlayer?.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="lg"
                      onClick={() => handleAnswerCorrect(true)}
                      className="bg-green-600 hover:bg-green-700 text-white h-16 font-black uppercase italic shadow-lg rounded-2xl"
                    >
                      ✓ RICHTIG (+{jeo.currentQuestion.points}P)
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => handleAnswerCorrect(false)}
                      variant="destructive"
                      className="h-16 font-black uppercase italic shadow-lg rounded-2xl"
                    >
                      ✗ FALSCH → BUZZER FREI
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                     <div className={`w-2 h-2 rounded-full ${jeo.buzzerOpen ? "bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-red-500"}`} />
                     <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">
                       {jeo.buzzerOpen 
                         ? `Buzzer offen (${playersWhoCanBuzz} Spieler)` 
                         : "Buzzer geschlossen"
                       }
                     </p>
                  </div>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {!jeo.buzzerOpen ? (
                      <Button
                        onClick={handleOpenBuzzer}
                        className="bg-green-600 hover:bg-green-700 text-white font-black uppercase italic h-12 px-6 rounded-xl"
                      >
                        🔔 Buzzer öffnen
                      </Button>
                    ) : (
                      <Button
                        onClick={handleCloseBuzzer}
                        variant="outline"
                        className="border-red-500 text-red-500 font-black uppercase italic h-12 px-6 hover:bg-red-500/10 rounded-xl"
                      >
                        Buzzer schließen
                      </Button>
                    )}
                    <Button
                      onClick={handleResetBuzzer}
                      variant="outline"
                      className="border-yellow-500 text-yellow-500 font-black uppercase italic h-12 px-6 hover:bg-yellow-500/10 rounded-xl"
                    >
                      🔄 Reset Buzz
                    </Button>
                    <Button
                      onClick={handleDiscard}
                      variant="outline"
                      className="border-zinc-700 text-zinc-500 font-black uppercase italic h-12 px-6 hover:bg-zinc-800 rounded-xl"
                    >
                      🗑️ Verwerfen (0P)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Jeopardy Grid (Larger Categories) */}
        {!jeo.currentQuestion && (
        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-3xl">
          <CardContent className="p-4">
            <div className="grid grid-cols-6 gap-2">
              {jeo.categories.map((category, ci) => (
                <div key={`cat-${ci}`} className="p-2 bg-blue-950 border border-blue-900 text-white text-center text-[9px] sm:text-xs font-black uppercase tracking-tighter rounded-xl flex items-center justify-center min-h-[50px] sm:min-h-[60px] leading-tight break-words hyphens-auto">
                  {category.name}
                </div>
              ))}
              
              {[0, 1, 2, 3, 4].map((qi) => (
                jeo.categories.map((category, ci) => {
                  const question = category.questions[qi];
                  return (
                    <button
                      key={`q-${ci}-${qi}`}
                      className={`aspect-square rounded-xl flex items-center justify-center text-lg font-black italic transition-all shadow-md ${
                        question.revealed
                          ? question.discarded
                            ? "bg-red-950/30 text-red-500 border border-red-900/50 opacity-60"
                            : "bg-zinc-950 text-zinc-800 border border-zinc-900 scale-95 opacity-50"
                          : "bg-blue-600 border-2 border-blue-400 text-white hover:bg-blue-500 hover:scale-105 active:scale-90 shadow-lg"
                      }`}
                      onClick={() => !question.revealed && handleSelectQuestion(ci, qi)}
                      disabled={question.revealed}
                    >
                      {question.revealed ? (question.discarded ? "✕" : "✓") : question.points}
                    </button>
                  );
                })
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        {/* End Game Button */}
        {allQuestionsAnswered && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-md border-t border-zinc-800 z-50">
          <Button
            size="lg"
            className="w-full h-14 bg-white text-black hover:bg-zinc-200 text-lg font-black uppercase italic shadow-xl rounded-2xl"
            onClick={handleShowLeaderboard}
          >
            Zum Finale →
          </Button>
        </div>
        )}
      </div>

      {/* Slide-in Panel - Desktop Only */}
      <div
        className={`hidden lg:block fixed right-0 top-1/2 -translate-y-1/2 w-72 bg-zinc-900/95 border-2 border-zinc-800 shadow-2xl backdrop-blur-md z-40 transition-transform duration-300 ease-in-out rounded-l-3xl ${
          leaderboardOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] italic opacity-50">Live Rundenstand</p>
            <Button
              onClick={() => setLeaderboardOpen(false)}
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-zinc-800 rounded-full"
            >
              <span className="text-zinc-400">✕</span>
            </Button>
          </div>
          <div className="space-y-3">
            {[...gameState.players]
              .sort((a, b) => b.currentModeScore - a.currentModeScore)
              .map((p, index) => {
                const isCurrent = currentPlayer?.id === p.id;

                return (
                  <div
                    key={p.id}
                    className="w-full flex flex-col p-3 rounded-2xl transition-all border border-white/5 bg-black/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-left">
                        <span className={`text-xs font-black italic ${index === 0 ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-tight truncate max-w-[120px] text-zinc-400`}>
                              {p.name}
                            </span>
                            {isCurrent && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black italic tracking-tighter text-zinc-500">
                          {p.currentModeScore}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-zinc-700">PKT</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Toggle Button - Attached to Panel */}
        <button
          onClick={() => setLeaderboardOpen(!leaderboardOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full h-28 w-14 bg-zinc-900 border-2 border-r-0 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 rounded-l-3xl rounded-r-none shadow-2xl flex flex-col items-center justify-center gap-2 p-0 transition-colors cursor-pointer"
        >
          <span className="text-white text-2xl font-black">
            {leaderboardOpen ? '→' : '←'}
          </span>
          <span className="text-[10px] text-zinc-400 font-black uppercase [writing-mode:vertical-lr] rotate-180 tracking-wider">
            Punkte
          </span>
        </button>
      </div>

      {/* Mobile - Bottom Leaderboard */}
      <div className="lg:hidden mt-16">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mb-6 text-center italic opacity-50">Live Rundenstand</p>
          <div className="space-y-3">
            {[...gameState.players]
              .sort((a, b) => b.currentModeScore - a.currentModeScore)
              .map((p, index) => {
                const isCurrent = currentPlayer?.id === p.id;

                return (
                  <div
                    key={p.id}
                    className="w-full flex flex-col p-3 rounded-2xl transition-all border border-white/5 bg-black/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-left">
                        <span className={`text-xs font-black italic ${index === 0 ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black uppercase tracking-tight text-zinc-400">
                              {p.name}
                            </span>
                            {isCurrent && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black italic tracking-tighter text-zinc-500">
                          {p.currentModeScore}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-zinc-700">PKT</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </>
  );
}
