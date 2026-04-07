"use client";

import { useGameStore } from "@/lib/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlayerLastManStanding() {
  const { gameState, playerId } = useGameStore();

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
    <div className="space-y-4">
      {/* Header Info */}
      <div className="bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Last Man Standing</h2>
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mt-1">Runde {lms.currentRound + 1} / {lms.totalRounds}</p>
          </div>
          <div className="text-right">
            <Badge className="bg-white text-black font-black italic shadow-lg">
              {revealedCount} / {totalCards} KARTEN
            </Badge>
          </div>
        </div>
        
        {/* Status Indicator inside header box for cleaner look */}
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

        <div className="flex gap-1.5 mt-4 justify-center">
          {currentRound.cards.map((_, index) => (
            <div 
              key={index} 
              className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${index < revealedCount ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-zinc-800"}`} 
            />
          ))}
        </div>
      </div>

      {/* Topic Card */}
      <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800 shadow-2xl overflow-hidden relative rounded-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
        <CardContent className="p-4 text-center">
          <p className="text-zinc-500 text-[8px] uppercase font-black tracking-[0.2em] mb-1">Thema der Runde</p>
          <h3 className="text-2xl font-black text-white leading-tight uppercase italic tracking-tighter">{currentRound.topic}</h3>
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
                    <span className="text-zinc-700 font-black text-xl italic opacity-30">?</span>
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
  );
}
