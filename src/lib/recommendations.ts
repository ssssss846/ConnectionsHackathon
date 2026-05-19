import { getCurrentTerm, type Interest } from "@/lib/constants";
import {
  getAcceptedFriendProfiles,
  getUserInterests,
  getUserTimetableBlocks,
  getViewerContext,
} from "@/lib/data";
import { fetchRubricEvents, type RubricEvent } from "@/lib/rubric-events";
import { computeSharedFreeSlots, eventFitsFreeSlot } from "@/lib/timetable";
import type { FreeTimeSlot, Profile } from "@/lib/types";

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
    Promise.all(participantIds.map((participantId) => getUserTimetableBlocks(participantId, currentTerm))),
  ]);

  const sharedInterests = intersectInterests(interestGroups);
  const sharedFreeSlots = computeSharedFreeSlots(timetableBlockGroups);
  const events = await fetchRubricEvents({ limit: 24 });

  const recommendations = events
    .map((event) => ({
      ...event,
      matchedInterests: getMatchedInterests(event, sharedInterests),
    }))
    .filter((event) => eventFitsFreeSlot({ startsAt: event.startsAt, endsAt: event.endsAt, slots: sharedFreeSlots }))
    .filter((event) => !sharedInterests.length || event.matchedInterests.length)
    .slice(0, 12);

  const setupWarnings = [];
  if (!interestGroups[0]?.length) {
    setupWarnings.push("Add your interests in Settings to personalise event matches.");
  }
  if (!timetableBlockGroups[0]?.length) {
    setupWarnings.push("Add your current-term timetable in Settings so free-time detection is accurate.");
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
    recommendations,
    setupWarnings,
  };
}
