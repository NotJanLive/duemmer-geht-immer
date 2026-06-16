"use client";

import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminLastManStanding() {
  const { gameState } = useGameStore();

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
  const revealedCount = currentRound.cards.filter(c => c.revealed).length;
  const totalCards = currentRound.cards.length;

  const handleRevealCard = (cardId: string) => {
    const socket = getSocket();
    socket.emit("revealCard", cardId);
  };

  const handleEliminatePlayer = (playerId: string) => {
    const socket = getSocket();
    socket.emit("eliminatePlayer", playerId);
  };

  const handleNextRound = () => {
    const socket = getSocket();
    socket.emit("nextLmsRound");
  };

  const handleShowLeaderboard = () => {
    const socket = getSocket();
    socket.emit("showLeaderboard");
  };

  const isLastRound = lms.currentRound === lms.totalRounds - 1;
  const allEliminated = activePlayers.length === 0;
  const allCardsRevealed = currentRound.cards.every(c => c.revealed);
  const roundComplete = allEliminated || allCardsRevealed;

  return (
    <div className="space-y-4 pb-24">
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
          {currentPlayer && !roundComplete && (
            <div className="bg-blue-600/20 border border-blue-500/30 p-2 rounded-xl text-center">
              <span className="text-blue-400 font-black uppercase italic tracking-widest text-[10px]">★ {currentPlayer.name} ist aktuell dran</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards Grid (Larger names for admin) */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-2xl">
        <CardContent className="p-2">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {currentRound.cards.map((card) => (
              <button
                key={card.id}
                onClick={() => !card.revealed && handleRevealCard(card.id)}
                disabled={card.revealed}
                className={`aspect-[16/10] rounded-xl flex items-center justify-center text-center p-2 text-[10px] font-black transition-all border-2 ${
                  card.revealed
                    ? "bg-green-950 border-green-900 text-green-500 opacity-40 grayscale"
                    : "bg-zinc-800 border-zinc-700 text-white hover:border-white active:scale-95 shadow-lg"
                }`}
              >
                {card.revealed ? "✓" : card.value}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Players List (Live Rundenstand Design) */}
      <div className="max-w-md mx-auto">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mb-6 text-center italic opacity-50">Live Rundenstand (Klick zum Eliminieren)</p>
          <div className="space-y-3">
            {[...gameState.players]
              .sort((a, b) => b.currentModeScore - a.currentModeScore)
              .map((player, index) => {
                const isEliminated = currentRound.eliminatedPlayers.includes(player.id);
                const isCurrent = currentPlayer?.id === player.id;
                const eliminationOrder = currentRound.eliminatedPlayers.indexOf(player.id) + 1;
                
                return (
                  <button
                    key={player.id}
                    onClick={() => handleEliminatePlayer(player.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border ${
                      isEliminated 
                        ? "bg-red-950/20 border-red-900/50 text-red-500" 
                        : "border-white/5 bg-black/20 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <span className={`text-xs font-black italic ${index === 0 && !isEliminated ? "text-yellow-500" : isEliminated ? "text-red-700" : "text-zinc-700"}`}>#{index + 1}</span>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black uppercase tracking-tight ${isEliminated ? "line-through text-red-500/50" : "text-zinc-400"}`}>
                            {player.name}
                          </span>
                          {isCurrent && !isEliminated && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                          )}
                        </div>
                        {isEliminated && (
                          <span className="text-[10px] font-black italic uppercase text-red-500">
                            Als {eliminationOrder}. Ausgeschieden (+{eliminationOrder} PKT)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-black italic tracking-tighter ${isEliminated ? "text-red-500/70" : "text-zinc-500"}`}>
                        {player.currentModeScore}
                      </span>
                      <span className={`text-[10px] font-bold uppercase ${isEliminated ? "text-red-700" : "text-zinc-700"}`}>PKT</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-md border-t border-zinc-800 flex gap-4 z-50">
        {!isLastRound ? (
          <Button
            size="lg"
            className="flex-1 h-14 bg-white text-black hover:bg-zinc-200 text-lg font-black uppercase italic rounded-2xl shadow-2xl"
            onClick={handleNextRound}
          >
            Nächste Runde →
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 h-14 bg-white text-black hover:bg-zinc-200 text-lg font-black uppercase italic rounded-2xl shadow-2xl"
            onClick={handleShowLeaderboard}
          >
            Zum Punktestand →
          </Button>
        )}
      </div>
    </div>
  );
}
