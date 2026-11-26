const TZ = "Asia/Colombo";

/**
 * Format a Date (or ISO string) as "hh:mm AM/PM" in Sri Lanka time.
 * Defaults to "now" when no argument is given.
 *
 * @example
 *   formatAmPm();                          // "10:45 PM"
 *   formatAmPm("2026-11-14T14:05:00Z");    // "07:35 PM" (UTC+5:30)
 *   formatAmPm(new Date(), { seconds: true }); // "10:45:12 PM"
 */
export function formatAmPm(
  input: Date | string | number = new Date(),
  opts: { seconds?: boolean } = {},
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    ...(opts.seconds ? { second: "2-digit" } : {}),
    hour12: true,
  }).format(date);
}

/** "06:00" → "06:00 AM", "13:30" → "01:30 PM". Safe on bad input. */
export function hhmmToAmPm(hhmm: string | undefined | null): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return String(hhmm);
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${min} ${ampm}`;
}
