"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/lib/gameStore";
import { getSocket, connectSocket } from "@/lib/socket";
import { getSessionId, getStoredRoomCode, getStoredIsAdmin, setStoredRoomCode, setStoredPlayerId, getStoredPlayerId } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import PlayerLobby from "@/components/game/PlayerLobby";
import PlayerLastManStanding from "@/components/game/PlayerLastManStanding";
import PlayerMillionaire from "@/components/game/PlayerMillionaire";
import PlayerHigherLower from "@/components/game/PlayerHigherLower";
import PlayerJeopardy from "@/components/game/PlayerJeopardy";
import PlayerLeaderboard from "@/components/game/PlayerLeaderboard";
import PlayerFinale from "@/components/game/PlayerFinale";

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;
  const { gameState, setGameState, playerId, setPlayerId, setConnected } = useGameStore();
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Verify this is a player (not admin)
    const storedRoom = getStoredRoomCode();
    const storedIsAdmin = getStoredIsAdmin();
    
    if (storedRoom !== roomCode) {
      router.push('/');
      return;
    }
    
    if (storedIsAdmin) {
      router.push(`/admin/${roomCode}`);
      return;
    }

    let mounted = true;
    const socket = getSocket();

    const initConnection = async () => {
      try {
        if (!socket.connected) {
          await connectSocket();
        }
        
        if (!mounted) return;
        setConnected(true);
        
        // Register listeners once
        socket.off("gameState");
        socket.off("buzzerPressed");
        socket.off("error");
        
        socket.on("gameState", (state) => {
          if (mounted) {
            setGameState(state);
            setLoading(false);
            setInitialized(true);
          }
        });

        socket.on("error", (message) => {
          if (mounted) {
            setConnectionError(message);
            setTimeout(() => router.push('/'), 3000);
          }
        });

        socket.on("buzzerPressed", (buzzPlayerId) => {
          console.log("Buzzer pressed by:", buzzPlayerId);
        });

        // Try to rejoin as player
        const sessionId = getSessionId();
        socket.emit("rejoinRoom", roomCode, sessionId, (response) => {
          if (!mounted) return;
          
          if (response.success && response.playerId) {
            setPlayerId(response.playerId);
            if (response.gameState) {
              setGameState(response.gameState);
            }
            setLoading(false);
            setInitialized(true);
          } else {
            // Session lost, clear and go home
            setTimeout(() => {
              if (mounted && !initialized) {
                setStoredRoomCode(null);
                setStoredPlayerId(null);
                setConnectionError("Session abgelaufen");
                setTimeout(() => router.push('/'), 2000);
              }
            }, 3000);
          }
        });
      } catch {
        if (mounted) {
          setConnectionError("Verbindungsfehler");
          setTimeout(() => router.push('/'), 2000);
        }
      }
    };

    if (!initialized || !socket.connected) {
      initConnection();
    }

    return () => {
      mounted = false;
    };
  }, [roomCode, router, setGameState, setConnected, setPlayerId]); 

  // Restore playerId from storage if needed
  useEffect(() => {
    if (!playerId) {
      const storedPlayerId = getStoredPlayerId();
      if (storedPlayerId) {
        setPlayerId(storedPlayerId);
      }
    }
  }, [playerId, setPlayerId]);

  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-red-400 mb-2">{connectionError}</p>
          <p className="text-zinc-500">Zurück zum Hauptmenü...</p>
        </div>
      </div>
    );
  }

  if (loading || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-zinc-400">Verbinde mit Raum {roomCode}...</p>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.id === playerId);

  const renderGameMode = () => {
    switch (gameState.currentMode) {
      case "lobby":
        return <PlayerLobby />;
      case "lastManStanding":
        return <PlayerLastManStanding />;
      case "millionaire":
        return <PlayerMillionaire />;
      case "higherLower":
        return <PlayerHigherLower />;
      case "jeopardy":
        return <PlayerJeopardy />;
      case "leaderboard":
        return <PlayerLeaderboard />;
      case "finale":
        return <PlayerFinale />;
      default:
        return <PlayerLobby />;
    }
  };

  const getModeLabel = () => {
    switch (gameState.currentMode) {
      case "lobby": return "Warte auf Start";
      case "lastManStanding": return "Last Man Standing";
      case "millionaire": return "Wer wird Millionär?";
      case "higherLower": return "Higher or Lower";
      case "jeopardy": return "Jeopardy";
      case "leaderboard": return "Punktestand";
      case "finale": return "Finale";
      default: return "Unbekannt";
    }
  };

  const getPreviousModeLabel = () => {
    const modes = ["Last Man Standing", "Wer wird Millionär?", "Higher or Lower", "Jeopardy"];
    return modes[gameState.modeIndex] || "Unbekannt";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 p-4">
      {/* Header */}
      <div className={`mx-auto mb-6 ${gameState.currentMode === 'finale' ? 'w-full px-2' : (gameState.currentMode === 'lobby' || gameState.currentMode === 'lastManStanding' || gameState.currentMode === 'leaderboard' || gameState.currentMode === 'millionaire' || gameState.currentMode === 'higherLower' || gameState.currentMode === 'jeopardy') ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between">
          {gameState.currentMode === 'lobby' || gameState.currentMode === 'lastManStanding' || gameState.currentMode === 'leaderboard' || gameState.currentMode === 'millionaire' || gameState.currentMode === 'higherLower' || gameState.currentMode === 'jeopardy' || gameState.currentMode === 'finale' ? (
            <>
              {/* Lobby, Last Man Standing, Leaderboard, Millionaire & Higher or Lower Header - Title centered */}
              <div className="flex-1 pl-2"></div>
              <div className="flex-1 text-center">
                <h1 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-none bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {gameState.currentMode === 'lobby' ? 'Lobby' : gameState.currentMode === 'lastManStanding' ? 'Last Man Standing' : gameState.currentMode === 'millionaire' ? 'Wer wird Millionär?' : gameState.currentMode === 'higherLower' ? 'Higher or Lower' : gameState.currentMode === 'jeopardy' ? 'Jeopardy' : gameState.currentMode === 'finale' ? '🏆 FINALE 🏆' : 'Punkte der Runde'}
                </h1>
                {gameState.currentMode === 'leaderboard' && (
                  <p className="text-blue-500 font-bold uppercase tracking-widest text-xs mt-2">{getPreviousModeLabel()}</p>
                )}
                {gameState.currentMode === 'finale' && (
                  <p className="text-yellow-500 font-bold uppercase tracking-widest text-xs mt-2">Wer holt sich den Sieg?</p>
                )}
              </div>
              <div className="flex-1 text-right flex flex-col items-end pr-2">
                <p className="text-zinc-400 text-sm font-bold">{currentPlayer?.name || "Spieler"}</p>
                {gameState.currentMode !== 'lobby' && gameState.currentMode !== 'leaderboard' && gameState.currentMode !== 'millionaire' && gameState.currentMode !== 'jeopardy' && gameState.currentMode !== 'finale' && (
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-3xl font-black text-white italic tracking-tighter">
                      {currentPlayer?.currentModeScore || 0}
                    </span>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">PKT</span>
                  </div>
                )}
                {gameState.currentMode === 'higherLower' && gameState.higherLower && (
                  <div className="flex gap-1 justify-end text-lg mt-1">
                    {Array.from({ length: 2 }).map((_, i) => {
                      const lives = gameState.higherLower?.playerLives[currentPlayer?.id || ""] || 0;
                      return (
                        <span key={i} className={`transition-all duration-500 ${i < lives ? "drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : "grayscale opacity-20"}`}>
                          ❤️
                        </span>
                      );
                    })}
                  </div>
                )}
                <Badge variant="outline" className="border-green-500/50 text-green-500 mt-1 text-[8px] uppercase font-black tracking-widest">
                  {gameState.players.filter(p => p.connected).length} / {gameState.players.length} Spieler
                </Badge>
              </div>
            </>
          ) : (
            <>
              {/* Other Modes Header - Original style */}
              <div>
                <h1 className="text-2xl font-bold text-white">Dümmer geht Immer</h1>
                <Badge className="bg-white text-black mt-1">{getModeLabel()}</Badge>
              </div>
              <div className="text-right flex flex-col items-end">
                <p className="text-zinc-400 text-sm font-bold">{currentPlayer?.name || "Spieler"}</p>
                {gameState.currentMode !== 'finale' && (
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-3xl font-black text-white italic tracking-tighter">
                      {currentPlayer?.currentModeScore || 0}
                    </span>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">PKT</span>
                  </div>
                )}
                <Badge variant="outline" className="border-green-500/50 text-green-500 mt-1 text-[8px] uppercase font-black tracking-widest">
                  {gameState.players.filter(p => p.connected).length} / {gameState.players.length} Spieler
                </Badge>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Game Content */}
      <div className={`mx-auto ${(gameState.currentMode === 'lobby' || gameState.currentMode === 'lastManStanding' || gameState.currentMode === 'higherLower' || gameState.currentMode === 'jeopardy') ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {renderGameMode()}
      </div>

      {/* Mini-Leaderboard - Bottom for non-sidebar modes, hidden for sidebar modes */}
      {gameState.currentMode !== 'lobby' && gameState.currentMode !== 'leaderboard' && gameState.currentMode !== 'finale' && gameState.currentMode !== 'higherLower' && gameState.currentMode !== 'lastManStanding' && gameState.currentMode !== 'millionaire' && gameState.currentMode !== 'jeopardy' && (
        <div className="max-w-md mx-auto mt-16 pb-12">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mb-6 text-center italic opacity-50">Live Rundenstand</p>
            <div className="space-y-3">
              {[...gameState.players]
                .sort((a, b) => b.currentModeScore - a.currentModeScore)
                .map((p, index) => {
                  const isMe = p.id === playerId;
                  const isConfirmed = gameState.currentMode === 'millionaire' && gameState.millionaire?.playerAnswers[p.id]?.confirmed;
                  const showResult = gameState.currentMode === 'millionaire' && gameState.millionaire?.showingResults;
                  const isCorrect = showResult && gameState.millionaire?.playerAnswers[p.id]?.correct;
                  const answerIdx = showResult ? gameState.millionaire?.playerAnswers[p.id]?.answer : null;
                  
                  // Check lives for Higher Lower
                  const holLives = gameState.currentMode === 'higherLower' && gameState.higherLower ? (gameState.higherLower.playerLives[p.id] ?? 0) : null;
                  const isEliminated = (gameState.currentMode === 'higherLower' && holLives === 0) || 
                                     (gameState.currentMode === 'lastManStanding' && gameState.lastManStanding?.rounds[gameState.lastManStanding.currentRound].eliminatedPlayers.includes(p.id));
                  
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-2xl transition-all border ${
                      isEliminated ? "bg-red-950/20 border-red-900/50" : isMe ? "bg-white/10 border-white/20" : "bg-black/20 border-transparent"
                    }`}>
                      <div className="flex items-center gap-4">
                        <span className={`text-xs font-black italic ${index === 0 && !isEliminated ? "text-yellow-500" : isEliminated ? "text-red-700" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col text-left">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-tight ${isEliminated ? "line-through text-red-500/50" : isMe ? "text-white" : "text-zinc-400"}`}>{p.name}</span>
                            {gameState.currentMode === 'millionaire' && !showResult && isConfirmed && (
                              <Badge className="bg-green-600/20 text-green-500 border border-green-500/30 text-[7px] font-black px-1.5 py-0 h-3.5 ml-2 animate-pulse">EINGELOGGT</Badge>
                            )}
                            {holLives !== null && (
                              <div className="flex gap-0.5 ml-1 text-sm">
                                {"❤️".repeat(holLives)}
                                {"🖤".repeat(Math.max(0, 2 - holLives))}
                              </div>
                            )}
                          </div>
                          {showResult && answerIdx !== null && (
                            <span className={`text-[10px] font-black italic uppercase ${isCorrect ? "text-green-500" : "text-red-500"}`}>
                              {isCorrect ? `RICHTIG (${["A", "B", "C", "D"][answerIdx as number]})` : "FALSCH"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black italic tracking-tighter ${isEliminated ? "text-red-500/70" : isMe ? "text-white" : "text-zinc-500"}`}>{p.currentModeScore}</span>
                        <span className={`text-[10px] font-bold uppercase ${isEliminated ? "text-red-700" : "text-zinc-700"}`}>PKT</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
