"use client";

import { useState, useEffect, useMemo } from "react";
import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlayerJeopardy() {
  const { gameState, playerId } = useGameStore();
  const [buzzerPressed, setBuzzerPressed] = useState(false);

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
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Jeopardy</h2>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white italic">{me?.currentModeScore || 0}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">PKT</span>
            </div>
          </div>
        </div>
      </div>

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
                  className="p-3 bg-blue-950 border border-blue-900 text-white text-center text-xs font-black uppercase tracking-tighter rounded-xl flex items-center justify-center min-h-[60px] leading-tight"
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
  );
}
