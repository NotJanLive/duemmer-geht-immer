"use client";

import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLeaderboard() {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  // ONLY sort and show by currentModeScore between games
  const sortedPlayers = [...gameState.players].sort((a, b) => b.currentModeScore - a.currentModeScore);
  const modes = ["Last Man Standing", "Wer wird Millionär?", "Higher or Lower", "Jeopardy"];
  const currentModeLabel = modes[gameState.modeIndex] || "Unbekannt";
  const nextModeLabel = modes[gameState.modeIndex + 1];
  const isFinale = gameState.modeIndex >= modes.length - 1;

  const handleNextMode = () => {
    const socket = getSocket();
    socket.emit("nextStep");
  };

  const handleStartFinale = () => {
    const socket = getSocket();
    socket.emit("startFinale");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-black text-white mb-1 uppercase italic tracking-tighter leading-none">Punkte der Runde</h2>
        <p className="text-blue-500 font-bold uppercase tracking-widest text-xs">{currentModeLabel}</p>
      </div>

      {/* Full Leaderboard (Round Only) */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.2em]">Rangliste dieser Runde</CardTitle>
          <div className="h-px bg-zinc-800 mt-4 -mx-6" />
        </CardHeader>
        <CardContent className="p-0 mt-2">
          <div className="space-y-3 p-4">
            {sortedPlayers.map((player, index) => {
              const rank = index + 1;
              return (
                <div
                  key={player.id}
                  className="p-4 rounded-2xl flex items-center justify-between transition-all border bg-white/5 border-white/10 hover:bg-white/10"
                >
                  <div className="flex items-center gap-4">
                    <span className={`font-black italic w-6 ${
                      rank === 1 ? "text-yellow-500" : 
                      rank === 2 ? "text-zinc-400" : 
                      rank === 3 ? "text-orange-600" : 
                      "text-zinc-700"
                    }`}>
                      #{rank}
                    </span>
                    <span className="font-black text-white text-sm uppercase tracking-tight">
                      {player.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-black italic text-xl text-zinc-200">
                      {player.currentModeScore}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">PKT</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Next Action */}
      <div className="flex gap-4 pt-6 pb-12">
        {isFinale ? (
          <Button
            size="lg"
            className="flex-1 h-20 text-2xl font-black uppercase italic bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black shadow-[0_0_30px_rgba(234,179,8,0.3)] transition-all hover:scale-[1.02] active:scale-95 rounded-2xl"
            onClick={handleStartFinale}
          >
            🏆 Zum Finale!
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 h-16 text-xl font-black uppercase italic bg-white text-black hover:bg-zinc-200 transition-all hover:translate-x-1 rounded-2xl"
            onClick={handleNextMode}
          >
            Weiter zu: {nextModeLabel} →
          </Button>
        )}
      </div>
    </div>
  );
}
