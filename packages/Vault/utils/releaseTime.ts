export type ReleaseCountdown = {
  days: string;
  hours: string;
  min: string;
  sec: string;
  totalMinutes: number;
  isPast: boolean;
};

export function formatReleaseDateTime(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function getReleaseCountdown(releaseTimeMs: number, now = Date.now()): ReleaseCountdown {
  const distance = releaseTimeMs - now;
  if (distance <= 0) {
    return { days: '00', hours: '00', min: '00', sec: '00', totalMinutes: 0, isPast: true };
  }

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const min = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const sec = Math.floor((distance % (1000 * 60)) / 1000);

  return {
    days: days.toString().padStart(2, '0'),
    hours: hours.toString().padStart(2, '0'),
    min: min.toString().padStart(2, '0'),
    sec: sec.toString().padStart(2, '0'),
    totalMinutes: Math.ceil(distance / (1000 * 60)),
    isPast: false,
  };
}

/** Short label for the "Opens in" badge (e.g. "42 min", "2h 15m"). */
export function formatOpensInShort(countdown: ReleaseCountdown): string {
  if (countdown.isPast) return 'Now';

  const total = countdown.totalMinutes;
  if (total < 60) return `${total} min`;
  if (total < 60 * 24) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  const d = Math.floor(total / (60 * 24));
  const h = Math.floor((total % (60 * 24)) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}
