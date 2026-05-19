import { WEEK_DAYS, getTermForDate, type Term } from "@/lib/constants";
import type { FreeTimeSlot, TimetableBlock } from "@/lib/types";

const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const MIN_FREE_SLOT = 60;
const MAX_IMPORT_EVENTS = 700;

type ParsedIcsEvent = {
  summary: string;
  location: string | null;
  start: Date;
  end: Date;
};

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export function parseTimeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function getDayLabel(dayOfWeek: number, compact = false) {
  return (
    WEEK_DAYS.find((day) => day.value === dayOfWeek)?.[compact ? "short" : "label"] ??
    "Unknown"
  );
}

function unfoldIcs(value: string) {
  return value.replace(/\r?\n[ \t]/g, "");
}

function getIcsValue(block: string, key: string) {
  const line = block
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${key}:`) || candidate.startsWith(`${key};`));
  if (!line) return "";

  return line.slice(line.indexOf(":") + 1).replace(/\\,/g, ",").replace(/\\n/g, "\n").trim();
}

function parseIcsDate(value: string) {
  const normalized = value.trim();
  const match = normalized.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/,
  );
  if (!match) return null;

  const [, year, month, day, hour = "00", minute = "00", second = "00", utc] = match;
  const args = [
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ] as const;

  return utc ? new Date(Date.UTC(...args)) : new Date(...args);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isImportableEvent(event: ParsedIcsEvent, now = new Date()) {
  const earliest = new Date(now.getFullYear(), 0, 1);
  const latest = new Date(now);
  latest.setFullYear(latest.getFullYear() + 2);

  return event.end >= earliest && event.start <= latest;
}

export function parseCalendarEvents(icsText: string): ParsedIcsEvent[] {
  const unfolded = unfoldIcs(icsText);
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

  return blocks
    .map((block) => {
      const start = parseIcsDate(getIcsValue(block, "DTSTART"));
      const end = parseIcsDate(getIcsValue(block, "DTEND"));
      if (!start || !end || start >= end) return null;

      return {
        summary: getIcsValue(block, "SUMMARY") || "Calendar busy time",
        location: getIcsValue(block, "LOCATION") || null,
        start,
        end,
      };
    })
    .filter((event): event is ParsedIcsEvent => Boolean(event));
}

function replaceCalendarProtocol(calendarUrl: string, protocol: "http" | "https") {
  const parsed = new URL(calendarUrl);
  return `${protocol}://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function normalizeCalendarFetchUrl(calendarUrl: string) {
  const parsed = new URL(calendarUrl);

  if (parsed.protocol === "webcal:" || parsed.protocol === "webcals:" || parsed.protocol === "icals:") {
    return replaceCalendarProtocol(calendarUrl, "https");
  }

  if (parsed.protocol === "ical:") {
    return replaceCalendarProtocol(calendarUrl, "http");
  }

  return parsed.toString();
}

function buildCalendarFetchUrls(calendarUrl: string) {
  const parsed = new URL(calendarUrl);
  const urls = new Set<string>();

  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    urls.add(parsed.toString());
  }

  if (parsed.protocol === "webcal:" || parsed.protocol === "webcals:" || parsed.protocol === "icals:") {
    urls.add(replaceCalendarProtocol(calendarUrl, "https"));
    urls.add(replaceCalendarProtocol(calendarUrl, "http"));
  }

  if (parsed.protocol === "ical:") {
    urls.add(replaceCalendarProtocol(calendarUrl, "http"));
    urls.add(replaceCalendarProtocol(calendarUrl, "https"));
  }

  urls.add(normalizeCalendarFetchUrl(calendarUrl));
  return [...urls];
}

function looksLikeIcs(text: string) {
  return text.includes("BEGIN:VCALENDAR") && text.includes("BEGIN:VEVENT");
}

export async function fetchBlocksFromCalendarUrl({
  calendarUrl,
  userId,
}: {
  calendarUrl: string;
  term: Term;
  userId: string;
}): Promise<Omit<TimetableBlock, "id">[]> {
  let text = "";
  let lastError = "";

  for (const url of buildCalendarFetchUrls(calendarUrl)) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          accept: "text/calendar, text/plain, */*",
          "user-agent": "UNSW-Mates-calendar-import/1.0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        lastError = `Calendar feed responded with ${response.status}.`;
        continue;
      }

      text = await response.text();
      if (looksLikeIcs(text)) {
        break;
      }

      lastError = "Calendar feed did not return valid ICS data.";
      text = "";
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "TimeoutError"
          ? "Calendar feed took too long to respond."
          : error instanceof Error
            ? error.message
            : "Calendar feed request failed.";
    }
  }

  if (!text) {
    throw new Error(lastError || "Could not read that calendar link.");
  }

  const events = parseCalendarEvents(text).filter((event) => isImportableEvent(event));
  if (!events.length) {
    throw new Error("That calendar feed did not contain any current or upcoming importable events.");
  }

  const unique = new Map<string, Omit<TimetableBlock, "id">>();

  for (const event of events.slice(0, MAX_IMPORT_EVENTS)) {
    const firstDay = startOfDay(event.start);
    const lastDay = startOfDay(event.end);

    for (let cursor = firstDay; cursor <= lastDay; cursor = addCalendarDays(cursor, 1)) {
      const nextDay = addCalendarDays(cursor, 1);
      const segmentStart = event.start > cursor ? event.start : cursor;
      const segmentEnd = event.end < nextDay ? event.end : nextDay;
      const startMinutes = segmentStart.getHours() * 60 + segmentStart.getMinutes();
      const endMinutes =
        isSameDay(segmentEnd, nextDay) && segmentEnd.getHours() === 0 && segmentEnd.getMinutes() === 0
          ? 24 * 60
          : segmentEnd.getHours() * 60 + segmentEnd.getMinutes();

      if (startMinutes >= endMinutes) continue;

      const dayOfWeek = segmentStart.getDay() === 0 ? 7 : segmentStart.getDay();
      const block = {
        user_id: userId,
        term: getTermForDate(segmentStart),
        start_at: segmentStart.toISOString(),
        end_at: segmentEnd.toISOString(),
        day_of_week: dayOfWeek,
        start_minutes: startMinutes,
        end_minutes: endMinutes,
        label: event.summary.slice(0, 120),
        location: event.location?.slice(0, 160) ?? null,
        source_type: "calendar_url" as const,
      };

      unique.set(
        [block.start_at, block.end_at, block.label, block.location ?? ""].join(":"),
        block,
      );
    }
  }

  return [...unique.values()];
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getDayOfWeek(date: Date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function blockOccursOnDate(block: TimetableBlock, date: Date) {
  if (block.start_at) {
    const blockDate = new Date(block.start_at);
    return !Number.isNaN(blockDate.getTime()) && isSameDay(blockDate, date);
  }

  return block.day_of_week === getDayOfWeek(date);
}

function subtractBusyBlocksForDate(blocks: TimetableBlock[], date: Date) {
  const dayOfWeek = getDayOfWeek(date);
  const busyBlocks = blocks
    .filter((block) => blockOccursOnDate(block, date))
    .sort((left, right) => left.start_minutes - right.start_minutes);
  const freeSlots: FreeTimeSlot[] = [];
  let cursor = DAY_START;

  for (const block of busyBlocks) {
    const start = Math.max(DAY_START, block.start_minutes);
    const end = Math.min(DAY_END, block.end_minutes);
    if (start - cursor >= MIN_FREE_SLOT) {
      freeSlots.push({
        date: formatDateKey(date),
        dayOfWeek,
        startMinutes: cursor,
        endMinutes: start,
      });
    }
    cursor = Math.max(cursor, end);
  }

  if (DAY_END - cursor >= MIN_FREE_SLOT) {
    freeSlots.push({
      date: formatDateKey(date),
      dayOfWeek,
      startMinutes: cursor,
      endMinutes: DAY_END,
    });
  }

  return freeSlots;
}

function subtractBusyBlocks(blocks: TimetableBlock[]) {
  const freeByDay = new Map<number, FreeTimeSlot[]>();

  for (const day of WEEK_DAYS) {
    const busyBlocks = blocks
      .filter((block) => block.day_of_week === day.value)
      .sort((left, right) => left.start_minutes - right.start_minutes);
    const freeSlots: FreeTimeSlot[] = [];
    let cursor = DAY_START;

    for (const block of busyBlocks) {
      const start = Math.max(DAY_START, block.start_minutes);
      const end = Math.min(DAY_END, block.end_minutes);
      if (start - cursor >= MIN_FREE_SLOT) {
        freeSlots.push({ dayOfWeek: day.value, startMinutes: cursor, endMinutes: start });
      }
      cursor = Math.max(cursor, end);
    }

    if (DAY_END - cursor >= MIN_FREE_SLOT) {
      freeSlots.push({ dayOfWeek: day.value, startMinutes: cursor, endMinutes: DAY_END });
    }

    freeByDay.set(day.value, freeSlots);
  }

  return freeByDay;
}

function intersectSlotSets(left: FreeTimeSlot[], right: FreeTimeSlot[]) {
  const intersections: FreeTimeSlot[] = [];

  for (const leftSlot of left) {
    for (const rightSlot of right) {
      const startMinutes = Math.max(leftSlot.startMinutes, rightSlot.startMinutes);
      const endMinutes = Math.min(leftSlot.endMinutes, rightSlot.endMinutes);

      if (endMinutes - startMinutes >= MIN_FREE_SLOT) {
        intersections.push({
          date: leftSlot.date ?? rightSlot.date,
          dayOfWeek: leftSlot.dayOfWeek,
          startMinutes,
          endMinutes,
        });
      }
    }
  }

  return intersections;
}

export function computeSharedFreeSlots(blockGroups: TimetableBlock[][]) {
  const availabilityByUser = blockGroups.map(subtractBusyBlocks);
  const sharedSlots: FreeTimeSlot[] = [];

  for (const day of WEEK_DAYS) {
    let daySlots = availabilityByUser[0]?.get(day.value) ?? [];

    for (const userAvailability of availabilityByUser.slice(1)) {
      daySlots = intersectSlotSets(daySlots, userAvailability.get(day.value) ?? []);
    }

    sharedSlots.push(...daySlots);
  }

  return sharedSlots;
}

export function computeSharedFreeSlotsForDateRange({
  blockGroups,
  startDate,
  endDate,
}: {
  blockGroups: TimetableBlock[][];
  startDate: Date;
  endDate: Date;
}) {
  const sharedSlots: FreeTimeSlot[] = [];
  const cursor = startOfDay(startDate);
  const lastDate = startOfDay(endDate);

  while (cursor <= lastDate) {
    const dayAvailability = blockGroups.map((blocks) => subtractBusyBlocksForDate(blocks, cursor));
    let daySlots = dayAvailability[0] ?? [];

    for (const participantAvailability of dayAvailability.slice(1)) {
      daySlots = intersectSlotSets(daySlots, participantAvailability);
    }

    sharedSlots.push(...daySlots);
    cursor.setDate(cursor.getDate() + 1);
  }

  return sharedSlots;
}

export function eventFitsFreeSlot({
  startsAt,
  endsAt,
  slots,
}: {
  startsAt: string | null;
  endsAt?: string | null;
  slots: FreeTimeSlot[];
}) {
  if (!startsAt) return false;

  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const dayOfWeek = start.getDay() === 0 ? 7 : start.getDay();
  const date = formatDateKey(start);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();

  return slots.some(
    (slot) =>
      (!slot.date || slot.date === date) &&
      slot.dayOfWeek === dayOfWeek &&
      startMinutes >= slot.startMinutes &&
      endMinutes <= slot.endMinutes,
  );
}
