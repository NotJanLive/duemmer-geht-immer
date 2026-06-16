"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/lib/gameStore";
import { getSocket, connectSocket } from "@/lib/socket";
import { getSessionId, getStoredRoomCode, getStoredIsAdmin, setStoredRoomCode, setStoredPlayerId } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import AdminLobby from "@/components/game/AdminLobby";
import AdminLastManStanding from "@/components/game/AdminLastManStanding";
import AdminMillionaire from "@/components/game/AdminMillionaire";
import AdminHigherLower from "@/components/game/AdminHigherLower";
import AdminJeopardy from "@/components/game/AdminJeopardy";
import AdminLeaderboard from "@/components/game/AdminLeaderboard";
import AdminFinale from "@/components/game/AdminFinale";

export default function AdminPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;
  const { gameState, setGameState, setConnected } = useGameStore();
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Verify this is the admin for this room
    const storedRoom = getStoredRoomCode();
    const storedIsAdmin = getStoredIsAdmin();
    
    if (!storedIsAdmin) {
      router.push('/');
      return;
    }

    // If stored room doesn't match URL, redirect
    if (storedRoom && storedRoom !== roomCode) {
      router.push('/');
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
        
        // Register the gameState listener (once)
        socket.off("gameState"); 
        socket.on("gameState", (state) => {
          if (mounted) {
            setGameState(state);
            setLoading(false);
            setInitialized(true);
          }
        });

        socket.off("error");
        socket.on("error", (message) => {
          if (mounted) {
            setConnectionError(message);
            setTimeout(() => router.push('/'), 3000);
          }
        });

        // Try to rejoin
        const sessionId = getSessionId();
        socket.emit("rejoinRoom", roomCode, sessionId, (response) => {
          if (!mounted) return;
          
          if (response.success) {
            if (response.gameState) {
              setGameState(response.gameState);
            }
            setLoading(false);
            setInitialized(true);
          } else {
            // Room doesn't exist - maybe we just created it and it's still loading
            setTimeout(() => {
              if (mounted && !initialized) {
                setStoredRoomCode(null);
                setStoredPlayerId(null);
                setConnectionError("Raum nicht gefunden");
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
    // Removed gameState and initialized from dependencies to prevent infinite loops / re-registers
  }, [roomCode, router, setGameState, setConnected]); 

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
          <p className="text-zinc-400">Lade Raum {roomCode}...</p>
        </div>
      </div>
    );
  }

  const renderGameMode = () => {
    switch (gameState.currentMode) {
      case "lobby":
        return <AdminLobby />;
      case "lastManStanding":
        return <AdminLastManStanding />;
      case "millionaire":
        return <AdminMillionaire />;
      case "higherLower":
        return <AdminHigherLower />;
      case "jeopardy":
        return <AdminJeopardy />;
      case "leaderboard":
        return <AdminLeaderboard />;
      case "finale":
        return <AdminFinale />;
      default:
        return <AdminLobby />;
    }
  };

  const getModeLabel = () => {
    switch (gameState.currentMode) {
      case "lobby": return "Lobby";
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
      <div className={`mx-auto mb-6 ${gameState.currentMode === 'finale' ? 'w-full px-2' : (gameState.currentMode === 'lobby' || gameState.currentMode === 'lastManStanding' || gameState.currentMode === 'leaderboard' || gameState.currentMode === 'millionaire' || gameState.currentMode === 'higherLower' || gameState.currentMode === 'jeopardy') ? 'max-w-5xl' : 'max-w-6xl'}`}>
        <div className="flex items-center justify-between">
          {gameState.currentMode === 'lobby' || gameState.currentMode === 'lastManStanding' || gameState.currentMode === 'leaderboard' || gameState.currentMode === 'millionaire' || gameState.currentMode === 'higherLower' || gameState.currentMode === 'jeopardy' || gameState.currentMode === 'finale' ? (
            <>
              {/* Lobby, Last Man Standing, Leaderboard & Millionaire Header - Title centered */}
              <div className="flex-1"></div>
              <div className="flex-1 text-center">
                <h1 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-none bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {gameState.currentMode === 'lobby' ? 'Lobby' : gameState.currentMode === 'lastManStanding' ? 'Last Man Standing' : gameState.currentMode === 'millionaire' ? 'Wer wird Millionär?' : gameState.currentMode === 'higherLower' ? 'Higher or Lower' : gameState.currentMode === 'jeopardy' ? 'Jeopardy' : gameState.currentMode === 'finale' ? '🏆 FINALE 🏆' : 'Punkte der Runde'}
                </h1>
                {gameState.currentMode === 'leaderboard' ? (
                  <p className="text-blue-500 font-bold uppercase tracking-widest text-xs mt-2">{getPreviousModeLabel()}</p>
                ) : gameState.currentMode === 'finale' ? (
                  <p className="text-yellow-500 font-bold uppercase tracking-widest text-xs mt-2">Wer holt sich den Sieg?</p>
                ) : (
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2 opacity-50">Spielleiter-Ansicht</p>
                )}
              </div>
              <div className="flex-1 flex flex-col items-end">
                <p className="text-zinc-400 text-sm font-bold">{gameState.adminName || "Spielleiter"}</p>
                <Badge variant="outline" className="border-green-500 text-green-500 mt-1">
                  {gameState.players.filter(p => p.connected).length} / {gameState.players.length} Spieler
                </Badge>
              </div>
            </>
          ) : (
            <>
              {/* Other Modes Header - Original style */}
              <div>
                <h1 className="text-3xl font-bold text-white">Dümmer geht Immer</h1>
                <p className="text-zinc-400">Spielleiter-Ansicht</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-zinc-400 text-sm">Raumcode</p>
                  <p className="text-3xl font-mono font-bold text-white tracking-wider">{roomCode}</p>
                </div>
                <Badge variant="outline" className="border-green-500 text-green-500">
                  {gameState.players.filter(p => p.connected).length} / {gameState.players.length} Spieler
                </Badge>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Game Content */}
      <div className={`mx-auto ${(gameState.currentMode === 'lobby' || gameState.currentMode === 'lastManStanding' || gameState.currentMode === 'higherLower' || gameState.currentMode === 'jeopardy' || gameState.currentMode === 'finale') ? 'max-w-5xl' : 'max-w-6xl'}`}>
        {renderGameMode()}
      </div>
    </div>
  );
}
