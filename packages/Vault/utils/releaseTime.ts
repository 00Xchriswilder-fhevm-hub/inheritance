export type ReleaseCountdown = {
  days: string;
  hours: string;
  min: string;
  sec: string;
  totalMinutes: number;
  isPast: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Build YYYY-MM-DD from UTC calendar parts (month is 0-based). */
export function utcDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** Parse YYYY-MM-DD + HH:mm as UTC (not local time). */
export function parseUtcReleaseDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

export function formatUtcTimeInput(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function formatReleaseDateTime(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

export function formatReleaseDateUtc(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatReleaseTimeUtc(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

export function getUtcTodayParts(): { year: number; month: number; day: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth(), day: now.getUTCDate() };
}

export function isUtcDateBeforeToday(year: number, month: number, day: number): boolean {
  const today = getUtcTodayParts();
  if (year < today.year) return true;
  if (year === today.year && month < today.month) return true;
  if (year === today.year && month === today.month && day < today.day) return true;
  return false;
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
