"use client";

import { useGameStore } from "@/lib/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlayerHigherLower() {
  const { gameState, playerId } = useGameStore();

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

  // Sort placed items by value for display
  const sortedPlacedItems = [...currentRound.placedItems].sort((a, b) => a.value - b.value);

  return (
    <div className="space-y-4 relative min-h-[80vh]">
      {/* Header Info */}
      <div className="bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Higher or Lower</h2>
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mt-1">Runde {hol.currentRound + 1} / {hol.totalRounds}</p>
          </div>
          <div className="text-right">
            <div className="flex gap-1 justify-end text-sm">
              {Array.from({ length: 2 }).map((_, i) => (
                <span key={i} className={`transition-all duration-500 ${i < myLives ? "drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : "grayscale opacity-20"}`}>
                  ❤️
                </span>
              ))}
            </div>
            <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest mt-1">Deine Leben</p>
          </div>
        </div>

        {/* Status Indicators (Small, Blinking) */}
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

      {/* Topic Card */}
      <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800 shadow-2xl overflow-hidden relative rounded-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
        <CardContent className="p-4 text-center">
          <p className="text-zinc-500 text-[8px] uppercase font-black tracking-[0.2em] mb-1">Thema der Runde</p>
          <p className="text-2xl font-black text-white leading-tight uppercase italic tracking-tighter">{currentRound.topic}</p>
          <div className="mt-2 inline-flex items-center gap-2 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700">
             <span className="text-[8px] text-zinc-500 font-black uppercase">Einheit:</span>
             <span className="text-[10px] text-zinc-300 font-black italic">{currentRound.unit}</span>
          </div>
        </CardContent>
      </Card>

      {/* Current Scale */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="border-b border-zinc-800 py-3">
          <CardTitle className="text-zinc-500 text-[10px] uppercase font-black tracking-widest text-center italic opacity-50 tracking-[0.3em]">Die Aktuelle Skala</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
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
  );
}
