"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useShow } from "@/lib/useShow";
import { useRoomStore } from "@/lib/store";
import { ShowScreen } from "@/components/room/ShowScreen";

// OBS browser source (1920x1080). Same view as the players, without own cam,
// and it waits for the next show by itself.
function Overlay({ overlayKey }: { overlayKey: string }) {
  useShow({ overlayKey });
  const screen = useRoomStore((s) => s.state?.screen);
  const closed = useRoomStore((s) => s.closedMessage);

  if (!screen) {
    return (
      <main className="grid h-dvh place-items-center">
        <div className="text-center">
          <h1 className="headline title-text text-7xl">Dümmer geht immer</h1>
          <p className="label mt-6">{closed ?? "Gleich geht's los"}</p>
        </div>
      </main>
    );
  }
  return <ShowScreen overlay />;
}

function OverlayPage() {
  const key = useSearchParams().get("key") ?? "";
  return <Overlay overlayKey={key} />;
}

export default function Page() {
  return (
    <Suspense>
      <OverlayPage />
    </Suspense>
  );
}
