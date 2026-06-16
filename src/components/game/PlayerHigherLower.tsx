"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PlayerHigherLower() {
  const { gameState, playerId } = useGameStore();
  const [leaderboardOpen, setLeaderboardOpen] = useState(true);

  if (!gameState || !gameState.higherLower) return null;

  const hol = gameState.higherLower;
  const currentRound = hol.rounds[hol.currentRound];

  const sortedPlayers = [...gameState.players].sort((a, b) =>
    a.name.localeCompare(b.name, "de")
  );

  const currentPlayer = sortedPlayers[currentRound.currentPlayerIndex % sortedPlayers.length];
  const myLives = hol.playerLives[playerId || ""] || 0;
  const isMyTurn = currentPlayer?.id === playerId;
  const amDead = myLives <= 0;

  const currentPlayerData = gameState.players.find(p => p.id === playerId);

  // Sort placed items by value for display
  const sortedPlacedItems = [...currentRound.placedItems].sort((a, b) => a.value - b.value);

  // Get available items that haven't been placed yet
  const availableItems = currentRound.items.filter(i => !i.revealed);

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-3 relative min-h-[80vh]">
        {/* Topic Card */}
        <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800 shadow-2xl overflow-hidden relative rounded-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
          <CardContent className="p-6 text-center">
            <p className="text-zinc-500 text-[8px] uppercase font-black tracking-[0.2em] mb-1">Thema der Runde</p>
            <p className="text-2xl font-black text-white leading-tight uppercase italic tracking-tighter">{currentRound.topic}</p>
            <p className="text-zinc-600 text-[9px] uppercase font-black tracking-widest mt-1.5">Runde {hol.currentRound + 1} / {hol.totalRounds}</p>

            <div className="mt-3 inline-flex items-center gap-2 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700">
              <span className="text-[8px] text-zinc-500 font-black uppercase">Einheit:</span>
              <span className="text-[10px] text-zinc-300 font-black italic">{currentRound.unit}</span>
            </div>

            {/* Status Indicators */}
            <div className="mt-4">
              {amDead ? (
                <div className="bg-red-950/30 border border-red-900/50 p-2 rounded-xl text-center">
                  <span className="text-red-500 font-black uppercase italic tracking-widest text-[10px]">✗ Du bist eliminiert</span>
                </div>
              ) : isMyTurn ? (
                <div className="bg-blue-600 p-2 rounded-xl text-center shadow-[0_0_20px_rgba(37,99,235,0.4)] animate-pulse">
                  <span className="text-white font-black uppercase italic tracking-widest text-[10px]">★ Du bist dran! Nenne deine Einordnung</span>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-center">
                  <span className="text-zinc-500 font-black uppercase italic tracking-widest text-[8px]">Warten auf {currentPlayer?.name}...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available Items (Display Only) */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-zinc-800 py-3">
            <CardTitle className="text-white uppercase text-[10px] tracking-widest font-black text-center opacity-50">Verfügbare Elemente</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {availableItems.length > 0 ? (
                availableItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-gradient-to-br from-zinc-800 to-zinc-900 text-white rounded-2xl font-black uppercase italic text-center shadow-lg border border-zinc-700/50 cursor-not-allowed opacity-80 break-words"
                  >
                    {item.label}
                  </div>
                ))
              ) : (
                <p className="text-zinc-500 col-span-full text-center py-4 italic font-bold">Alle Elemente platziert</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Scale */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-zinc-800 py-3">
            <CardTitle className="text-zinc-500 text-[10px] uppercase font-black tracking-widest text-center italic opacity-50 tracking-[0.3em]">Die Aktuelle Skala</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {/* Placed Items - Above Scale */}
            {sortedPlacedItems.length > 0 && (
              <div className="overflow-x-auto mb-6">
                <div className="flex gap-2 justify-center min-w-max">
                  {sortedPlacedItems.map((item) => (
                    <div
                      key={item.id}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-2 border transition-all shadow-sm bg-green-600 border-green-500 text-white whitespace-nowrap"
                    >
                      <span className="uppercase">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative mb-10 mt-2">
              <div className="h-2 bg-gradient-to-r from-zinc-800 via-zinc-600 to-white rounded-full shadow-inner" />
              <div className="flex justify-between mt-2 px-1 opacity-30">
                <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest">Niedrig</span>
                <span className="text-zinc-400 text-[8px] font-black uppercase tracking-widest">Hoch</span>
              </div>
            </div>

            <div className="space-y-3">
              {sortedPlacedItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-zinc-800 shadow-lg group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-500 font-black text-sm border border-zinc-800 shadow-inner italic">
                      {index + 1}
                    </div>
                    <span className="text-white font-black text-xl tracking-tight uppercase italic">{item.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1 bg-zinc-900/50 px-3 py-1 rounded-xl border border-zinc-800">
                    <span className="text-sm font-black text-zinc-400 italic">{item.value}</span>
                    <span className="text-[8px] font-bold text-zinc-600 uppercase">{currentRound.unit}</span>
                  </div>
                </div>
              ))}

              {sortedPlacedItems.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-700 border-2 border-dashed border-zinc-800 rounded-3xl">
                  <p className="italic font-bold text-sm uppercase tracking-widest opacity-20">Skala wird befüllt...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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
                const lives = hol.playerLives[p.id] || 0;
                const isCurrent = currentPlayer?.id === p.id;
                const isEliminated = lives <= 0;

                return (
                  <div
                    key={p.id}
                    className={`w-full flex flex-col p-3 rounded-2xl transition-all border ${
                      isEliminated ? "opacity-50 grayscale bg-red-950/10 border-red-900/30" : "border-white/5 bg-black/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-left">
                        <span className={`text-xs font-black italic ${index === 0 && !isEliminated ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-tight truncate max-w-[120px] ${isEliminated ? "line-through text-red-500/50" : isMe ? "text-white" : "text-zinc-400"}`}>
                              {p.name}
                            </span>
                            {isCurrent && !isEliminated && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                          </div>
                          <div className="flex gap-0.5 mt-1 text-sm">
                            {"❤️".repeat(lives)}
                            {"🖤".repeat(Math.max(0, 2 - lives))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black italic tracking-tighter ${isEliminated ? "text-red-500/70" : isMe ? "text-white" : "text-zinc-500"}`}>
                          {p.currentModeScore}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${isEliminated ? "text-red-700" : "text-zinc-700"}`}>PKT</span>
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
                const lives = hol.playerLives[p.id] || 0;
                const isCurrent = currentPlayer?.id === p.id;
                const isEliminated = lives <= 0;

                return (
                  <div
                    key={p.id}
                    className={`w-full flex flex-col p-3 rounded-2xl transition-all border ${
                      isEliminated ? "opacity-50 grayscale bg-red-950/10 border-red-900/30" : "border-white/5 bg-black/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-left">
                        <span className={`text-xs font-black italic ${index === 0 && !isEliminated ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-tight ${isEliminated ? "line-through text-red-500/50" : isMe ? "text-white" : "text-zinc-400"}`}>
                              {p.name}
                            </span>
                            {isCurrent && !isEliminated && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                          </div>
                          <div className="flex gap-0.5 mt-1 text-sm">
                            {"❤️".repeat(lives)}
                            {"🖤".repeat(Math.max(0, 2 - lives))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black italic tracking-tighter ${isEliminated ? "text-red-500/70" : isMe ? "text-white" : "text-zinc-500"}`}>
                          {p.currentModeScore}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${isEliminated ? "text-red-700" : "text-zinc-700"}`}>PKT</span>
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
