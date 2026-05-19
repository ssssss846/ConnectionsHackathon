const RUBRIC_API_URL = "https://api.hellorubric.com";
const RUBRIC_EVENT_DETAILS_ENDPOINT =
  "https://appserver.getqpay.com:9090/AppServerSwapnil/event/details";
const RUBRIC_CAMPUS_URL = "https://campus.hellorubric.com";
const UNSW_UNIVERSITY_ID = "5";
const RUBRIC_EVENTS_CACHE_MS = 5 * 60 * 1000;

type RubricSearchResult = {
  sortindex?: unknown;
  image?: unknown;
  subtitle?: unknown;
  societyid?: unknown;
  destination?: unknown;
  societyname?: unknown;
  societylogo?: unknown;
  title?: unknown;
  info?: unknown;
};

type RubricEventDetails = {
  eventName?: unknown;
  eventTime?: unknown;
  eventEndTime?: unknown;
  eventAddress?: unknown;
  eventURL?: unknown;
  eventDescription?: unknown;
  bannerImageURL?: unknown;
};

export type RubricEvent = {
  id: string;
  title: string;
  clubName: string;
  category: string;
  price: string;
  startsAt: string | null;
  endsAt: string | null;
  timeLabel: string;
  location: string;
  description: string;
  imageUrl: string;
  clubLogoUrl: string;
  url: string;
};

type FetchRubricEventsOptions = {
  query?: string;
  period?: "All" | "today" | "week" | "month";
  limit?: number;
};

const rubricEventsCache = new Map<string, { expiresAt: number; events: RubricEvent[] }>();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getEventId(destination: string) {
  const match = destination.match(/[?&]eid=(\d+)/);
  return match?.[1] ?? null;
}

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseRubricDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

async function callRubric(endpoint: string, details: Record<string, unknown>) {
  const currentUrl =
    typeof details.currentUrl === "string"
      ? details.currentUrl
      : `${RUBRIC_CAMPUS_URL}/search?type=events&country=AU&state=New%20South%20Wales&universityid=${UNSW_UNIVERSITY_ID}`;

  const body = new URLSearchParams();
  body.set("endpoint", endpoint);
  body.set(
    "details",
    JSON.stringify({
      ...details,
      currentUrl,
      device: "web_portal",
      version: 4,
    }),
  );

  const response = await fetch(RUBRIC_API_URL, {
    method: "POST",
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Rubric request failed with ${response.status}`);
  }

  return asRecord(await response.json());
}

async function fetchRubricEventDetails(eventId: string) {
  try {
    const data = await callRubric(RUBRIC_EVENT_DETAILS_ENDPOINT, {
      eventId,
      currentUrl: `${RUBRIC_CAMPUS_URL}/?eid=${eventId}`,
    });

    if (data.success !== true) return null;
    return asRecord(data.eventDetails) as RubricEventDetails;
  } catch {
    return null;
  }
}

function normalizeEvent(summary: RubricSearchResult, details: RubricEventDetails | null): RubricEvent | null {
  const destination = asString(summary.destination);
  const id = getEventId(destination);
  if (!id) return null;

  const sortIndex = asNumber(summary.sortindex);
  const startsAt = sortIndex ? new Date(sortIndex * 1000).toISOString() : null;
  const eventTime = asString(details?.eventTime);
  const eventEndTime = asString(details?.eventEndTime);
  const description = htmlToText(asString(details?.eventDescription));

  return {
    id,
    title: asString(details?.eventName, asString(summary.title, "Untitled event")),
    clubName: asString(summary.societyname, "UNSW club"),
    category: asString(summary.subtitle, "Event"),
    price: asString(summary.info, "See Rubric"),
    startsAt: parseRubricDate(eventTime) ?? startsAt,
    endsAt: parseRubricDate(eventEndTime),
    timeLabel: eventEndTime ? `${eventTime} - ${eventEndTime}` : eventTime,
    location: asString(details?.eventAddress, "See Rubric for location"),
    description,
    imageUrl: asString(details?.bannerImageURL, asString(summary.image)),
    clubLogoUrl: asString(summary.societylogo),
    url: asString(details?.eventURL, `${RUBRIC_CAMPUS_URL}${destination}`),
  };
}

export async function fetchRubricEvents({
  query = "",
  period = "All",
  limit = 12,
}: FetchRubricEventsOptions = {}) {
  const cacheKey = JSON.stringify({ query, period, limit });
  const cached = rubricEventsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.events;
  }

  const data = await callRubric("getUnifiedSearch", {
    firstCall: true,
    sortType: "date",
    desiredType: "events",
    limit,
    offset: 0,
    sortDirection: "asc",
    searchQuery: query,
    eventsPeriodFilter: period,
    countryCode: "AU",
    state: "New South Wales",
    selectedUniversityId: UNSW_UNIVERSITY_ID,
  });

  if (data.success !== true || !Array.isArray(data.results)) {
    rubricEventsCache.set(cacheKey, { expiresAt: Date.now() + RUBRIC_EVENTS_CACHE_MS, events: [] });
    return [];
  }

  const summaries = data.results.map((item) => asRecord(item) as RubricSearchResult);
  const details = await Promise.all(
    summaries.map((summary) => {
      const id = getEventId(asString(summary.destination));
      return id ? fetchRubricEventDetails(id) : Promise.resolve(null);
    }),
  );

  const events = summaries
    .map((summary, index) => normalizeEvent(summary, details[index] ?? null))
    .filter((event): event is RubricEvent => Boolean(event));

  rubricEventsCache.set(cacheKey, { expiresAt: Date.now() + RUBRIC_EVENTS_CACHE_MS, events });
  return events;
}
