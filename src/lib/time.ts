/** Wall-clock parts of an instant in a time zone. Throws on a zone this runtime doesn't know. */
function partsIn(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Minutes the zone is ahead of UTC at that instant (New York in winter: -300). */
function offsetMinutes(timeZone: string, at: Date): number {
  const p = partsIn(timeZone, at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/**
 * The first instant of `now`'s calendar day in the restaurant's zone (rule A7), for
 * "Done today". Never throws: a zone this runtime doesn't know falls back to UTC midnight,
 * like the kitchen clock, so the board still renders.
 */
export function startOfDayIn(timeZone: string, now: Date): Date {
  try {
    const { year, month, day } = partsIn(timeZone, now);
    const midnightAsUtc = Date.UTC(year, month - 1, day);
    // Two passes: the offset at a guess, then at the corrected instant (DST days differ).
    const first = new Date(
      midnightAsUtc - offsetMinutes(timeZone, new Date(midnightAsUtc)) * 60_000,
    );
    const second = new Date(midnightAsUtc - offsetMinutes(timeZone, first) * 60_000);
    // Where clocks skip midnight (Santiago in September), the second pass lands on the
    // previous evening; the first is then the day's first instant (01:00).
    return partsIn(timeZone, second).day === day ? second : first;
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}

/** "7:42 PM" in the restaurant's zone; the ISO time in UTC if the zone is unknown. */
export function formatTimeIn(timeZone: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(at);
  } catch {
    return `${at.toISOString().slice(11, 16)} UTC`;
  }
}
