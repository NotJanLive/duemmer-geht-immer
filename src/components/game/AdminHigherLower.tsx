"use client";

import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminHigherLower() {
  const { gameState } = useGameStore();

  if (!gameState || !gameState.higherLower) return null;

  const hol = gameState.higherLower;
  const currentRound = hol.rounds[hol.currentRound];
  
  const sortedPlayers = [...gameState.players].sort((a, b) => 
    a.name.localeCompare(b.name, "de")
  );
  
  const currentPlayer = sortedPlayers[currentRound.currentPlayerIndex % sortedPlayers.length];
  const availableItems = currentRound.items.filter(i => !i.revealed);
  const isLastRound = hol.currentRound === hol.totalRounds - 1;

  const correctOrder = [...currentRound.items].sort((a, b) => a.value - b.value);
  const sortedPlacedItems = [...currentRound.placedItems].sort((a, b) => a.value - b.value);

  const handlePlaceItem = (itemId: string) => {
    const socket = getSocket();
    socket.emit("holPlaceItem", itemId);
  };

  const handleRemoveItem = (itemId: string) => {
    const socket = getSocket();
    socket.emit("holRemoveItem", itemId);
  };

  const handleTakeLife = (playerId: string) => {
    const socket = getSocket();
    socket.emit("holTakeLife", playerId);
  };

  const handleAddLife = (playerId: string) => {
    const socket = getSocket();
    socket.emit("holAddLife", playerId);
  };

  const handleNextPlayer = () => {
    const socket = getSocket();
    socket.emit("holNextPlayer");
  };

  const handleAwardPoints = (playerId: string) => {
    const socket = getSocket();
    socket.emit("holAwardPoints", playerId, 10);
  };

  const handleRemovePoints = (playerId: string) => {
    const socket = getSocket();
    socket.emit("holRemovePoints", playerId, 10);
  };

  const handleNextRound = () => {
    const socket = getSocket();
    socket.emit("holNextRound");
  };

  const handleShowLeaderboard = () => {
    const socket = getSocket();
    socket.emit("showLeaderboard");
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header Info */}
      <div className="bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Higher or Lower</h2>
            <p className="text-zinc-500 text-[8px] uppercase font-black tracking-widest mt-1">Runde {hol.currentRound + 1} von {hol.totalRounds}</p>
          </div>
          <div className="text-right">
            <Badge className="bg-white text-black font-black italic shadow-lg uppercase text-[10px] py-0 h-6">
              {currentRound.topic}
            </Badge>
          </div>
        </div>
      </div>

      {/* Control Panel for Current Player Actions */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-2xl">
        <div className="bg-zinc-800/50 p-2 flex justify-between items-center border-b border-zinc-800">
          <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Rundensteuerung</span>
          <Badge variant="outline" className="border-zinc-700 text-white font-black uppercase italic text-[8px] py-0 h-5">
            {currentPlayer?.name} ist dran
          </Badge>
        </div>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 text-center md:text-left">
              <p className="text-zinc-500 text-[8px] uppercase font-black tracking-widest">Aktueller Spieler</p>
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">{currentPlayer?.name}</h3>
              <div className="flex items-center justify-center md:justify-start gap-3 mt-1">
                <span className="text-lg flex gap-1">
                  {"❤️".repeat(hol.playerLives[currentPlayer?.id || ""] || 0)}
                  {"🖤".repeat(Math.max(0, 2 - (hol.playerLives[currentPlayer?.id || ""] || 0)))}
                </span>
                <div className="flex items-baseline gap-1 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                  <span className="font-mono font-black italic text-white text-md">{currentPlayer?.currentModeScore || 0}</span>
                  <span className="text-[7px] font-bold text-zinc-500 uppercase">PKT</span>
                </div>
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col gap-2">
              <Button
                variant="outline"
                className="border-2 border-zinc-700 text-white h-10 font-black uppercase italic w-full text-xs"
                onClick={handleNextPlayer}
              >
                Nächster Spieler
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Items (Click to place) */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden rounded-3xl">
        <CardHeader className="border-b border-zinc-800 py-3">
          <CardTitle className="text-white uppercase text-[10px] tracking-widest font-black text-center opacity-50">Verfügbare Elemente (Klick zum Platzieren)</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {availableItems.length > 0 ? (
              availableItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handlePlaceItem(item.id)}
                  className="p-4 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl font-black uppercase italic hover:from-blue-500 hover:scale-[1.02] active:scale-95 transition-all text-center shadow-lg border border-blue-400/20"
                >
                  {item.label}
                </button>
              ))
            ) : (
              <p className="text-zinc-500 col-span-full text-center py-4 italic font-bold">Alle Elemente platziert</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scale (Synced with Player View) */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="border-b border-zinc-800 py-3">
          <CardTitle className="text-zinc-500 text-[10px] uppercase font-black tracking-widest flex justify-between items-center opacity-50">
            <span>Skala & Richtige Reihenfolge</span>
            <span className="text-white font-mono">{sortedPlacedItems.length} Elemente</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            {correctOrder.map((item, index) => {
              const isRevealed = currentRound.placedItems.some(i => i.id === item.id);
              return (
                <div
                  key={item.id}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-2 border transition-all shadow-sm ${
                    isRevealed 
                      ? "bg-green-600 border-green-500 text-white" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-600"
                  }`}
                >
                  <span className="opacity-50">{index + 1}.</span>
                  <span className="uppercase">{item.label}</span>
                </div>
              );
            })}
          </div>

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
                className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-zinc-800 shadow-lg group relative"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-500 font-black text-sm border border-zinc-800 shadow-inner italic">
                    {index + 1}
                  </div>
                  <span className="text-white font-black text-lg sm:text-xl tracking-tight uppercase italic">{item.label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-baseline gap-1 bg-zinc-900/50 px-3 py-1.5 rounded-xl border border-zinc-800">
                    <span className="text-sm font-black text-zinc-400 italic">{item.value}</span>
                    <span className="text-[8px] font-bold text-zinc-600 uppercase">{currentRound.unit}</span>
                  </div>
                  {!item.isInitial && (
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => handleRemoveItem(item.id)}
                      className="w-8 h-8 rounded-full shadow-lg"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {sortedPlacedItems.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-700 border-2 border-dashed border-zinc-800 rounded-3xl">
                <p className="italic font-bold text-sm uppercase tracking-widest opacity-20">Skala ist leer</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Rundenstand (Player Steuerung included) */}
      <div className="max-w-md mx-auto">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mb-6 text-center italic opacity-50">Live Rundenstand & Steuerung</p>
          <div className="space-y-3">
            {[...gameState.players]
              .sort((a, b) => b.currentModeScore - a.currentModeScore)
              .map((player, index) => {
                const lives = hol.playerLives[player.id] || 0;
                const isCurrent = currentPlayer?.id === player.id;
                const isEliminated = lives <= 0;
                
                return (
                  <div
                    key={player.id}
                    className={`w-full flex flex-col p-3 rounded-2xl transition-all border ${
                      isEliminated ? "opacity-50 grayscale bg-red-950/10 border-red-900/30" : "border-white/5 bg-black/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4 text-left">
                        <span className={`text-xs font-black italic ${index === 0 && !isEliminated ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-tight ${isEliminated ? "line-through text-red-500/50" : "text-zinc-400"}`}>
                              {player.name}
                            </span>
                            {isCurrent && !isEliminated && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                            )}
                          </div>
                          <div className="flex gap-0.5 mt-1 text-[8px]">
                            {"❤️".repeat(lives)}
                            {"🖤".repeat(Math.max(0, 2 - lives))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black italic tracking-tighter text-zinc-500">
                          {player.currentModeScore}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-zinc-700">PKT</span>
                      </div>
                    </div>
                    {/* Controls Row */}
                    <div className="flex justify-between items-center mt-2 border-t border-zinc-800/50 pt-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/20 rounded-full" onClick={() => handleTakeLife(player.id)} disabled={isEliminated}>-❤️</Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-500 hover:bg-green-500/20 rounded-full" onClick={() => handleAddLife(player.id)}>+❤️</Button>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs font-black text-red-400 hover:bg-red-500/20 rounded-full" onClick={() => handleRemovePoints(player.id)}>-10</Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs font-black text-green-400 hover:bg-green-500/20 rounded-full" onClick={() => handleAwardPoints(player.id)}>+10</Button>
                      </div>
                    </div>
                  </div>
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
            className="flex-1 h-14 bg-white text-black hover:bg-zinc-200 text-lg font-black uppercase italic rounded-2xl shadow-xl"
            onClick={handleNextRound}
          >
            Nächste Runde →
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 h-14 bg-white text-black hover:bg-zinc-200 text-lg font-black uppercase italic rounded-2xl shadow-xl"
            onClick={handleShowLeaderboard}
          >
            Zum Punktestand →
          </Button>
        )}
      </div>
    </div>
  );
}
