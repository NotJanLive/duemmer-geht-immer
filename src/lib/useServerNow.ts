import { useEffect, useState } from 'react';
import { useRoomStore } from './store';

// Server time, ticking while `active`. Timers count against the server clock so
// every device shows the same.
export function useServerNow(active: boolean, interval = 250): number {
  const offset = useRoomStore((s) => s.clockOffset);
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [active, offset, interval]);
  return now;
}
