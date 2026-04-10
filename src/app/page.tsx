"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectSocket, getSocket } from "@/lib/socket";
import { useGameStore } from "@/lib/gameStore";
import { ChevronLeft, Hash, Play, PlusCircle, Rocket, User } from "lucide-react";
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

  const changeMode = (newMode: "choose" | "create" | "join") => {
    setError("");
    setName("");
    setRoomCode("");
    setMode(newMode);
  };

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

  const handleCreateRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  const handleJoinRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError("Bitte gib deinen Namen ein");
      return;
    }
    if (roomCode.length < 6) {
      setError("Bitte gib den vollständigen Raumcode ein");
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

      socket.emit("joinRoom", roomCode.toUpperCase(), name.trim(), sessionId, (response) => {
        if (response.success && response.playerId) {
          setStoreRoomCode(roomCode.toUpperCase());
          setStoredRoomCode(roomCode.toUpperCase());
          setStoredPlayerName(name.trim());
          setStoredPlayerId(response.playerId);
          setStoredIsAdmin(false);
          setPlayerId(response.playerId);
          setSessionId(sessionId);
          setIsAdmin(false);
          
          socket.on("gameState", (state) => {
            setGameState(state);
          });

          router.push(`/play/${roomCode.toUpperCase()}`);
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

  const handleCodeChange = (index: number, value: string) => {
    const char = value.slice(-1).toUpperCase();
    if (char && !/[A-Z0-9]/.test(char)) return;

    const newCode = roomCode.split("");
    // Ensure the array has enough length
    while (newCode.length < 6) newCode.push("");
    
    newCode[index] = char;
    const finalCode = newCode.join("").slice(0, 6);
    setRoomCode(finalCode);

    if (char && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !roomCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").toUpperCase().slice(0, 6).replace(/[^A-Z0-9]/g, "");
    setRoomCode(pastedData);
    const lastIdx = Math.min(pastedData.length, 5);
    document.getElementById(`code-${lastIdx}`)?.focus();
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-zinc-400 font-medium">Lade Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-black via-zinc-900 to-black overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 bg-zinc-800/20 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-zinc-800/20 rounded-full blur-3xl -z-10 animate-pulse delay-1000" />
      
      <div className="text-center mb-12 animate-in fade-in zoom-in duration-700">
        <h1 className="text-6xl md:text-8xl font-black mb-4 pb-4 px-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-600 tracking-tight leading-tight">
          DÜMMER GEHT IMMER
        </h1>
        <div className="flex items-center justify-center gap-2 text-zinc-400">
          <div className="h-px w-8 bg-zinc-800" />
          <p className="text-lg md:text-xl font-light uppercase tracking-[0.2em]">Die ultimative Quizshow</p>
          <div className="h-px w-8 bg-zinc-800" />
        </div>
      </div>

      {mode === "choose" && (
        <div className="flex flex-col gap-4 w-full max-w-md">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-both">
            <Button
              size="lg"
              className="w-full h-20 text-xl bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.02] active:scale-95 group"
              onClick={() => changeMode("create")}
            >
              <PlusCircle className="mr-2 h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
              Spiel erstellen
            </Button>
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 delay-150 fill-mode-both">
            <Button
              size="lg"
              variant="outline"
              className="w-full h-20 text-xl border-zinc-800 text-white hover:bg-white hover:text-black shadow-lg transition-all hover:scale-[1.02] active:scale-95 group"
              onClick={() => changeMode("join")}
            >
              <Rocket className="mr-2 h-6 w-6 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform duration-300" />
              Spiel beitreten
            </Button>
          </div>
        </div>
      )}

      {mode === "create" && (
        <Card className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border-zinc-800 animate-in fade-in slide-in-from-right-8 duration-500 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <PlusCircle className="h-6 w-6" />
              Neues Spiel
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Du wirst der Spielleiter dieser Show.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRoom} className="space-y-6">
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                  <Input
                    placeholder="Dein Name (Spielleiter)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-12 bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-zinc-700 transition-all"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>
              
              {error && (
                <p className="text-red-500 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                  {error}
                </p>
              )}
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => changeMode("choose")}
                  className="text-zinc-500 hover:text-white hover:bg-zinc-800"
                  disabled={loading}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Zurück
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-white text-black hover:bg-zinc-200 font-bold"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                      Erstelle...
                    </span>
                  ) : (
                    "Raum erstellen"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === "join" && (
        <Card className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border-zinc-800 animate-in fade-in slide-in-from-left-8 duration-500 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <Rocket className="h-6 w-6" />
              Beitreten
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Gib deinen Namen und den Raumcode ein.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinRoom} className="space-y-6">
              <div className="space-y-6">
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                  <Input
                    placeholder="Dein Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-12 bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-zinc-700 transition-all"
                    disabled={loading}
                    autoFocus
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-zinc-500 ml-1">
                    <span className="text-[10px] uppercase font-medium tracking-[0.2em]">Raumcode</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <Input
                        key={index}
                        id={`code-${index}`}
                        value={roomCode[index] || ""}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        className="h-14 w-full bg-zinc-950/50 border-zinc-800 text-white text-center text-2xl font-black uppercase focus:ring-zinc-700 focus:border-zinc-500 transition-all p-0"
                        maxLength={1}
                        disabled={loading}
                        autoComplete="off"
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-center text-zinc-600 uppercase tracking-wider">Gib den 6-stelligen Code ein</p>
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => changeMode("choose")}
                  className="text-zinc-500 hover:text-white hover:bg-zinc-800"
                  disabled={loading}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Zurück
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-white text-black hover:bg-zinc-200 font-bold"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                      Verbinde...
                    </span>
                  ) : (
                    "Spiel beitreten"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
