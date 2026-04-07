"use client";

import { useGameStore } from "@/lib/gameStore";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminJeopardy() {
  const { gameState } = useGameStore();

  if (!gameState || !gameState.jeopardy) return null;

  const jeo = gameState.jeopardy;
  const sortedPlayers = [...gameState.players].sort((a, b) => 
    a.name.localeCompare(b.name, "de")
  );
  const currentPlayer = sortedPlayers[jeo.currentPlayerIndex % sortedPlayers.length];
  const buzzedPlayer = gameState.players.find(p => p.id === jeo.buzzedPlayer);
  
  const isFirstAttempt = jeo.buzzedPlayer === currentPlayer?.id && !jeo.openForAll;

  const handleSelectQuestion = (categoryIndex: number, questionIndex: number) => {
    const socket = getSocket();
    socket.emit("selectCategory", categoryIndex, questionIndex);
  };

  const handleOpenBuzzer = () => {
    const socket = getSocket();
    socket.emit("openBuzzer");
  };

  const handleCloseBuzzer = () => {
    const socket = getSocket();
    socket.emit("closeBuzzer");
  };

  const handleAnswerCorrect = (correct: boolean) => {
    const socket = getSocket();
    socket.emit("answerCorrect", correct);
  };

  const handleDiscard = () => {
    const socket = getSocket();
    socket.emit("jeopardyDiscard");
  };

  const handleResetBuzzer = () => {
    const socket = getSocket();
    socket.emit("jeopardyResetBuzzer");
  };

  const handleShowLeaderboard = () => {
    const socket = getSocket();
    socket.emit("showLeaderboard");
  };

  const allQuestionsAnswered = jeo.categories.every(cat => 
    cat.questions.every(q => q.revealed)
  );

  const playersWhoCanBuzz = gameState.players.filter(p => p.canBuzz && !p.hasBuzzed).length;

  return (
    <div className="space-y-6 pb-24">
      {/* Header Info */}
      <div className="bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Jeopardy</h2>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            {!jeo.currentQuestion && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 rounded-full text-[10px] font-black text-white uppercase animate-pulse shadow-lg">
                <span className="w-1.5 h-1.5 bg-white rounded-full" />
                {currentPlayer?.name} WÄHLT
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Current Question & Control */}
      {jeo.currentQuestion && (
        <Card className="bg-gradient-to-br from-blue-900 to-black border-blue-800 shadow-2xl overflow-hidden relative rounded-3xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="flex items-baseline gap-1 bg-white text-black px-4 py-1 rounded-full shadow-lg">
                  {jeo.currentQuestion.originalPoints && jeo.currentQuestion.originalPoints > jeo.currentQuestion.points && (
                    <span className="text-sm font-black italic line-through text-red-600 mr-2 opacity-70">
                      {jeo.currentQuestion.originalPoints}
                    </span>
                  )}
                  <span className="text-xl font-black italic">{jeo.currentQuestion.points}</span>
                  <span className="text-[10px] font-black uppercase opacity-50">PKT</span>
                </div>
              </div>
              <h3 className="text-3xl font-black text-white italic tracking-tighter leading-tight mb-4">
                {jeo.currentQuestion.question}
              </h3>
              <div className="inline-flex items-center gap-2 bg-green-600/20 text-green-400 border border-green-500/30 px-4 py-1 rounded-full font-black uppercase italic tracking-widest text-sm">
                Lösung: {jeo.currentQuestion.answer}
              </div>
            </div>

            {/* Answer & Buzzer Control */}
            <div className="p-6 rounded-2xl bg-black/40 border border-zinc-800 shadow-inner">
              {jeo.buzzedPlayer ? (
                <div className="text-center">
                  <p className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.2em] mb-2 italic">
                    {isFirstAttempt ? "Eigene Frage für:" : "Gebuzzert von:"}
                  </p>
                  <p className="text-4xl font-black text-white uppercase italic tracking-tighter mb-6 drop-shadow-lg">{buzzedPlayer?.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="lg"
                      onClick={() => handleAnswerCorrect(true)}
                      className="bg-green-600 hover:bg-green-700 text-white h-16 font-black uppercase italic shadow-lg rounded-2xl"
                    >
                      ✓ RICHTIG (+{jeo.currentQuestion.points}P)
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => handleAnswerCorrect(false)}
                      variant="destructive"
                      className="h-16 font-black uppercase italic shadow-lg rounded-2xl"
                    >
                      ✗ FALSCH → BUZZER FREI
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                     <div className={`w-2 h-2 rounded-full ${jeo.buzzerOpen ? "bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-red-500"}`} />
                     <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">
                       {jeo.buzzerOpen 
                         ? `Buzzer offen (${playersWhoCanBuzz} Spieler)` 
                         : "Buzzer geschlossen"
                       }
                     </p>
                  </div>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {!jeo.buzzerOpen ? (
                      <Button
                        onClick={handleOpenBuzzer}
                        className="bg-green-600 hover:bg-green-700 text-white font-black uppercase italic h-12 px-6 rounded-xl"
                      >
                        🔔 Buzzer öffnen
                      </Button>
                    ) : (
                      <Button
                        onClick={handleCloseBuzzer}
                        variant="outline"
                        className="border-red-500 text-red-500 font-black uppercase italic h-12 px-6 hover:bg-red-500/10 rounded-xl"
                      >
                        Buzzer schließen
                      </Button>
                    )}
                    <Button
                      onClick={handleResetBuzzer}
                      variant="outline"
                      className="border-yellow-500 text-yellow-500 font-black uppercase italic h-12 px-6 hover:bg-yellow-500/10 rounded-xl"
                    >
                      🔄 Reset Buzz
                    </Button>
                    <Button
                      onClick={handleDiscard}
                      variant="outline"
                      className="border-zinc-700 text-zinc-500 font-black uppercase italic h-12 px-6 hover:bg-zinc-800 rounded-xl"
                    >
                      🗑️ Verwerfen (0P)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jeopardy Grid (Larger Categories) */}
      {!jeo.currentQuestion && (
        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden rounded-3xl">
          <CardContent className="p-4">
            <div className="grid grid-cols-6 gap-2">
              {jeo.categories.map((category, ci) => (
                <div key={`cat-${ci}`} className="p-3 bg-blue-950 border border-blue-900 text-white text-center text-xs font-black uppercase tracking-tighter rounded-xl flex items-center justify-center min-h-[60px] leading-tight">
                  {category.name}
                </div>
              ))}
              
              {[0, 1, 2, 3, 4].map((qi) => (
                jeo.categories.map((category, ci) => {
                  const question = category.questions[qi];
                  return (
                    <button
                      key={`q-${ci}-${qi}`}
                      className={`aspect-square rounded-xl flex items-center justify-center text-lg font-black italic transition-all shadow-md ${
                        question.revealed
                          ? question.discarded
                            ? "bg-red-950/30 text-red-500 border border-red-900/50 opacity-60"
                            : "bg-zinc-950 text-zinc-800 border border-zinc-900 scale-95 opacity-50"
                          : "bg-blue-600 border-2 border-blue-400 text-white hover:bg-blue-500 hover:scale-105 active:scale-90 shadow-lg"
                      }`}
                      onClick={() => !question.revealed && handleSelectQuestion(ci, qi)}
                      disabled={question.revealed}
                    >
                      {question.revealed ? (question.discarded ? "✕" : "✓") : question.points}
                    </button>
                  );
                })
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* End Game Button */}
      {allQuestionsAnswered && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-md border-t border-zinc-800 z-50">
          <Button
            size="lg"
            className="w-full h-14 bg-white text-black hover:bg-zinc-200 text-lg font-black uppercase italic shadow-xl rounded-2xl"
            onClick={handleShowLeaderboard}
          >
            Zum Finale →
          </Button>
        </div>
      )}
    </div>
  );
}
