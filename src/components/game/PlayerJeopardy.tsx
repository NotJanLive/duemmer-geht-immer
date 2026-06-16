"use client";

import { useState, useEffect, useMemo } from "react";
import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PlayerJeopardy() {
  const { gameState, playerId } = useGameStore();
  const [buzzerPressed, setBuzzerPressed] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(true);

  const jeo = gameState?.jeopardy;
  const me = gameState?.players.find(p => p.id === playerId);
  
  const sortedPlayers = useMemo(() => {
    if (!gameState?.players) return [];
    return [...gameState.players].sort((a, b) => 
      a.name.localeCompare(b.name, "de")
    );
  }, [gameState?.players]);
  
  useEffect(() => {
    // Reset local press state when question changes 
    // OR when the buzzer is opened/reset and we are eligible to buzz
    if (jeo?.buzzerOpen && !jeo?.buzzedPlayer && me?.canBuzz) {
      setBuzzerPressed(false);
    }
  }, [
    jeo?.currentQuestion?.id || "", 
    !!jeo?.buzzerOpen, 
    jeo?.buzzedPlayer || "", 
    !!me?.canBuzz
  ]);

  if (!gameState || !jeo) return null;
  
  const currentPlayer = sortedPlayers[jeo.currentPlayerIndex % sortedPlayers.length];
  const isMyTurn = currentPlayer?.id === playerId && !jeo.currentQuestion;
  const isBuzzedPlayer = jeo.buzzedPlayer === playerId;
  const canBuzz = jeo.buzzerOpen && !jeo.buzzedPlayer && me?.canBuzz && !buzzerPressed;

  const handleBuzz = () => {
    if (!canBuzz) return;
    setBuzzerPressed(true);
    const socket = getSocket();
    socket.emit("buzz");
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">

      {/* Status Banner */}
      {!jeo.currentQuestion ? (
        <div className={`p-3 rounded-2xl text-center border transition-all ${isMyTurn ? "bg-blue-600 border-blue-400 shadow-lg animate-pulse" : "bg-zinc-900/50 border-zinc-800"}`}>
          {isMyTurn ? (
            <span className="text-white font-black uppercase italic tracking-widest text-xs">★ Du bist dran! Wähle eine Kachel</span>
          ) : (
            <span className="text-zinc-500 font-black uppercase italic tracking-widest text-[10px]">Warten auf {currentPlayer?.name}...</span>
          )}
        </div>
      ) : jeo.buzzedPlayer ? (
        <div className="bg-blue-600/20 border border-blue-500/30 p-3 rounded-2xl text-center animate-pulse shadow-xl">
           <span className="text-blue-400 font-black uppercase italic tracking-[0.2em] text-xs">
             {(jeo.buzzedPlayer === playerId) ? "» Gib jetzt deine Antwort ab «" : `» ${gameState.players.find(p => p.id === jeo.buzzedPlayer)?.name} antwortet... «`}
           </span>
        </div>
      ) : null}

      {/* Current Question Display */}
      {jeo.currentQuestion && (
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-blue-900 to-black border-blue-800 shadow-2xl overflow-hidden relative rounded-3xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
            <CardContent className="p-10 text-center">
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
              <h3 className="text-3xl font-black text-white italic tracking-tighter leading-tight">
                {jeo.currentQuestion.question}
              </h3>
            </CardContent>
          </Card>

          {/* Buzzer Area */}
          {(jeo.buzzedPlayer && !isBuzzedPlayer) ? (
            <Card className="bg-zinc-900 border-zinc-800 rounded-3xl">
              <CardContent className="p-8 text-center">
                <p className="text-zinc-500 text-xs uppercase font-black mb-2 italic tracking-widest">Warten auf Antwort von...</p>
                <p className="text-3xl font-black text-white uppercase italic tracking-tighter">
                  {gameState.players.find(p => p.id === jeo.buzzedPlayer)?.name}
                </p>
              </CardContent>
            </Card>
          ) : (
            <button
              className={`w-full h-40 rounded-3xl text-4xl font-black uppercase italic tracking-tighter transition-all shadow-2xl relative overflow-hidden ${
                isBuzzedPlayer
                  ? "bg-yellow-500 text-black shadow-[0_0_50px_rgba(234,179,8,0.4)] animate-pulse"
                  : canBuzz
                    ? "bg-red-600 hover:bg-red-500 text-white animate-pulse active:scale-95 border-b-8 border-red-800"
                    : "bg-zinc-900 border-2 border-zinc-800 text-zinc-700 cursor-not-allowed"
              }`}
              onClick={handleBuzz}
              disabled={!canBuzz}
            >
              {isBuzzedPlayer ? (
                <span className="relative z-10 drop-shadow-sm">🔔 DEINE ANTWORT!</span>
              ) : canBuzz ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  <span className="relative z-10 drop-shadow-lg">🔔 JETZT BUZZERN!</span>
                </>
              ) : me?.canBuzz === false ? (
                <span className="opacity-50">Bereits versucht</span>
              ) : jeo.buzzerOpen ? (
                <span className="opacity-40 animate-pulse">BUZZER AKTIV!</span>
              ) : (
                <span className="opacity-20 text-2xl tracking-widest">Buzzer gesperrt</span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Jeopardy Grid (Disabled for players) */}
      {!jeo.currentQuestion && (
        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-3xl">
          <CardContent className="p-4">
            <div className="grid grid-cols-6 gap-2">
              {/* Category Headers (Larger Text) */}
              {jeo.categories.map((category, ci) => (
                <div
                  key={`cat-${ci}`}
                  className="p-2 bg-blue-950 border border-blue-900 text-white text-center text-[9px] sm:text-xs font-black uppercase tracking-tighter rounded-xl flex items-center justify-center min-h-[50px] sm:min-h-[60px] leading-tight break-words hyphens-auto"
                >
                  {category.name}
                </div>
              ))}
              
              {/* Questions Grid (Non-clickable) */}
              {[0, 1, 2, 3, 4].map((qi) => (
                jeo.categories.map((category, ci) => {
                  const question = category.questions[qi];
                  return (
                    <div
                      key={`q-${ci}-${qi}`}
                      className={`aspect-square rounded-xl flex items-center justify-center text-lg font-black italic transition-all shadow-md ${
                        question.revealed
                          ? question.discarded
                            ? "bg-red-950/30 text-red-500 border border-red-900/50 opacity-60"
                            : "bg-zinc-950 text-zinc-800 border border-zinc-900 scale-95 opacity-50"
                          : "bg-blue-900 text-blue-400 opacity-80"
                      }`}
                    >
                      {question.revealed ? (question.discarded ? "✕" : "✓") : question.points}
                    </div>
                  );
                })
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Slide-in Panel - Desktop Only */}
      <div
        className={`hidden lg:block fixed right-0 top-1/2 -translate-y-1/2 w-80 bg-zinc-900/95 border-2 border-zinc-800 shadow-2xl backdrop-blur-md z-40 transition-transform duration-300 ease-in-out rounded-l-3xl ${
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
                const isMe = p.id === playerId;
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
                            <span className={`text-sm font-black uppercase tracking-tight truncate max-w-[120px] ${isMe ? "text-white" : "text-zinc-400"}`}>
                              {p.name}
                            </span>
                            {isCurrent && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black italic tracking-tighter ${isMe ? "text-white" : "text-zinc-500"}`}>
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
                const isMe = p.id === playerId;
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
                            <span className={`text-sm font-black uppercase tracking-tight ${isMe ? "text-white" : "text-zinc-400"}`}>
                              {p.name}
                            </span>
                            {isCurrent && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black italic tracking-tighter ${isMe ? "text-white" : "text-zinc-500"}`}>
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
