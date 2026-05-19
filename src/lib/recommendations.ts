import { getCurrentTerm, getTermForDate, type Interest } from "@/lib/constants";
import {
  getAcceptedFriendProfiles,
  getUserInterests,
  getUserTimetableBlocksForTerms,
  getViewerContext,
} from "@/lib/data";
import { fetchRubricEvents, type RubricEvent } from "@/lib/rubric-events";
import { computeSharedFreeSlotsForDateRange, eventFitsFreeSlot } from "@/lib/timetable";
import type { FreeTimeSlot, Profile, TimetableBlock } from "@/lib/types";

const INTEREST_KEYWORDS: Record<Interest, string[]> = {
  sports: ["sport", "competition", "tennis", "golf", "cycling", "ride", "quadball", "horse", "archery"],
  mahjong: ["mahjong"],
  chess: ["chess"],
  animals: ["animal", "wildlife", "pet", "dog", "cat", "vet"],
  music: ["music", "band", "concert", "choir", "song", "performance"],
  art: ["art", "paint", "draw", "creative", "design", "gallery"],
  food: ["food", "bbq", "pizza", "dinner", "donut", "lunch"],
  gaming: ["game", "gaming", "anime", "animation", "esports"],
  career: ["career", "industry", "network", "information night", "internship", "hospital"],
  culture: ["culture", "cultural", "international", "language", "society"],
  volunteering: ["volunteer", "charity", "community", "social impact"],
  dance: ["dance", "show", "performance", "medshow"],
};

export type EventRecommendation = RubricEvent & {
  matchedInterests: Interest[];
};

type RecommendationsData = {
  currentTerm: ReturnType<typeof getCurrentTerm>;
  friends: Profile[];
  selectedFriends: Profile[];
  selectedFriendIds: string[];
  participantCount: number;
  sharedInterests: Interest[];
  sharedFreeSlots: FreeTimeSlot[];
  calendarBlocks: TimetableBlock[];
  recommendations: EventRecommendation[];
  setupWarnings: string[];
};

function getEventText(event: RubricEvent) {
  return [
    event.title,
    event.clubName,
    event.category,
    event.description,
    event.location,
  ]
    .join(" ")
    .toLowerCase();
}

function getMatchedInterests(event: RubricEvent, interests: Interest[]) {
  const eventText = getEventText(event);
  return interests.filter((interest) =>
    INTEREST_KEYWORDS[interest].some((keyword) => eventText.includes(keyword)),
  );
}

function intersectInterests(interestGroups: Interest[][]) {
  if (!interestGroups.length) return [];

  return interestGroups
    .slice(1)
    .reduce(
      (common, group) => common.filter((interest) => group.includes(interest)),
      interestGroups[0],
    );
}

function eventToCalendarBlock(event: RubricEvent, userId: string, fallbackTerm: ReturnType<typeof getCurrentTerm>): TimetableBlock | null {
  if (!event.startsAt) return null;

  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return null;

  return {
    id: `rubric-${event.id}`,
    user_id: userId,
    term: event.startsAt ? getTermForDate(start) : fallbackTerm,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    day_of_week: start.getDay() === 0 ? 7 : start.getDay(),
    start_minutes: start.getHours() * 60 + start.getMinutes(),
    end_minutes: end.getHours() * 60 + end.getMinutes(),
    label: event.title,
    location: event.location,
    source_type: "auto_reference",
  };
}

export async function getEventRecommendationsData(selectedFriendIds: string[]): Promise<RecommendationsData> {
  const currentTerm = getCurrentTerm();
  const { user } = await getViewerContext();
  const friends = await getAcceptedFriendProfiles();
  const acceptedFriendIds = new Set(friends.map((friend) => friend.id));
  const cleanFriendIds = [...new Set(selectedFriendIds)].filter((id) => acceptedFriendIds.has(id));
  const selectedFriends = friends.filter((friend) => cleanFriendIds.includes(friend.id));
  const participantIds = [user!.id, ...cleanFriendIds];

  const [interestGroups, timetableBlockGroups] = await Promise.all([
    Promise.all(
      participantIds.map(async (participantId) =>
        (await getUserInterests(participantId)).map((row) => row.interest),
      ),
    ),
    Promise.all(participantIds.map((participantId) => getUserTimetableBlocksForTerms(participantId))),
  ]);

  const sharedInterests = intersectInterests(interestGroups);
  const interestUnion = [...new Set(interestGroups.flat())];
  const preferredInterests = sharedInterests.length ? sharedInterests : interestUnion;
  const events = await fetchRubricEvents({ limit: 24 });
  const now = new Date();
  const latestEventDate = events.reduce((latest, event) => {
    const eventDate = event.endsAt ?? event.startsAt;
    if (!eventDate) return latest;
    const parsed = new Date(eventDate);
    return Number.isNaN(parsed.getTime()) || parsed <= latest ? latest : parsed;
  }, new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90));
  const sharedFreeSlots = computeSharedFreeSlotsForDateRange({
    blockGroups: timetableBlockGroups,
    startDate: now,
    endDate: latestEventDate,
  });

  const recommendations = events
    .map((event) => ({
      ...event,
      matchedInterests: getMatchedInterests(event, preferredInterests),
    }))
    .filter((event) => eventFitsFreeSlot({ startsAt: event.startsAt, endsAt: event.endsAt, slots: sharedFreeSlots }))
    .sort((left, right) => {
      if (left.matchedInterests.length !== right.matchedInterests.length) {
        return right.matchedInterests.length - left.matchedInterests.length;
      }

      return new Date(left.startsAt ?? 0).getTime() - new Date(right.startsAt ?? 0).getTime();
    })
    .slice(0, 12);
  const calendarBlocks = [
    ...timetableBlockGroups.flat(),
    ...recommendations
      .map((event) => eventToCalendarBlock(event, user!.id, currentTerm))
      .filter((block): block is TimetableBlock => Boolean(block)),
  ];

  const setupWarnings = [];
  if (!interestGroups[0]?.length) {
    setupWarnings.push("Add your interests in Settings to personalise event matches.");
  }
  if (!timetableBlockGroups[0]?.length) {
    setupWarnings.push("Add your timetable in Settings so free-time detection is accurate.");
  }
  if (cleanFriendIds.length && !sharedInterests.length) {
    setupWarnings.push("This group does not have overlapping interests saved yet, so recommendations are based on free time only.");
  }

  return {
    currentTerm,
    friends,
    selectedFriends,
    selectedFriendIds: cleanFriendIds,
    participantCount: participantIds.length,
    sharedInterests,
    sharedFreeSlots,
    calendarBlocks,
    recommendations,
    setupWarnings,
  };
}
