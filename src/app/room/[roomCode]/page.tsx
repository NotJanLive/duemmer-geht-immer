"use client";

import { useParams, useRouter } from "next/navigation";
import { useRoom } from "@/lib/useRoom";
import { useRoomStore } from "@/lib/store";
import { Button, Panel, Spinner } from "@/components/ui";
import { TopBar } from "@/components/room/Shell";
import Lobby from "@/components/modes/Lobby";
import LastManStanding from "@/components/modes/LastManStanding";
import Millionaire from "@/components/modes/Millionaire";
import HigherLower from "@/components/modes/HigherLower";
import Jeopardy from "@/components/modes/Jeopardy";
import Leaderboard from "@/components/modes/Leaderboard";
import Finale from "@/components/modes/Finale";

const SCREENS = {
  lobby: Lobby,
  lastManStanding: LastManStanding,
  millionaire: Millionaire,
  higherLower: HigherLower,
  jeopardy: Jeopardy,
  leaderboard: Leaderboard,
  finale: Finale,
};

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const code = roomCode.toUpperCase();
  const router = useRouter();
  useRoom(code);

  const screen = useRoomStore((s) => s.state?.screen);
  const closedMessage = useRoomStore((s) => s.closedMessage);

  if (closedMessage) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <Panel className="w-full max-w-sm animate-pop p-6 text-center">
          <p className="text-lg font-semibold">{closedMessage}</p>
          <Button className="mt-5 w-full" onClick={() => router.replace("/")}>
            Zur Startseite
          </Button>
        </Panel>
      </main>
    );
  }

  if (!screen) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="flex items-center gap-3 text-muted">
          <Spinner /> Verbinde mit Raum {code} …
        </div>
      </main>
    );
  }

  const Screen = SCREENS[screen];
  return (
    <div className="min-h-dvh">
      <TopBar />
      <main key={screen} className="animate-fade">
        <Screen />
      </main>
    </div>
  );
}
