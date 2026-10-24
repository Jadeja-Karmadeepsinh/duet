/**
 * Returns formatted date string in Asia/Kolkata timezone.
 * Example output: "Saturday, 24 October 2026" or "Sat, 24 Oct"
 */
export function formatIndiaDate(date: Date = new Date(), options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat('en-IN', defaultOptions).format(date);
}

export function formatIndiaTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Formats duration in seconds for timer displays.
 * Format: MM:SS (if < 1 hour) or HH:MM:SS (if >= 1 hour).
 * Total hours are calculated with Math.floor(totalSeconds / 3600) with no 24-hour wrap.
 * Hours do not truncate at 99 hours.
 * Negative, NaN, or non-positive values defensively format as "00:00".
 */
export function formatTimerDisplay(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds <= 0) {
    return "00:00";
  }
  const safeSec = Math.floor(totalSeconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;

  if (hrs > 0) {
    const paddedHrs = hrs < 10 ? `0${hrs}` : `${hrs}`;
    const paddedMins = mins.toString().padStart(2, "0");
    const paddedSecs = secs.toString().padStart(2, "0");
    return `${paddedHrs}:${paddedMins}:${paddedSecs}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

