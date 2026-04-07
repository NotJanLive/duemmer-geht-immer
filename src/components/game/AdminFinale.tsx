"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminFinale() {
  const { gameState } = useGameStore();
  const [animatingScores, setAnimatingScores] = useState<Record<string, number>>({});
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const animationFinishedRef = useRef(false);
  
  const PHASE_DURATION = 3000; // 3 seconds per player elimination

  // Stable confetti particles - generated only once when showConfetti becomes true
  const confettiParticles = useMemo(() => {
    if (!showConfetti) return [];
    return Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      duration: 3 + Math.random() * 2, // Faster fall (3-5s)
      delay: Math.random() * 10, // Stagger over 10s
      emoji: ["🎉", "🎊", "⭐", "✨", "🏆", "✨"][Math.floor(Math.random() * 6)],
      rotation: Math.random() * 360,
      size: 1.2 + Math.random() * 1.2
    }));
  }, [showConfetti]);

  // Confetti timeout - match the 10s delay + max duration
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => {
        // We don't set showConfetti to false here anymore to avoid re-triggering logic
        // The animation handles the "stop" via 'forwards'
      }, 16000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  if (!gameState) return null;

  const sortedByAlphabet = useMemo(() => [...gameState.players].sort((a, b) => a.name.localeCompare(b.name, "de")), [gameState.players]);
  const sortedByScore = useMemo(() => [...gameState.players].sort((a, b) => a.totalScore - b.totalScore), [gameState.players]);
  const maxScore = useMemo(() => Math.max(...gameState.players.map(p => p.totalScore), 1), [gameState.players]);

  const startAnimation = () => {
    animationFinishedRef.current = false;
    const socket = getSocket();
    socket.emit("startFinaleAnimation");
  };

  useEffect(() => {
    if (!gameState.finaleStartTime || animationFinishedRef.current) {
      if (!gameState.finaleStartTime) {
        setAnimatingScores({});
        setEliminatedIds([]);
        setWinnerId(null);
        setShowConfetti(false);
        animationFinishedRef.current = false;
      }
      return;
    }

    const RISE_DURATION = 5000; // 5 seconds for each rise
    const PAUSE_DURATION = 2000; // 2 seconds pause for elimination
    const STEP_DURATION = RISE_DURATION + PAUSE_DURATION;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedTotal = now - (gameState.finaleStartTime || 0);
      
      const newScores: Record<string, number> = {};
      const newEliminated: string[] = [];
      let currentWinnerId: string | null = null;
      let finished = false;

      // 1. Calculate which players are eliminated based on elapsed time
      sortedByScore.forEach((p, idx) => {
        if (idx < sortedByScore.length - 1) {
          const pEliminationTime = idx * STEP_DURATION + RISE_DURATION;
          if (elapsedTotal >= pEliminationTime) {
            newEliminated.push(p.id);
          }
        }
      });

      // 2. Calculate current scores and check if finished
      for (let i = 0; i < sortedByScore.length; i++) {
        const prevScore = i === 0 ? 0 : sortedByScore[i - 1].totalScore;
        const targetScore = sortedByScore[i].totalScore;
        const stepStartTime = i * STEP_DURATION;
        
        if (elapsedTotal < stepStartTime + RISE_DURATION) {
          const progress = Math.max(0, (elapsedTotal - stepStartTime) / RISE_DURATION);
          const currentVirtualScore = prevScore + (targetScore - prevScore) * progress;
          
          gameState.players.forEach(p => {
            newScores[p.id] = Math.min(p.totalScore, Math.floor(currentVirtualScore));
          });
          break;
        } else if (elapsedTotal < stepStartTime + STEP_DURATION) {
          gameState.players.forEach(p => {
            newScores[p.id] = Math.min(p.totalScore, targetScore);
          });

          if (i === sortedByScore.length - 1) {
            currentWinnerId = sortedByScore[i].id;
            finished = true;
          }
          break;
        } else if (i === sortedByScore.length - 1) {
          gameState.players.forEach(p => {
            newScores[p.id] = p.totalScore;
          });
          currentWinnerId = sortedByScore[i].id;
          finished = true;
        }
      }

      setAnimatingScores(newScores);
      setEliminatedIds(newEliminated);

      if (finished) {
        animationFinishedRef.current = true;
        setWinnerId(currentWinnerId);
        setShowConfetti(true);
        clearInterval(interval);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [gameState.finaleStartTime, sortedByScore, gameState.players]);

  const handleCloseSession = () => {
    if (confirm("Möchtest du die Sitzung wirklich beenden? Alle Spieler werden gekickt.")) {
      const socket = getSocket();
      socket.emit("closeRoom");
      window.location.href = "/";
    }
  };

  const handleDownloadImage = () => {
    alert("Tipp: Nutze 'Windows + Shift + S' (Win) oder 'Cmd + Shift + 4' (Mac) für einen Screenshot!");
  };

  return (
    <div className="space-y-8 pb-32">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          {confettiParticles.map((p) => (
            <div 
              key={p.id} 
              className="absolute" 
              style={{ 
                left: `${p.left}%`, 
                top: `-10%`, 
                fontSize: `${p.size}rem`,
                animation: `fall ${p.duration}s linear ${p.delay}s forwards`,
                opacity: 0,
                transform: `rotate(${p.rotation}deg)`
              }}
            >
              {p.emoji}
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <h2 className="text-6xl font-black text-white mb-2 uppercase italic tracking-tighter drop-shadow-2xl">🏆 FINALE 🏆</h2>
        <p className="text-zinc-500 font-bold uppercase tracking-[0.5em] text-sm">Dümmer geht Immer</p>
      </div>

      {winnerId && (
         <div className="text-center py-6 px-4">
            <p className="text-xl font-black uppercase italic tracking-widest text-yellow-500 mb-2 drop-shadow-md">Der Gewinner ist</p>
            <p className="text-4xl sm:text-7xl font-black uppercase italic tracking-tighter mb-2 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] break-words leading-none">
               {gameState.players.find(p => p.id === winnerId)?.name}
            </p>
            <div className="flex items-baseline justify-center gap-2">
              <p className="text-2xl sm:text-4xl font-mono font-black text-yellow-500 drop-shadow-md">{gameState.players.find(p => p.id === winnerId)?.totalScore}</p>
              <span className="text-sm sm:text-xl font-black text-yellow-600 uppercase tracking-widest">PKT</span>
            </div>
         </div>
      )}

      <Card className="bg-zinc-900/80 border-zinc-800 shadow-2xl backdrop-blur-md overflow-hidden">
        <CardContent className="p-8">
          <div className="space-y-6">
            {sortedByAlphabet.map((player) => {
              const score = animatingScores[player.id] ?? 0;
              const isEliminated = eliminatedIds.includes(player.id);
              const isWinner = winnerId === player.id;
              const percentage = (score / maxScore) * 100;
              
              return (
                <div key={player.id} className={`relative transition-all duration-700 ${isEliminated ? "opacity-20 grayscale scale-95" : "scale-100"}`}>
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-3">
                      {isWinner && <span className="text-2xl">🏆</span>}
                      <span className={`text-xl font-black uppercase italic tracking-tighter ${isWinner ? "text-yellow-500" : "text-white"}`}>
                        {player.name}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black font-mono tracking-tighter ${isWinner ? "text-yellow-500" : "text-white"}`}>
                        {score}
                      </span>
                      <span className={`text-[10px] font-bold uppercase ${isWinner ? "text-yellow-600" : "text-zinc-600"}`}>PKT</span>
                    </div>
                  </div>
                  
                  <div className="h-6 bg-black/40 rounded-lg overflow-hidden border border-zinc-800 p-1">
                    <div 
                      className={`h-full rounded transition-all duration-[16ms] ease-linear ${
                        isWinner ? "bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-600 shadow-[0_0_20px_rgba(234,179,8,0.4)]" : 
                        isEliminated ? "bg-zinc-800" : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 p-8 bg-black/90 backdrop-blur-2xl border-t border-zinc-800 flex flex-wrap gap-6 z-[110] justify-center">
        {!gameState.finaleStartTime && (
          <Button
            size="lg"
            className="h-20 px-16 text-3xl font-black uppercase italic bg-white text-black hover:bg-zinc-200 shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all"
            onClick={startAnimation}
          >
            🔥 Animation starten!
          </Button>
        )}

        {winnerId && (
          <>
            <Button
              size="lg"
              variant="destructive"
              className="h-16 px-10 font-black uppercase italic shadow-xl hover:bg-red-700 transition-all"
              onClick={handleCloseSession}
            >
              🚪 Session beenden
            </Button>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(115vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
