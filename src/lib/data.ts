import { redirect } from "next/navigation";

import { getCurrentTerm, TERMS, orderFriendPair, type Term } from "@/lib/constants";
import { getCommonSubjects, groupSubjectsByTerm } from "@/lib/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPlannerClasses } from "@/lib/unsw-courses";
import type {
  FriendRequestRow,
  PlannerClassOption,
  FriendshipRow,
  PlannerChoice,
  PlannerSubjectGroup,
  Profile,
  PlanParticipant,
  SharedPlanRow,
  SharedFriendMarker,
  DegreeMutual,
  SubjectRow,
  SubjectSelection,
  SubjectsByTerm,
  TimetableBlock,
  TimetableSource,
  UserInterestRow,
  Viewer,
} from "@/lib/types";

const PROFILE_SELECT = "id, username, full_name, zid, unsw_email, degree, enrolled_year, enrolled_term, created_at";

function getEmailUsername(email: string | undefined) {
  return String(email ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.replace(/[^a-z0-9_]/g, "") || null;
}

function buildFallbackProfile(user: Viewer & { user_metadata?: Record<string, unknown> }): Profile | null {
  const metadata = user.user_metadata ?? {};
  const username =
    String(metadata.username ?? metadata.zid ?? "")
      .trim()
      .toLowerCase() ||
    getEmailUsername(user.email);

  if (!username) {
    return null;
  }

  const email = String(metadata.unsw_email ?? user.email ?? "")
    .trim()
    .toLowerCase();
  const fullName =
    String(metadata.full_name ?? "").trim() ||
    String(metadata.zid ?? "").trim() ||
    email ||
    username;

  return {
    id: user.id,
    username,
    full_name: fullName,
    zid: String(metadata.zid ?? "").trim().toLowerCase() || username,
    unsw_email: email || `${username}@unsw.edu.au`,
    degree: String(metadata.degree ?? "").trim() || null,
    enrolled_year: Number(metadata.enrolled_year) || null,
    enrolled_term: (String(metadata.enrolled_term ?? "").trim() || null) as Term | null,
  };
}

function normalizeRelatedProfile(value: unknown) {
  if (Array.isArray(value)) {
    return (value[0] ?? null) as Profile | null;
  }

  return (value ?? null) as Profile | null;
}

function getInitials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export async function getViewerContext(redirectOnMissing = true) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (redirectOnMissing) {
      redirect("/login");
    }

    return { supabase, user: null, profile: null };
  }

  const { data: initialProfile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single();
  let profile = (initialProfile ?? null) as Profile | null;

  if (!profile) {
    const fallbackProfile = buildFallbackProfile(user as Viewer & { user_metadata?: Record<string, unknown> });

    if (fallbackProfile) {
      const { data: repairedProfile } = await supabase
        .from("profiles")
        .upsert(fallbackProfile, { onConflict: "id" })
        .select(PROFILE_SELECT)
        .single();

      profile = (repairedProfile as Profile | null) ?? fallbackProfile;
    }
  }

  return {
    supabase,
    user: user as Viewer,
    profile: profile as Profile | null,
  };
}

export async function getUserSubjects(userId: string) {
  const { supabase } = await getViewerContext(false);
  const { data } = await supabase
    .from("user_term_subjects")
    .select("id, user_id, term, subject_code, subject_name")
    .eq("user_id", userId)
    .order("term")
    .order("subject_code");

  return (data ?? []) as SubjectRow[];
}

async function getAcceptedFriendsForUser(userId: string) {
  const { supabase } = await getViewerContext(false);
  const { data: friendshipRows } = await supabase
    .from("friendships")
    .select("id, user_a_id, user_b_id, created_at")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order("created_at", { ascending: true });

  const friendIds = (friendshipRows ?? []).map((row) =>
    row.user_a_id === userId ? row.user_b_id : row.user_a_id,
  );

  const { data: friends } = friendIds.length
    ? await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .in("id", friendIds)
        .order("full_name")
    : { data: [] };

  return {
    friendIds,
    friends: (friends ?? []) as Profile[],
    friendshipRows: (friendshipRows ?? []) as FriendshipRow[],
  };
}

export async function getDashboardData() {
  const { user, profile } = await getViewerContext();
  const subjects = await getUserSubjects(user!.id);
  const subjectsByTerm = groupSubjectsByTerm(subjects);
  const currentTerm = getCurrentTerm();

  const { supabase } = await getViewerContext(false);
  const { data: friendshipRows } = await supabase
    .from("friendships")
    .select("id, user_a_id, user_b_id")
    .or(`user_a_id.eq.${user!.id},user_b_id.eq.${user!.id}`);

  const friendIds = (friendshipRows ?? []).map((row) =>
    row.user_a_id === user!.id ? row.user_b_id : row.user_a_id,
  );

  const friendProfiles = friendIds.length
    ? (
        await supabase
          .from("profiles")
          .select(PROFILE_SELECT)
          .in("id", friendIds)
      ).data ?? []
    : [];

  const friendsById = new Map(friendProfiles.map((friend) => [friend.id, friend as Profile]));
  const friendSubjects = await Promise.all(friendIds.map((friendId) => getUserSubjects(friendId)));
  const sharedFriendsBySubject = new Map<string, SharedFriendMarker[]>();

  for (const rows of friendSubjects) {
    if (!rows.length) continue;
    const friendId = rows[0]?.user_id;
    const friend = friendId ? friendsById.get(friendId) : null;
    if (!friend) continue;

    const commonSubjects = getCommonSubjects(subjectsByTerm, groupSubjectsByTerm(rows));

    for (const term of TERMS) {
      for (const subject of commonSubjects[term]) {
        const key = `${term}:${subject.code}`;
        const current = sharedFriendsBySubject.get(key) ?? [];
        current.push({
          friendId: friend.id,
          fullName: friend.full_name,
          initials: getInitials(friend.full_name),
        });
        sharedFriendsBySubject.set(key, current);
      }
    }
  }

  const timetableBlocks = (await getUserTimetableBlocksForTerms(user!.id)).filter(
    (block) => block.start_at || block.term === currentTerm,
  );

  return {
    user: user!,
    profile: profile!,
    subjectRows: subjects,
    subjectsByTerm,
    currentTerm,
    timetableBlocks,
    sharedFriendsBySubject,
  };
}

export async function getUserInterests(userId: string) {
  const { supabase } = await getViewerContext(false);
  const { data } = await supabase
    .from("user_interests")
    .select("user_id, interest")
    .eq("user_id", userId)
    .order("interest");

  return (data ?? []) as UserInterestRow[];
}

export async function getUserTimetableBlocks(userId: string, term: Term) {
  return getUserTimetableBlocksForTerms(userId, [term]);
}

export async function getUserTimetableBlocksForTerms(userId: string, terms: Term[] = [...TERMS]) {
  const { supabase } = await getViewerContext(false);
  const { data } = await supabase
    .from("user_timetable_blocks")
    .select("*")
    .eq("user_id", userId)
    .in("term", terms)
    .order("day_of_week")
    .order("start_minutes");

  const currentYearStart = new Date(new Date().getFullYear(), 0, 1);
  return ((data ?? []) as TimetableBlock[]).filter((block) => {
    if (!block.end_at) return true;
    const endDate = new Date(block.end_at);
    return Number.isNaN(endDate.getTime()) || endDate >= currentYearStart;
  });
}

export async function getUserTimetableSource(userId: string, term: Term) {
  const { supabase } = await getViewerContext(false);
  const { data } = await supabase
    .from("user_timetable_sources")
    .select("id, user_id, term, source_type, calendar_url, notes, updated_at")
    .eq("user_id", userId)
    .eq("term", term)
    .maybeSingle();

  return (data ?? null) as TimetableSource | null;
}

export async function getSettingsData() {
  const { user, profile } = await getViewerContext();
  const currentTerm = getCurrentTerm();
  const [subjectRows, interests, timetableSource, timetableBlocks] = await Promise.all([
    getUserSubjects(user!.id),
    getUserInterests(user!.id),
    getUserTimetableSource(user!.id, currentTerm),
    getUserTimetableBlocks(user!.id, currentTerm),
  ]);

  return {
    user: user!,
    profile: profile!,
    currentTerm,
    subjectsByTerm: groupSubjectsByTerm(subjectRows),
    interests: interests.map((row) => row.interest),
    timetableSource,
    timetableBlocks,
  };
}

export async function getAcceptedFriendProfiles() {
  const { user } = await getViewerContext();
  const { friends } = await getAcceptedFriendsForUser(user!.id);
  return friends;
}

export async function getFriendsData(query?: string) {
  const { supabase, user, profile } = await getViewerContext();
  const currentUserId = user!.id;
  const { friendIds, friends, friendshipRows } = await getAcceptedFriendsForUser(currentUserId);

  const { data: incoming } = await supabase
    .from("friend_requests")
    .select(
      `id, sender_user_id, receiver_user_id, status, created_at, sender:profiles!friend_requests_sender_user_id_fkey(${PROFILE_SELECT})`,
    )
    .eq("receiver_user_id", currentUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: outgoing } = await supabase
    .from("friend_requests")
    .select(
      `id, sender_user_id, receiver_user_id, status, created_at, receiver:profiles!friend_requests_receiver_user_id_fkey(${PROFILE_SELECT})`,
    )
    .eq("sender_user_id", currentUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  let searchResults: Profile[] = [];

  if (query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      const blockedIds = new Set([
        currentUserId,
        ...friendIds,
        ...(incoming ?? []).map((row) => row.sender_user_id),
        ...(outgoing ?? []).map((row) => row.receiver_user_id),
      ]);

      const { data } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .or(
          `full_name.ilike.%${normalizedQuery}%,zid.ilike.%${normalizedQuery}%,unsw_email.ilike.%${normalizedQuery}%`,
        )
        .limit(10);

      searchResults = ((data ?? []) as Profile[]).filter(
        (candidate) => !blockedIds.has(candidate.id),
      );
    }
  }

  const viewerSubjects = await getUserSubjects(currentUserId);
  const viewerByTerm = groupSubjectsByTerm(viewerSubjects);

  const sharedSubjectsByFriend = await Promise.all(
    friends.map(async (friend) => {
      const friendSubjects = await getUserSubjects(friend.id);
      const commonSubjects = getCommonSubjects(viewerByTerm, groupSubjectsByTerm(friendSubjects));
      const shared = TERMS.flatMap((term) =>
        commonSubjects[term].map((subject) => ({
          term,
          ...subject,
        })),
      );

      return {
        friend,
        shared,
      };
    }),
  );
  const sameDegreeFriends =
    profile?.degree
      ? friends.filter((friend) => friend.degree && friend.degree === profile.degree)
      : [];
  const { data: degreeMutualRows } = profile?.degree
    ? await supabase.rpc("discover_same_degree_mutuals")
    : { data: [] };

  return {
    profile: profile!,
    friends,
    friendshipRows,
    incomingRequests: (incoming ?? []).map((request) => ({
      ...request,
      sender: normalizeRelatedProfile(request.sender) ?? undefined,
    })) as FriendRequestRow[],
    outgoingRequests: (outgoing ?? []).map((request) => ({
      ...request,
      receiver: normalizeRelatedProfile(request.receiver) ?? undefined,
    })) as FriendRequestRow[],
    searchResults,
    sharedSubjectsByFriend: sharedSubjectsByFriend.filter((entry) => entry.shared.length > 0),
    sameDegreeFriends,
    degreeMutuals: (degreeMutualRows ?? []) as DegreeMutual[],
  };
}

export async function getFriendDetail(friendId: string) {
  const { supabase, user, profile } = await getViewerContext();
  const { data: friendProfile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", friendId)
    .single();

  if (!friendProfile) {
    redirect("/friends?error=Friend not found.");
  }

  const [userAId, userBId] = orderFriendPair(user!.id, friendProfile.id);
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("user_a_id", userAId)
    .eq("user_b_id", userBId)
    .maybeSingle();

  if (!friendship) {
    redirect("/friends?error=You can only view accepted friends.");
  }

  const [mySubjects, friendSubjects, friendTimetableBlocks, { data: friendDegreeRows }] = await Promise.all([
    getUserSubjects(user!.id),
    getUserSubjects(friendProfile.id),
    getUserTimetableBlocksForTerms(friendProfile.id),
    profile?.degree
      ? supabase.rpc("discover_friend_same_degree_friends", {
          target_friend_id: friendProfile.id,
        })
      : Promise.resolve({ data: [] }),
  ]);

  const mineByTerm = groupSubjectsByTerm(mySubjects);
  const friendByTerm = groupSubjectsByTerm(friendSubjects);
  const commonSubjects = getCommonSubjects(mineByTerm, friendByTerm);

  const { data: plans } = await supabase
    .from("shared_term_plans")
    .select("id, owner_user_id, friend_user_id, term, title, notes, created_at")
    .or(
      `and(owner_user_id.eq.${user!.id},friend_user_id.eq.${friendProfile.id}),and(owner_user_id.eq.${friendProfile.id},friend_user_id.eq.${user!.id})`,
    )
    .order("created_at", { ascending: false });

  return {
    viewerProfile: profile!,
    friendProfile: friendProfile as Profile,
    mySubjects: mineByTerm,
    friendSubjects: friendByTerm,
    commonSubjects,
    friendTimetableBlocks,
    friendDegreeFriends: (friendDegreeRows ?? []) as DegreeMutual[],
    plans: (plans ?? []) as SharedPlanRow[],
  };
}

export async function getPlansIndexData() {
  const { supabase, user, profile } = await getViewerContext();

  const { data: plans } = await supabase
    .from("shared_term_plans")
    .select("id, owner_user_id, friend_user_id, term, title, notes, created_at")
    .or(`owner_user_id.eq.${user!.id},friend_user_id.eq.${user!.id}`)
    .order("created_at", { ascending: false });

  const planRows = (plans ?? []) as SharedPlanRow[];
  const participantIds = [
    ...new Set(planRows.flatMap((plan) => [plan.owner_user_id, plan.friend_user_id]).filter(Boolean)),
  ] as string[];
  const { data: participantProfiles } = participantIds.length
    ? await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .in("id", participantIds)
    : { data: [] };

  const profilesById = new Map(((participantProfiles ?? []) as Profile[]).map((entry) => [entry.id, entry]));

  const { data: participantRows } = await supabase
    .from("shared_term_plan_participants")
    .select("plan_id, user_id");

  const participantsByPlan = new Map<string, Profile[]>();
  for (const row of participantRows ?? []) {
    const participant = profilesById.get(row.user_id);
    if (!participant) continue;
    const current = participantsByPlan.get(row.plan_id) ?? [];
    if (!current.some((entry) => entry.id === participant.id)) {
      current.push(participant);
      participantsByPlan.set(row.plan_id, current);
    }
  }

  return {
    profile: profile!,
    plans: planRows.map((plan) => ({
      ...plan,
      participants:
        participantsByPlan.get(plan.id) ??
        [profilesById.get(plan.owner_user_id), plan.friend_user_id ? profilesById.get(plan.friend_user_id) : null].filter(Boolean),
    })),
  };
}

function groupPlannerOptions(
  subjects: SubjectSelection[],
  optionsBySubject: Map<string, PlannerClassOption[]>,
) {
  return subjects
    .map((subject) => {
      const subjectOptions = optionsBySubject.get(subject.code) ?? [];

      const groupedByActivity = new Map<string, PlannerClassOption[]>();
      for (const option of subjectOptions) {
        const current = groupedByActivity.get(option.activity) ?? [];
        current.push(option);
        groupedByActivity.set(option.activity, current);
      }

      const activityOptions = [...groupedByActivity.entries()].map(([activity, items]) => ({
        activity,
        options: items,
      }));

      return {
        subject,
        activityOptions,
      };
    })
    .filter((entry) => entry.activityOptions.length > 0);
}

export async function getPlannerWorkspace(planId: string) {
  const { supabase, user, profile } = await getViewerContext();

  const { data: plan } = await supabase
    .from("shared_term_plans")
    .select("id, owner_user_id, friend_user_id, term, title, notes, created_at")
    .eq("id", planId)
    .single();

  if (!plan) {
    redirect("/friends?error=Shared plan not found.");
  }

  if (plan.owner_user_id !== user!.id && plan.friend_user_id !== user!.id) {
    redirect("/friends?error=You do not have access to that plan.");
  }

  let { data: participantRows } = await supabase
    .from("shared_term_plan_participants")
    .select("id, user_id")
    .eq("plan_id", plan.id);

  if (!participantRows?.length) {
    const defaultParticipants = [{ plan_id: plan.id, user_id: plan.owner_user_id }];
    if (plan.friend_user_id) {
      defaultParticipants.push({ plan_id: plan.id, user_id: plan.friend_user_id });
    }

    await supabase.from("shared_term_plan_participants").insert(defaultParticipants);

    participantRows = (
      await supabase
        .from("shared_term_plan_participants")
        .select("id, user_id")
        .eq("plan_id", plan.id)
    ).data;
  }

  const participantIds = [...new Set((participantRows ?? []).map((row) => row.user_id))];
  const [{ data: participantProfiles }, acceptedFriends, participantSubjectRows, { data: savedChoices }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .in("id", participantIds),
      getAcceptedFriendsForUser(user!.id),
      Promise.all(participantIds.map((participantId) => getUserSubjects(participantId))),
      supabase
        .from("shared_term_plan_class_choices")
        .select("scope_type, participant_user_id, subject_code, activity, class_id")
        .eq("plan_id", plan.id),
    ]);

  const participants = ((participantProfiles ?? []) as PlanParticipant[])
    .map((participant) => ({
      ...participant,
      is_owner: participant.id === plan.owner_user_id,
    }))
    .sort((left, right) =>
      left.id === plan.owner_user_id ? -1 : right.id === plan.owner_user_id ? 1 : left.full_name.localeCompare(right.full_name),
    );

  const subjectsByParticipant = new Map<string, SubjectSelection[]>();
  for (const rows of participantSubjectRows) {
    if (!rows.length) continue;
    const participantId = rows[0].user_id;
    subjectsByParticipant.set(
      participantId,
      groupSubjectsByTerm(rows)[plan.term as Term],
    );
  }

  const allSubjectCodes = new Set<string>();
  for (const subjects of subjectsByParticipant.values()) {
    for (const subject of subjects) {
      allSubjectCodes.add(subject.code);
    }
  }

  const classOptionsBySubject = await fetchPlannerClasses([...allSubjectCodes], plan.term as Term);

  const subjectMembership = new Map<
    string,
    { subject: SubjectSelection; participants: PlanParticipant[] }
  >();

  for (const participant of participants) {
    for (const subject of subjectsByParticipant.get(participant.id) ?? []) {
      const current = subjectMembership.get(subject.code) ?? { subject, participants: [] };
      current.participants.push(participant);
      subjectMembership.set(subject.code, current);
    }
  }

  const commonSubjects: PlannerSubjectGroup[] = [];
  const individualSubjects: PlannerSubjectGroup[] = [];

  for (const entry of subjectMembership.values()) {
    const optionGroups = groupPlannerOptions([entry.subject], classOptionsBySubject);
    if (!optionGroups.length) continue;

    const group: PlannerSubjectGroup = {
      subject: entry.subject,
      participants: entry.participants,
      activityOptions: optionGroups[0].activityOptions,
    };

    if (entry.participants.length > 1) {
      commonSubjects.push(group);
    } else {
      individualSubjects.push(group);
    }
  }

  commonSubjects.sort((left, right) => left.subject.code.localeCompare(right.subject.code));
  individualSubjects.sort((left, right) =>
    left.participants[0]!.full_name.localeCompare(right.participants[0]!.full_name) ||
    left.subject.code.localeCompare(right.subject.code),
  );

  const selectedChoices: PlannerChoice[] = (savedChoices ?? []).map((choice) => ({
    scopeType: choice.scope_type as "common" | "individual",
    participantUserId: choice.participant_user_id,
    subjectCode: choice.subject_code,
    activity: choice.activity,
    classId: choice.class_id,
  }));
  const addableFriends = acceptedFriends.friends.filter(
    (friend) => !participantIds.includes(friend.id),
  );

  return {
    viewerProfile: profile!,
    plan: plan as SharedPlanRow,
    participants,
    commonSubjects,
    individualSubjects,
    selectedChoices,
    addableFriends,
  };
}

export function hasAnySubjects(subjects: SubjectsByTerm) {
  return TERMS.some((term) => subjects[term].length > 0);
}
