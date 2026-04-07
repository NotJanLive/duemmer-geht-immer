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

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
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
        </div>
      </div>

      {/* Game Content */}
      <div className="max-w-6xl mx-auto">
        {renderGameMode()}
      </div>
    </div>
  );
}
