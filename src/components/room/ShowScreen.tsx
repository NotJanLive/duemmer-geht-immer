"use client";

import { useRoomStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/room/Shell";
import { CamRow } from "@/components/room/Cams";
import { useShowSounds } from "@/lib/useShowSounds";
import Lobby from "@/components/modes/Lobby";
import Draw from "@/components/modes/Draw";
import LastManStanding from "@/components/modes/LastManStanding";
import Millionaire from "@/components/modes/Millionaire";
import HigherLower from "@/components/modes/HigherLower";
import Geo from "@/components/modes/Geo";
import Pictures from "@/components/modes/Pictures";
import Songs from "@/components/modes/Songs";
import Jeopardy from "@/components/modes/Jeopardy";
import Leaderboard from "@/components/modes/Leaderboard";
import Finale from "@/components/modes/Finale";

const SCREENS = {
  lobby: Lobby,
  draw: Draw,
  lastManStanding: LastManStanding,
  millionaire: Millionaire,
  higherLower: HigherLower,
  geo: Geo,
  pictures: Pictures,
  songs: Songs,
  jeopardy: Jeopardy,
  leaderboard: Leaderboard,
  finale: Finale,
};

// One screen for host, players and the OBS overlay: top bar, the stage, the
// cam strip, and the host's action bar. The cams live outside the keyed stage
// so a mode change never reconnects them.
export function ShowScreen({ overlay = false }: { overlay?: boolean }) {
  const screen = useRoomStore((s) => s.state!.screen);
  useShowSounds();
  const Screen = SCREENS[screen];

  return (
    <div className={cn("flex flex-col", overlay ? "h-dvh overflow-hidden" : "h-dvh")}>
      <TopBar overlay={overlay} />
      <main key={screen} className="min-h-0 flex-1 animate-fade overflow-y-auto">
        <Screen />
      </main>
      {/* Host buttons sit above the cams, the cam row is only for cams. */}
      <div id="host-actions" className="shrink-0 border-t border-line bg-black/90 empty:hidden" />
      <CamRow overlay={overlay} />
    </div>
  );
}
