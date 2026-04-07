"use client";

import { useGameStore } from "@/lib/gameStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlayerLeaderboard() {
  const { gameState, playerId } = useGameStore();

  if (!gameState) return null;

  // ONLY show current round points
  const sortedPlayers = [...gameState.players].sort((a, b) => b.currentModeScore - a.currentModeScore);
  const myRank = sortedPlayers.findIndex(p => p.id === playerId) + 1;
  const me = gameState.players.find(p => p.id === playerId);
  const modes = ["Last Man Standing", "Wer wird Millionär?", "Higher or Lower", "Jeopardy"];
  const currentModeLabel = modes[gameState.modeIndex] || "Unbekannt";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-black text-white mb-1 uppercase italic tracking-tighter leading-none">Punkte der Runde</h2>
        <p className="text-blue-500 font-bold uppercase tracking-widest text-xs">{currentModeLabel}</p>
      </div>

      {/* My Position (Current Round Only) - Inverted to Black */}
      <Card className="bg-black text-white shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-zinc-800">
        <CardContent className="p-8 text-center">
          <p className="text-zinc-500 uppercase font-black tracking-widest text-[10px] mb-2">Deine Platzierung</p>
          <p className="text-7xl font-black italic tracking-tighter mb-2">#{myRank}</p>
          <div className="inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-1 rounded-full border border-zinc-800">
            <span className="text-2xl font-black italic">{me?.currentModeScore || 0}</span>
            <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">PKT</span>
          </div>
        </CardContent>
      </Card>

      {/* Motivational Message */}
      {myRank === 1 && (
        <div className="bg-yellow-500 text-black p-4 rounded-xl text-center font-black uppercase italic tracking-tighter shadow-lg animate-pulse">
          🥇 Du hast die Runde gewonnen!
        </div>
      )}

      {/* Full Leaderboard (Round Only) */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.2em]">Rangliste dieser Runde</CardTitle>
          <div className="h-px bg-zinc-800 mt-4 -mx-6" />
        </CardHeader>
        <CardContent className="p-0 mt-2">
          <div className="space-y-3 p-4">
            {sortedPlayers.map((player, index) => {
              const isMe = player.id === playerId;
              const rank = index + 1;
              
              return (
                <div
                  key={player.id}
                  className={`p-4 rounded-2xl flex items-center justify-between transition-all border ${
                    isMe ? "bg-white/15 border-white/30 shadow-[0_0_30px_rgba(255,255,255,0.1)]" : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`font-black italic w-6 ${
                      rank === 1 ? "text-yellow-500" : 
                      rank === 2 ? "text-zinc-400" : 
                      rank === 3 ? "text-orange-600" : 
                      isMe ? "text-white" : "text-zinc-700"
                    }`}>
                      #{rank}
                    </span>
                    <span className="font-black text-white text-sm uppercase tracking-tight">
                      {player.name}
                      {isMe && <span className="ml-1 text-[10px] opacity-50 lowercase font-normal">(Du)</span>}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`font-black italic text-xl ${isMe ? "text-white" : "text-zinc-500"}`}>
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

      {/* Waiting */}
      <div className="text-center py-4">
        <div className="flex justify-center gap-1 mb-2">
          <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full animate-bounce" />
          <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full animate-bounce [animation-delay:0.2s]" />
          <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full animate-bounce [animation-delay:0.4s]" />
        </div>
        <p className="text-zinc-600 text-[10px] uppercase font-black tracking-widest">Warte auf den Spielleiter</p>
      </div>
    </div>
  );
}
