"use client";

import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function AdminMillionaire() {
  const { gameState } = useGameStore();

  if (!gameState || !gameState.millionaire) return null;

  const wwm = gameState.millionaire;
  const currentQuestion = wwm.questions[wwm.currentQuestionIndex];
  const progress = ((wwm.currentQuestionIndex + 1) / wwm.questions.length) * 100;

  const handleShowResults = () => {
    const socket = getSocket();
    socket.emit("showMillionaireResults");
  };

  const handleNextQuestion = () => {
    const socket = getSocket();
    socket.emit("nextQuestion");
  };

  const handleShowLeaderboard = () => {
    const socket = getSocket();
    socket.emit("showLeaderboard");
  };

  const isLastQuestion = wwm.currentQuestionIndex === wwm.questions.length - 1;
  const allAnswered = gameState.players.every(p => wwm.playerAnswers[p.id]?.confirmed);

  return (
    <div className="space-y-6 pb-24">
      {/* Header Info */}
      <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Wer wird Millionär?</h2>
          <div className="flex items-center gap-2 mt-1">
             <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Frage {wwm.currentQuestionIndex + 1} / {wwm.questions.length}</p>
             <Progress value={progress} className="h-1 w-20" />
          </div>
        </div>
        <div className="text-right">
          <div className="flex flex-col items-end">
            <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Wert dieser Frage</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white italic">{currentQuestion.points}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">PKT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
        <CardContent className="p-8 text-center">
          <p className="text-zinc-500 text-xs uppercase font-black tracking-[0.2em] mb-2">Aktuelle Frage</p>
          <h3 className="text-3xl font-black text-white italic tracking-tighter leading-tight mb-6">{currentQuestion.question}</h3>
          
          {/* Answer Options for Admin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {currentQuestion.options.map((option, index) => {
              const isCorrect = index === currentQuestion.correctAnswer;
              return (
                <div 
                  key={index} 
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    isCorrect ? "bg-green-950/30 border-green-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="font-black mr-2">{["A", "B", "C", "D"][index]}:</span>
                  <span className="font-bold">{option}</span>
                  {isCorrect && <span className="ml-2">✓</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Players List (Live Rundenstand Design) */}
      <div className="max-w-md mx-auto">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <div className="flex justify-between items-center mb-6">
             <div />
             <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] text-center italic opacity-50">Live Rundenstand</p>
             <div />
          </div>
          <div className="space-y-3">
            {[...gameState.players]
              .sort((a, b) => b.currentModeScore - a.currentModeScore)
              .map((player, index) => {
                const answer = wwm.playerAnswers[player.id];
                const isConfirmed = answer?.confirmed;
                const isCorrect = answer?.correct;
                const hasAnswer = answer && answer.answer !== null;
                
                return (
                  <div
                    key={player.id}
                    className="w-full flex items-center justify-between p-3 rounded-2xl transition-all border border-white/5 bg-black/20"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <span className={`text-xs font-black italic ${index === 0 ? "text-yellow-500" : "text-zinc-700"}`}>#{index + 1}</span>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black uppercase tracking-tight text-zinc-400">
                            {player.name}
                          </span>
                          {!wwm.showingResults && isConfirmed && (
                            <Badge className="bg-green-600/20 text-green-500 border border-green-500/30 text-[7px] font-black px-1.5 py-0 h-3.5 animate-pulse">EINGELOGGT</Badge>
                          )}
                        </div>
                        {wwm.showingResults && hasAnswer && (
                          <span className={`text-[10px] font-black italic uppercase ${isCorrect ? "text-green-500" : "text-red-500"}`}>
                            {isCorrect ? `RICHTIG (${["A", "B", "C", "D"][answer.answer!]})` : "FALSCH"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black italic tracking-tighter text-zinc-500">
                        {player.currentModeScore}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-zinc-700">PKT</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-md border-t border-zinc-800 flex gap-4 z-50">
        {!wwm.showingResults ? (
          <Button
            size="lg"
            className="flex-1 h-14 bg-white text-black hover:bg-zinc-200 text-lg font-black uppercase italic shadow-xl"
            onClick={handleShowResults}
          >
            Antwort Auflösen
          </Button>
        ) : !isLastQuestion ? (
          <Button
            size="lg"
            className="flex-1 h-14 bg-blue-600 text-white hover:bg-blue-500 text-lg font-black uppercase italic shadow-lg"
            onClick={handleNextQuestion}
          >
            Nächste Frage →
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 h-14 bg-white text-black hover:bg-zinc-200 text-lg font-black uppercase italic shadow-xl"
            onClick={handleShowLeaderboard}
          >
            Zum Punktestand →
          </Button>
        )}
      </div>
    </div>
  );
}
