import { WEEK_DAYS, getTermForDate, type Term } from "@/lib/constants";
import type { FreeTimeSlot, TimetableBlock } from "@/lib/types";

const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const MIN_FREE_SLOT = 60;
const MAX_IMPORT_EVENTS = 700;
const DEFAULT_CALENDAR_TIME_ZONE = "Australia/Sydney";

type IcsProperty = {
  params: Record<string, string>;
  value: string;
};

type WallDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type ParsedIcsDate = {
  date: Date;
  wall: WallDateTime;
  timeZone: string | null;
  isUtc: boolean;
};

type ParsedIcsEvent = {
  summary: string;
  location: string | null;
  start: Date;
  end: Date;
  startWall: WallDateTime;
  timeZone: string | null;
  isUtc: boolean;
  rrule: Record<string, string>;
  exdates: Date[];
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

function unescapeIcsText(value: string) {
  return value.replace(/\\,/g, ",").replace(/\\n/g, "\n").replace(/\\\\/g, "\\").trim();
}

function parseIcsLine(line: string, key: string): IcsProperty | null {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) return null;

  const head = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1);
  const [name, ...paramParts] = head.split(";");

  if (name.toUpperCase() !== key.toUpperCase()) return null;

  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const [paramKey, ...paramValueParts] = part.split("=");
    if (!paramKey || !paramValueParts.length) continue;
    params[paramKey.toUpperCase()] = paramValueParts.join("=").replace(/^"|"$/g, "");
  }

  return {
    params,
    value: unescapeIcsText(value),
  };
}

function getIcsProperties(block: string, key: string) {
  return block
    .split(/\r?\n/)
    .map((line) => parseIcsLine(line, key))
    .filter((property): property is IcsProperty => Boolean(property));
}

function getIcsValue(block: string, key: string) {
  return getIcsProperties(block, key)[0]?.value ?? "";
}

function getZonedParts(date: Date, timeZone: string): WallDateTime {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  const utcFromParts = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return utcFromParts - date.getTime();
}

function zonedWallTimeToDate(wall: WallDateTime, timeZone: string) {
  const utcGuess = new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second));
  const firstOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstDate = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(firstDate, timeZone);

  return new Date(utcGuess.getTime() - secondOffset);
}

function wallTimeToDate(wall: WallDateTime, timeZone: string | null, isUtc: boolean) {
  if (isUtc) {
    return new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second));
  }

  return zonedWallTimeToDate(wall, timeZone ?? DEFAULT_CALENDAR_TIME_ZONE);
}

function parseIcsDateProperty(property: IcsProperty | undefined): ParsedIcsDate | null {
  if (!property) return null;

  const value = property.value;
  const normalized = value.trim();
  const match = normalized.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/,
  );
  if (!match) return null;

  const [, year, month, day, hour = "00", minute = "00", second = "00", utc] = match;
  const wallDateTime: WallDateTime = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const timeZone = utc ? null : property.params.TZID || DEFAULT_CALENDAR_TIME_ZONE;

  return {
    date: wallTimeToDate(wallDateTime, timeZone, Boolean(utc)),
    wall: wallDateTime,
    timeZone,
    isUtc: Boolean(utc),
  };
}

function parseRrule(value: string) {
  return Object.fromEntries(
    value
      .split(";")
      .map((part) => part.split("="))
      .filter(([key, ruleValue]) => key && ruleValue)
      .map(([key, ruleValue]) => [key.toUpperCase(), ruleValue]),
  );
}

const ICS_WEEKDAY_INDEX: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

function getWallDateKey(wall: Pick<WallDateTime, "year" | "month" | "day">) {
  return [
    wall.year,
    String(wall.month).padStart(2, "0"),
    String(wall.day).padStart(2, "0"),
  ].join("-");
}

function getWallDateTimeKey(wall: WallDateTime) {
  return [
    getWallDateKey(wall),
    String(wall.hour).padStart(2, "0"),
    String(wall.minute).padStart(2, "0"),
    String(wall.second).padStart(2, "0"),
  ].join(":");
}

function getWallDayOfWeek(wall: Pick<WallDateTime, "year" | "month" | "day">) {
  const day = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

function addWallDays(wall: WallDateTime, days: number): WallDateTime {
  const date = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days));
  return {
    ...wall,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addWallWeeks(wall: WallDateTime, weeks: number) {
  return addWallDays(wall, weeks * 7);
}

function parseByDays(value: string | undefined, fallbackDay: number) {
  if (!value) return [fallbackDay];

  const days = value
    .split(",")
    .map((entry) => entry.replace(/^[+-]?\d+/, "").toUpperCase())
    .map((entry) => ICS_WEEKDAY_INDEX[entry])
    .filter((day): day is number => Boolean(day));

  return days.length ? [...new Set(days)].sort((left, right) => left - right) : [fallbackDay];
}

function parseExdates(block: string, fallback: ParsedIcsDate) {
  return getIcsProperties(block, "EXDATE").flatMap((property) =>
    property.value
      .split(",")
      .map((value) => {
        const params = { ...property.params };
        if (!params.TZID && fallback.timeZone) {
          params.TZID = fallback.timeZone;
        }

        return parseIcsDateProperty({ params, value });
      })
      .filter((date): date is ParsedIcsDate => Boolean(date))
      .map((date) => date.date),
  );
}

function expandRecurringEvents(events: ParsedIcsEvent[], now = new Date()) {
  const latest = new Date(now);
  latest.setFullYear(latest.getFullYear() + 2);
  const expanded: ParsedIcsEvent[] = [];

  for (const event of events) {
    if (event.rrule.FREQ !== "WEEKLY") {
      expanded.push(event);
      continue;
    }

    const interval = Math.max(1, Number(event.rrule.INTERVAL) || 1);
    const count = event.rrule.COUNT ? Math.max(1, Number(event.rrule.COUNT) || 1) : null;
    const until = event.rrule.UNTIL
      ? parseIcsDateProperty({ params: {}, value: event.rrule.UNTIL })?.date
      : null;
    const durationMs = event.end.getTime() - event.start.getTime();
    const startDay = getWallDayOfWeek(event.startWall);
    const byDays = parseByDays(event.rrule.BYDAY, startDay);
    const weekStart = addWallDays(event.startWall, 1 - startDay);
    const exdateKeys = new Set(
      event.exdates.map((date) =>
        getWallDateTimeKey(event.isUtc ? getZonedParts(date, "UTC") : getZonedParts(date, event.timeZone ?? DEFAULT_CALENDAR_TIME_ZONE)),
      ),
    );
    let emitted = 0;

    for (let weekIndex = 0; weekIndex < 160 && (!count || emitted < count); weekIndex += interval) {
      const currentWeekStart = addWallWeeks(weekStart, weekIndex);

      for (const byDay of byDays) {
        const occurrenceWall = addWallDays(
          {
            ...currentWeekStart,
            hour: event.startWall.hour,
            minute: event.startWall.minute,
            second: event.startWall.second,
          },
          byDay - 1,
        );
        const start = wallTimeToDate(occurrenceWall, event.timeZone, event.isUtc);
        if (start < event.start) continue;
        if (until && start > until) continue;
        if (start > latest) continue;
        if (exdateKeys.has(getWallDateTimeKey(occurrenceWall))) continue;

        expanded.push({
          ...event,
          start,
          end: new Date(start.getTime() + durationMs),
          startWall: occurrenceWall,
          rrule: {},
          exdates: [],
        });
        emitted += 1;
        if (count && emitted >= count) break;
      }
    }
  }

  return expanded;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isImportableEvent(event: ParsedIcsEvent, now = new Date()) {
  const earliest = new Date(now.getFullYear(), 0, 1);
  const latest = new Date(now);
  latest.setFullYear(latest.getFullYear() + 2);

  return event.end >= earliest && event.start <= latest;
}

function compareWallDates(left: Pick<WallDateTime, "year" | "month" | "day">, right: Pick<WallDateTime, "year" | "month" | "day">) {
  return getWallDateKey(left).localeCompare(getWallDateKey(right));
}

function getEventEndWall(event: ParsedIcsEvent) {
  return event.isUtc
    ? getZonedParts(event.end, "UTC")
    : getZonedParts(event.end, event.timeZone ?? DEFAULT_CALENDAR_TIME_ZONE);
}

function buildBlocksForCalendarEvent(event: ParsedIcsEvent, userId: string): Omit<TimetableBlock, "id">[] {
  const blocks: Omit<TimetableBlock, "id">[] = [];
  const endWall = getEventEndWall(event);

  for (
    let cursor = { ...event.startWall, hour: 0, minute: 0, second: 0 };
    compareWallDates(cursor, endWall) <= 0;
    cursor = addWallDays(cursor, 1)
  ) {
    const isStartDate = getWallDateKey(cursor) === getWallDateKey(event.startWall);
    const isEndDate = getWallDateKey(cursor) === getWallDateKey(endWall);
    const segmentStartWall = isStartDate ? event.startWall : cursor;
    const segmentEndWall = isEndDate ? endWall : { ...addWallDays(cursor, 1), hour: 0, minute: 0, second: 0 };
    const startMinutes = segmentStartWall.hour * 60 + segmentStartWall.minute;
    const endMinutes =
      !isEndDate && segmentEndWall.hour === 0 && segmentEndWall.minute === 0
        ? 24 * 60
        : segmentEndWall.hour * 60 + segmentEndWall.minute;

    if (startMinutes >= endMinutes) continue;

    const segmentStart = isStartDate
      ? event.start
      : wallTimeToDate(segmentStartWall, event.timeZone, event.isUtc);
    const segmentEnd = isEndDate
      ? event.end
      : wallTimeToDate(segmentEndWall, event.timeZone, event.isUtc);
    const dayOfWeek = getWallDayOfWeek(segmentStartWall);

    blocks.push({
      user_id: userId,
      term: getTermForDate(new Date(segmentStartWall.year, segmentStartWall.month - 1, segmentStartWall.day)),
      start_at: segmentStart.toISOString(),
      end_at: segmentEnd.toISOString(),
      day_of_week: dayOfWeek,
      start_minutes: startMinutes,
      end_minutes: endMinutes,
      label: event.summary.slice(0, 120),
      location: event.location?.slice(0, 160) ?? null,
      source_type: "calendar_url" as const,
    });
  }

  return blocks;
}

export function parseCalendarEvents(icsText: string): ParsedIcsEvent[] {
  const unfolded = unfoldIcs(icsText);
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

  return blocks
    .map((block) => {
      const start = parseIcsDateProperty(getIcsProperties(block, "DTSTART")[0]);
      const end = parseIcsDateProperty(getIcsProperties(block, "DTEND")[0]);
      if (!start || !end || start.date >= end.date) return null;

      return {
        summary: getIcsValue(block, "SUMMARY") || "Calendar busy time",
        location: getIcsValue(block, "LOCATION") || null,
        start: start.date,
        end: end.date,
        startWall: start.wall,
        timeZone: start.timeZone,
        isUtc: start.isUtc,
        rrule: parseRrule(getIcsValue(block, "RRULE")),
        exdates: parseExdates(block, start),
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

  const events = expandRecurringEvents(parseCalendarEvents(text))
    .filter((event) => isImportableEvent(event))
    .slice(0, MAX_IMPORT_EVENTS);
  if (!events.length) {
    throw new Error("That calendar feed did not contain any current or upcoming importable events.");
  }

  const unique = new Map<string, Omit<TimetableBlock, "id">>();

  for (const event of events) {
    for (const block of buildBlocksForCalendarEvent(event, userId)) {
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
