"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useShow } from "@/lib/useShow";
import { useRoomStore } from "@/lib/store";
import { Button, Panel, Spinner } from "@/components/ui";
import { ShowScreen } from "@/components/room/ShowScreen";

function ShowPage() {
  const params = useSearchParams();
  const router = useRouter();
  useShow({ join: params.get("join") === "1" });

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
          <Spinner /> Verbinde mit der Show …
        </div>
      </main>
    );
  }

  return <ShowScreen />;
}

export default function Page() {
  return (
    <Suspense>
      <ShowPage />
    </Suspense>
  );
}
