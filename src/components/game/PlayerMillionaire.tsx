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
    <div className="space-y-6">
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
  );
}
