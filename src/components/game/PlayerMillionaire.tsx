"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function PlayerMillionaire() {
  const { gameState, playerId } = useGameStore();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(true);

  if (!gameState || !gameState.millionaire) return null;

  const wwm = gameState.millionaire;
  const currentQuestion = wwm.questions[wwm.currentQuestionIndex];
  const myAnswer = wwm.playerAnswers[playerId || ""];
  const progress = ((wwm.currentQuestionIndex + 1) / wwm.questions.length) * 100;

  useEffect(() => {
    setSelectedAnswer(null);
    setConfirmed(false);
  }, [wwm.currentQuestionIndex]);

  useEffect(() => {
    if (myAnswer) {
      if (myAnswer.answer !== null) setSelectedAnswer(myAnswer.answer);
      if (myAnswer.confirmed) setConfirmed(true);
    }
  }, [myAnswer]);

  const handleSelectAnswer = (index: number) => {
    if (confirmed || wwm.showingResults) return;
    setSelectedAnswer(index);
    const socket = getSocket();
    socket.emit("submitAnswer", currentQuestion.id, index);
  };

  const handleConfirm = () => {
    if (selectedAnswer === null || confirmed) return;
    setConfirmed(true);
    const socket = getSocket();
    socket.emit("confirmAnswer");
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Info */}
      <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
        <div>
          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Frage {wwm.currentQuestionIndex + 1} / {wwm.questions.length}</p>
          <Progress value={progress} className="h-1.5 w-32 mt-1" />
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Wert dieser Frage</p>
          <p className="text-xl font-black italic text-white">{currentQuestion.points} PKT.</p>
        </div>
      </div>

      {/* Question */}
      <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
        <CardContent className="p-8">
          <div className="text-center">
            <h3 className="text-2xl font-black text-white italic tracking-tighter leading-tight mb-4">{currentQuestion.question}</h3>
            <Badge variant="outline" className="border-zinc-700 text-zinc-500 font-mono text-[10px]">
              LEVEL: {"⭐".repeat(currentQuestion.difficulty)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Answer Options */}
      <div className="grid grid-cols-1 gap-3">
        {currentQuestion.options.map((option, index) => {
          const letter = ["A", "B", "C", "D"][index];
          const isSelected = selectedAnswer === index;
          const isCorrect = index === currentQuestion.correctAnswer;
          
          let className = "p-5 rounded-xl border-2 transition-all text-left relative overflow-hidden ";
          
          if (wwm.showingResults) {
            if (isCorrect) {
              className += "bg-green-600 border-green-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]";
            } else if (isSelected) {
              className += "bg-red-600 border-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] opacity-50";
            } else {
              className += "bg-zinc-900 border-zinc-800 text-zinc-600 opacity-30";
            }
          } else if (confirmed) {
            if (isSelected) {
              className += "bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.2)]";
            } else {
              className += "bg-zinc-900 border-zinc-800 text-zinc-600 opacity-50";
            }
          } else if (isSelected) {
            className += "bg-blue-600 border-blue-400 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-[1.02]";
          } else {
            className += "bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600 hover:bg-zinc-800";
          }
          
          return (
            <button
              key={index}
              className={className}
              onClick={() => handleSelectAnswer(index)}
              disabled={confirmed || wwm.showingResults}
            >
              <div className="flex items-center gap-4 relative z-10">
                <span className={`w-8 h-8 rounded flex items-center justify-center font-black italic border ${
                  isSelected ? "bg-black/20 border-white/20" : "bg-white/5 border-zinc-700"
                }`}>
                  {letter}
                </span>
                <span className="font-bold text-lg">{option}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirm Button */}
      {!wwm.showingResults && (
        <Button
          size="lg"
          className={`w-full h-16 text-xl font-black uppercase italic shadow-2xl transition-all ${
            confirmed 
              ? "bg-green-600 hover:bg-green-600 text-white opacity-50 cursor-not-allowed"
              : selectedAnswer !== null
                ? "bg-white text-black hover:bg-zinc-200 hover:scale-[1.02] active:scale-95"
                : "bg-zinc-900 text-zinc-700 cursor-not-allowed"
          }`}
          onClick={handleConfirm}
          disabled={selectedAnswer === null || confirmed}
        >
          {confirmed ? "✓ Eingeloggt" : "Antwort Bestätigen"}
        </Button>
      )}

      {/* Result Indicator */}
      {wwm.showingResults && myAnswer && (
        <div className={`p-6 rounded-xl text-center border-2 animate-bounce shadow-2xl ${
          myAnswer.correct 
            ? "bg-green-950/30 border-green-500 text-green-400" 
            : "bg-red-950/30 border-red-500 text-red-400"
        }`}>
          <p className="text-4xl mb-1">{myAnswer.correct ? "🌟" : "💀"}</p>
          <p className="text-xl font-black uppercase italic">
            {myAnswer.correct 
              ? `RICHTIG! +${currentQuestion.points} PKT.` 
              : "LEIDER FALSCH"
            }
          </p>
        </div>
      )}
      </div>

      {/* Slide-in Panel - Desktop Only */}
      <div
        className={`hidden lg:block fixed right-0 top-1/2 -translate-y-1/2 w-80 bg-zinc-900/95 border-2 border-zinc-800 shadow-2xl backdrop-blur-md z-40 transition-transform duration-300 ease-in-out rounded-l-3xl ${
          leaderboardOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] italic opacity-50">Live Rundenstand</p>
            <Button
              onClick={() => setLeaderboardOpen(false)}
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-zinc-800 rounded-full"
            >
              <span className="text-zinc-400">✕</span>
            </Button>
          </div>
          <div className="space-y-3">
            {[...gameState.players]
              .sort((a, b) => b.currentModeScore - a.currentModeScore)
              .map((p, index) => {
                const isMe = p.id === playerId;
                const isConfirmed = wwm.playerAnswers[p.id]?.confirmed;
                const showResult = wwm.showingResults;
                const isCorrect = showResult && wwm.playerAnswers[p.id]?.correct;

                return (
                  <div
                    key={p.id}
                    className="w-full flex flex-col p-3 rounded-2xl transition-all border border-white/5 bg-black/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-left">
                        <span className={`text-xs font-black italic ${index === 0 ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-tight truncate max-w-[120px] ${isMe ? "text-white" : "text-zinc-400"}`}>
                              {p.name}
                            </span>
                            {!showResult && isConfirmed && (
                              <div className="w-5 h-5 rounded-full bg-green-600/20 border border-green-500/30 flex items-center justify-center">
                                <span className="text-green-500 text-xs font-black leading-none">✓</span>
                              </div>
                            )}
                            {showResult && wwm.playerAnswers[p.id]?.answer !== null && wwm.playerAnswers[p.id]?.answer !== undefined && (
                              <span className={`text-xs font-black ${isCorrect ? "text-green-500" : "text-red-500"}`}>
                                {isCorrect ? "✓" : "✗"} {["A", "B", "C", "D"][wwm.playerAnswers[p.id]?.answer ?? 0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black italic tracking-tighter ${isMe ? "text-white" : "text-zinc-500"}`}>
                          {p.currentModeScore}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-zinc-700">PKT</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Toggle Button - Attached to Panel */}
        <button
          onClick={() => setLeaderboardOpen(!leaderboardOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full h-28 w-14 bg-zinc-900 border-2 border-r-0 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 rounded-l-3xl rounded-r-none shadow-2xl flex flex-col items-center justify-center gap-2 p-0 transition-colors cursor-pointer"
        >
          <span className="text-white text-2xl font-black">
            {leaderboardOpen ? '→' : '←'}
          </span>
          <span className="text-[10px] text-zinc-400 font-black uppercase [writing-mode:vertical-lr] rotate-180 tracking-wider">
            Punkte
          </span>
        </button>
      </div>

      {/* Mobile - Bottom Leaderboard */}
      <div className="lg:hidden mt-16">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mb-6 text-center italic opacity-50">Live Rundenstand</p>
          <div className="space-y-3">
            {[...gameState.players]
              .sort((a, b) => b.currentModeScore - a.currentModeScore)
              .map((p, index) => {
                const isMe = p.id === playerId;
                const isConfirmed = wwm.playerAnswers[p.id]?.confirmed;
                const showResult = wwm.showingResults;
                const isCorrect = showResult && wwm.playerAnswers[p.id]?.correct;

                return (
                  <div
                    key={p.id}
                    className="w-full flex flex-col p-3 rounded-2xl transition-all border border-white/5 bg-black/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-left">
                        <span className={`text-xs font-black italic ${index === 0 ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-tight ${isMe ? "text-white" : "text-zinc-400"}`}>
                              {p.name}
                            </span>
                            {!showResult && isConfirmed && (
                              <div className="w-5 h-5 rounded-full bg-green-600/20 border border-green-500/30 flex items-center justify-center">
                                <span className="text-green-500 text-xs font-black leading-none">✓</span>
                              </div>
                            )}
                            {showResult && wwm.playerAnswers[p.id]?.answer !== null && wwm.playerAnswers[p.id]?.answer !== undefined && (
                              <span className={`text-xs font-black ${isCorrect ? "text-green-500" : "text-red-500"}`}>
                                {isCorrect ? "✓" : "✗"} {["A", "B", "C", "D"][wwm.playerAnswers[p.id]?.answer ?? 0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black italic tracking-tighter ${isMe ? "text-white" : "text-zinc-500"}`}>
                          {p.currentModeScore}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-zinc-700">PKT</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </>
  );
}
