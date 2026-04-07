"use client";

import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AdminLobby() {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const handleStartGame = () => {
    const socket = getSocket();
    socket.emit("startGame");
  };

  const sortedPlayers = [...gameState.players].sort((a, b) => 
    a.name.localeCompare(b.name, "de")
  );

  return (
    <div className="space-y-6">
      {/* Room Code Display */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-3xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-600" />
        <CardContent className="p-8 text-center">
          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.4em] mb-4 italic opacity-50">Dein Raumcode</p>
          <div className="text-7xl font-mono font-black text-white tracking-[0.3em] drop-shadow-lg">
            {gameState.roomCode}
          </div>
        </CardContent>
      </Card>

      {/* Players List */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden rounded-3xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-white uppercase text-[10px] tracking-widest font-black flex justify-between items-center">
            <span>Spieler ({gameState.players.length})</span>
            <Badge variant="outline" className="border-zinc-700 text-zinc-500 font-mono text-[8px]">
              Alphabetisch sortiert
            </Badge>
          </CardTitle>
          <div className="h-px bg-zinc-800 mt-4 -mx-6" />
        </CardHeader>
        <CardContent className="p-0 mt-2">
          <ScrollArea className="h-64">
            <div className="space-y-1 p-2">
              {sortedPlayers.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-white/5"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black italic text-zinc-600">{index + 1}.</span>
                    <span className="font-black text-sm uppercase tracking-tight text-white">
                      {player.name}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`font-black text-[8px] uppercase tracking-widest ${
                      player.connected 
                        ? "border-green-500/50 text-green-500" 
                        : "border-red-500/50 text-red-500"
                    }`}
                  >
                    {player.connected ? "Online" : "Offline"}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Start Button */}
      <Button
        size="lg"
        className="w-full h-16 text-xl bg-white text-black hover:bg-zinc-200 font-black uppercase italic rounded-2xl shadow-xl"
        onClick={handleStartGame}
        disabled={gameState.players.length < 1}
      >
        {gameState.players.length < 1 
          ? "Warte auf Spieler..." 
          : `🎮 Spiel starten (${gameState.players.length} Spieler)`
        }
      </Button>

      {/* Game Info (Spielablauf) */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-xl overflow-hidden rounded-3xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-white uppercase text-[10px] tracking-widest font-black italic">Spielablauf</CardTitle>
          <div className="h-px bg-zinc-800 mt-4 -mx-6" />
        </CardHeader>
        <CardContent className="p-6 pt-4 text-zinc-400 space-y-4">
          <div className="flex items-center gap-4 group">
            <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-black text-white italic group-hover:bg-blue-600 transition-colors">1</span>
            <div>
              <p className="font-black text-sm text-white uppercase italic tracking-tighter">Last Man Standing</p>
              <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-wide">Karten erraten und überleben</p>
            </div>
          </div>
          <div className="flex items-center gap-4 group">
            <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-black text-white italic group-hover:bg-blue-600 transition-colors">2</span>
            <div>
              <p className="font-black text-sm text-white uppercase italic tracking-tighter">Wer wird Millionär?</p>
              <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-wide">30 Fragen mit steigendem Wert</p>
            </div>
          </div>
          <div className="flex items-center gap-4 group">
            <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-black text-white italic group-hover:bg-blue-600 transition-colors">3</span>
            <div>
              <p className="font-black text-sm text-white uppercase italic tracking-tighter">Higher or Lower</p>
              <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-wide">Werte richtig auf der Skala ordnen</p>
            </div>
          </div>
          <div className="flex items-center gap-4 group">
            <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-black text-white italic group-hover:bg-blue-600 transition-colors">4</span>
            <div>
              <p className="font-black text-sm text-white uppercase italic tracking-tighter">Jeopardy</p>
              <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-wide">Das große Finale mit dem Buzzer</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
