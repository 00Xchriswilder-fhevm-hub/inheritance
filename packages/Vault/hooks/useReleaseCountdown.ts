import { useEffect, useState } from 'react';
import { getReleaseCountdown, type ReleaseCountdown } from '../utils/releaseTime';

export function useReleaseCountdown(releaseTimeMs: number | null | undefined): ReleaseCountdown | null {
  const [countdown, setCountdown] = useState<ReleaseCountdown | null>(() =>
    releaseTimeMs != null ? getReleaseCountdown(releaseTimeMs) : null
  );

  useEffect(() => {
    if (releaseTimeMs == null) {
      setCountdown(null);
      return;
    }

    const tick = () => setCountdown(getReleaseCountdown(releaseTimeMs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [releaseTimeMs]);

  return countdown;
}
