"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectSocket, getSocket } from "@/lib/socket";
import { useGameStore } from "@/lib/gameStore";
import { 
  getSessionId, 
  setSessionId as setStoredSessionId,
  setStoredRoomCode, 
  setStoredPlayerName, 
  getStoredRoomCode,
  setStoredPlayerId,
  setStoredIsAdmin,
  getStoredIsAdmin,
  getStoredPlayerId
} from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  const { setRoomCode: setStoreRoomCode, setPlayerId, setSessionId, setIsAdmin, setGameState } = useGameStore();

  // Check for existing session on mount
  useEffect(() => {
    const storedRoom = getStoredRoomCode();
    const storedIsAdmin = getStoredIsAdmin();
    const storedPlayerId = getStoredPlayerId();
    
    if (storedRoom && storedPlayerId) {
      // Try to reconnect to existing session
      const attemptReconnect = async () => {
        try {
          await connectSocket();
          const socket = getSocket();
          const sessionId = getSessionId();
          
          socket.emit("rejoinRoom", storedRoom, sessionId, (response) => {
            if (response.success && response.playerId) {
              setStoreRoomCode(storedRoom);
              setPlayerId(response.playerId);
              setSessionId(sessionId);
              setIsAdmin(storedIsAdmin);
              
              socket.on("gameState", (state) => {
                setGameState(state);
              });
              
              // Redirect to appropriate page
              if (storedIsAdmin) {
                router.push(`/admin/${storedRoom}`);
              } else {
                router.push(`/play/${storedRoom}`);
              }
            } else {
              // Session expired, clear storage
              setStoredRoomCode(null);
              setStoredPlayerId(null);
              setCheckingSession(false);
            }
          });
        } catch {
          setStoredRoomCode(null);
          setStoredPlayerId(null);
          setCheckingSession(false);
        }
      };
      
      attemptReconnect();
    } else {
      setCheckingSession(false);
    }
  }, [router, setStoreRoomCode, setPlayerId, setSessionId, setIsAdmin, setGameState]);

  const handleCreateRoom = async () => {
    if (!name.trim()) {
      setError("Bitte gib deinen Namen ein");
      return;
    }

    // Clear any old session data
    setStoredRoomCode(null);
    setStoredPlayerId(null);
    setStoredIsAdmin(false);

    setLoading(true);
    setError("");

    try {
      await connectSocket();
      const socket = getSocket();
      const sessionId = getSessionId();

      socket.on("gameState", (state) => {
        setGameState(state);
        // Store admin ID
        setStoredPlayerId(state.adminId);
        setPlayerId(state.adminId);
      });

      socket.emit("createRoom", name.trim(), (response) => {
        if (response.success && response.roomCode) {
          // Save the server-generated sessionId for admin reconnect
          if (response.sessionId) {
            setStoredSessionId(response.sessionId);
          }
          setStoreRoomCode(response.roomCode);
          setStoredRoomCode(response.roomCode);
          setStoredPlayerName(name.trim());
          setStoredIsAdmin(true);
          setSessionId(response.sessionId || sessionId);
          setIsAdmin(true);
          
          // Small delay to ensure gameState is received
          setTimeout(() => {
            router.push(`/admin/${response.roomCode}`);
          }, 100);
        } else {
          setError(response.error || "Fehler beim Erstellen des Raums");
          setLoading(false);
        }
      });
    } catch {
      setError("Verbindungsfehler");
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!name.trim()) {
      setError("Bitte gib deinen Namen ein");
      return;
    }
    if (!roomCode.trim()) {
      setError("Bitte gib den Raumcode ein");
      return;
    }

    // Clear any old session data
    setStoredRoomCode(null);
    setStoredPlayerId(null);
    setStoredIsAdmin(false);

    setLoading(true);
    setError("");

    try {
      await connectSocket();
      const socket = getSocket();
      const sessionId = getSessionId();

      socket.emit("joinRoom", roomCode.trim().toUpperCase(), name.trim(), sessionId, (response) => {
        if (response.success && response.playerId) {
          setStoreRoomCode(roomCode.trim().toUpperCase());
          setStoredRoomCode(roomCode.trim().toUpperCase());
          setStoredPlayerName(name.trim());
          setStoredPlayerId(response.playerId);
          setStoredIsAdmin(false);
          setPlayerId(response.playerId);
          setSessionId(sessionId);
          setIsAdmin(false);
          
          socket.on("gameState", (state) => {
            setGameState(state);
          });

          router.push(`/play/${roomCode.trim().toUpperCase()}`);
        } else {
          setError(response.error || "Fehler beim Beitreten");
        }
        setLoading(false);
      });
    } catch {
      setError("Verbindungsfehler");
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-zinc-400">Prüfe Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-black to-zinc-900">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
          Dümmer geht Immer
        </h1>
        <p className="text-zinc-400 text-xl">Die ultimative Quizshow für Freunde</p>
      </div>

      {mode === "choose" && (
        <div className="flex flex-col gap-4 w-full max-w-md">
          <Button
            size="lg"
            className="h-16 text-xl bg-white text-black hover:bg-zinc-200"
            onClick={() => setMode("create")}
          >
            🎮 Spiel erstellen
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 text-xl border-white text-white hover:bg-white hover:text-black"
            onClick={() => setMode("join")}
          >
            🚀 Spiel beitreten
          </Button>
        </div>
      )}

      {mode === "create" && (
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Neues Spiel erstellen</CardTitle>
            <CardDescription className="text-zinc-400">
              Du wirst der Spielleiter (nimmst nicht teil)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Dein Name (Spielleiter)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              disabled={loading}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setMode("choose")}
                className="border-zinc-700 text-zinc-300"
                disabled={loading}
              >
                Zurück
              </Button>
              <Button
                className="flex-1 bg-white text-black hover:bg-zinc-200"
                onClick={handleCreateRoom}
                disabled={loading}
              >
                {loading ? "Erstelle..." : "Raum erstellen"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "join" && (
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Spiel beitreten</CardTitle>
            <CardDescription className="text-zinc-400">
              Gib den Raumcode ein
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Dein Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              disabled={loading}
            />
            <Input
              placeholder="Raumcode (z.B. ABC123)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 tracking-widest text-center text-2xl font-mono"
              maxLength={6}
              disabled={loading}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setMode("choose")}
                className="border-zinc-700 text-zinc-300"
                disabled={loading}
              >
                Zurück
              </Button>
              <Button
                className="flex-1 bg-white text-black hover:bg-zinc-200"
                onClick={handleJoinRoom}
                disabled={loading}
              >
                {loading ? "Beitreten..." : "Beitreten"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
