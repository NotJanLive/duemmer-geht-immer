"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PlayerLastManStanding() {
  const { gameState, playerId } = useGameStore();
  const [leaderboardOpen, setLeaderboardOpen] = useState(true);

  if (!gameState || !gameState.lastManStanding) return null;

  const lms = gameState.lastManStanding;
  const currentRound = lms.rounds[lms.currentRound];

  const sortedPlayers = [...gameState.players].sort((a, b) =>
    a.name.localeCompare(b.name, "de")
  );

  const activePlayers = sortedPlayers.filter(
    p => !currentRound.eliminatedPlayers.includes(p.id)
  );

  const currentPlayer = activePlayers[currentRound.currentPlayerIndex % activePlayers.length];
  const isMyTurn = currentPlayer?.id === playerId;
  const isEliminated = currentRound.eliminatedPlayers.includes(playerId || "");

  const revealedCount = currentRound.cards.filter(c => c.revealed).length;
  const totalCards = currentRound.cards.length;

  return (
    <>
      {/* Main Content - Always Centered */}
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Topic Card with Status */}
        <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800 shadow-2xl overflow-hidden relative rounded-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-left">
                <p className="text-zinc-500 text-[8px] uppercase font-black tracking-[0.2em] mb-1">Thema der Runde</p>
                <h3 className="text-2xl font-black text-white leading-tight uppercase italic tracking-tighter">{currentRound.topic}</h3>
              </div>
              <Badge className="bg-white text-black font-black italic shadow-lg">
                {revealedCount} / {totalCards} KARTEN
              </Badge>
            </div>

            {/* Status Indicator */}
            {isEliminated ? (
              <div className="bg-red-950/30 border border-red-900/50 p-2 rounded-xl text-center">
                <span className="text-red-500 font-black uppercase italic tracking-widest text-[10px]">✗ Du bist ausgeschieden</span>
              </div>
            ) : isMyTurn ? (
              <div className="bg-blue-600 p-2 rounded-xl text-center shadow-[0_0_20px_rgba(37,99,235,0.4)] animate-pulse">
                <span className="text-white font-black uppercase italic tracking-widest text-[10px]">★ Du bist dran! Nenne eine Antwort</span>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-center">
                <span className="text-zinc-500 font-black uppercase italic tracking-widest text-[8px]">Warten auf {currentPlayer?.name}...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cards Grid */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-2xl">
          <CardContent className="p-3">
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {currentRound.cards.map((card) => (
                <div key={card.id} className="perspective-1000 aspect-[3/4]">
                  <div
                    className={`relative w-full h-full transition-all duration-700 preserve-3d ${card.revealed ? "rotate-y-180" : ""}`}
                  >
                    {/* Front (Hidden) */}
                    <div className="absolute inset-0 backface-hidden bg-zinc-800 border-2 border-zinc-700 rounded-lg flex items-center justify-center shadow-xl">
                      <span className="text-zinc-400 font-black text-2xl italic opacity-70">?</span>
                    </div>
                    {/* Back (Revealed) */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-green-600 border border-green-400 rounded-lg flex items-center justify-center p-1.5 text-center shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                      <span className="text-white font-black text-[8px] sm:text-[10px] uppercase italic leading-tight drop-shadow-lg">
                        {card.value}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <style jsx global>{`
          .perspective-1000 { perspective: 1000px; }
          .preserve-3d { transform-style: preserve-3d; }
          .backface-hidden { backface-visibility: hidden; }
          .rotate-y-180 { transform: rotateY(180deg); }
        `}</style>
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
                const playerEliminated = currentRound.eliminatedPlayers.includes(p.id);
                const isCurrent = currentPlayer?.id === p.id;

                return (
                  <div
                    key={p.id}
                    className={`w-full flex flex-col p-3 rounded-2xl transition-all border ${
                      playerEliminated ? "opacity-50 grayscale bg-red-950/10 border-red-900/30" : "border-white/5 bg-black/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-left">
                        <span className={`text-xs font-black italic ${index === 0 && !playerEliminated ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-tight truncate max-w-[120px] ${playerEliminated ? "line-through text-red-500/50" : isMe ? "text-white" : "text-zinc-400"}`}>
                              {p.name}
                            </span>
                            {isCurrent && !playerEliminated && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black italic tracking-tighter ${playerEliminated ? "text-red-500/70" : isMe ? "text-white" : "text-zinc-500"}`}>
                          {p.currentModeScore}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${playerEliminated ? "text-red-700" : "text-zinc-700"}`}>PKT</span>
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
                const playerEliminated = currentRound.eliminatedPlayers.includes(p.id);
                const isCurrent = currentPlayer?.id === p.id;

                return (
                  <div
                    key={p.id}
                    className={`w-full flex flex-col p-3 rounded-2xl transition-all border ${
                      playerEliminated ? "opacity-50 grayscale bg-red-950/10 border-red-900/30" : "border-white/5 bg-black/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-left">
                        <span className={`text-xs font-black italic ${index === 0 && !playerEliminated ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-tight truncate max-w-[120px] ${playerEliminated ? "line-through text-red-500/50" : isMe ? "text-white" : "text-zinc-400"}`}>
                              {p.name}
                            </span>
                            {isCurrent && !playerEliminated && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black italic tracking-tighter ${playerEliminated ? "text-red-500/70" : isMe ? "text-white" : "text-zinc-500"}`}>
                          {p.currentModeScore}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${playerEliminated ? "text-red-700" : "text-zinc-700"}`}>PKT</span>
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
