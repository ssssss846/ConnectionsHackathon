"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { TERMS, orderFriendPair, type Term } from "@/lib/constants";
import {
  buildEmptySubjects,
  readLoginCredentials,
  readSettingsFromFormData,
  readSignUpDetails,
  readSubjectsFromFormData,
} from "@/lib/forms";
import { getViewerContext, hasAnySubjects } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchBlocksFromCalendarUrl } from "@/lib/timetable";
import type { FormState, PlannerChoice, TimetableBlock } from "@/lib/types";

function withMessage(path: string, key: "notice" | "error", message: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function getPlannerChoiceKey(choice: Pick<PlannerChoice, "scopeType" | "participantUserId" | "subjectCode" | "activity">) {
  return [choice.scopeType, choice.participantUserId ?? "all", choice.subjectCode, choice.activity].join(":");
}

export async function signUpAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = readSignUpDetails(formData);
  if ("error" in parsed) return parsed.error;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        username: parsed.data.zid,
        full_name: parsed.data.fullName,
        zid: parsed.data.zid,
        unsw_email: parsed.data.email,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Unable to create account right now." };
  }

  redirect("/onboarding");
}

export async function signInAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = readLoginCredentials(formData);
  if ("error" in parsed) return parsed.error;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "UNSW email or password was incorrect." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Could not start your session." };
  }

  const { data: subjectRows } = await supabase
    .from("user_term_subjects")
    .select("term, subject_code, subject_name")
    .eq("user_id", user.id);

  const grouped = buildEmptySubjects();
  for (const row of subjectRows ?? []) {
    grouped[row.term as Term].push({
      code: row.subject_code,
      name: row.subject_name,
    });
  }

  redirect(hasAnySubjects(grouped) ? "/dashboard" : "/onboarding");
}

export async function saveSubjectsAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readSubjectsFromFormData(formData);
  if ("error" in parsed) return parsed.error;

  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard");
  const { supabase, user } = await getViewerContext();

  const { error: deleteError } = await supabase
    .from("user_term_subjects")
    .delete()
    .eq("user_id", user!.id);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const rows = TERMS.flatMap((term) =>
    parsed.data[term].map((subject) => ({
      user_id: user!.id,
      term,
      subject_code: subject.code,
      subject_name: subject.name,
    })),
  );

  if (rows.length) {
    const { error: insertError } = await supabase.from("user_term_subjects").insert(rows);
    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/friends");
  revalidatePath("/settings");
  redirect(redirectTo);
}

export async function saveSettingsAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readSettingsFromFormData(formData);
  if ("error" in parsed) return parsed.error;

  const { supabase, user } = await getViewerContext();
  const termsToUpdate = parsed.data.sourceType === "calendar_url" ? TERMS : [parsed.data.term];
  let blocksToInsert: Omit<TimetableBlock, "id">[] = [];

  if (parsed.data.sourceType === "calendar_url" && parsed.data.calendarUrl) {
    try {
      blocksToInsert = await fetchBlocksFromCalendarUrl({
        calendarUrl: parsed.data.calendarUrl,
        term: parsed.data.term,
        userId: user!.id,
      });
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not import that calendar link.",
      };
    }
  } else {
    blocksToInsert = parsed.data.blocks.map((block) => ({
      ...block,
      user_id: user!.id,
      source_type: "manual" as const,
    }));
  }

  await supabase.from("user_interests").delete().eq("user_id", user!.id);
  if (parsed.data.interests.length) {
    const { error: interestsError } = await supabase.from("user_interests").insert(
      parsed.data.interests.map((interest) => ({
        user_id: user!.id,
        interest,
      })),
    );

    if (interestsError) {
      return { error: interestsError.message };
    }
  }

  const { error: sourceError } = await supabase.from("user_timetable_sources").upsert(
    termsToUpdate.map((term) => ({
      user_id: user!.id,
      term,
      source_type: parsed.data.sourceType,
      calendar_url: parsed.data.sourceType === "calendar_url" ? parsed.data.calendarUrl : null,
      notes: null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,term" },
  );

  if (sourceError) {
    return { error: sourceError.message };
  }

  const deleteQuery = supabase.from("user_timetable_blocks").delete().eq("user_id", user!.id);
  const { error: deleteBlocksError } =
    parsed.data.sourceType === "calendar_url"
      ? await deleteQuery
      : await deleteQuery.eq("term", parsed.data.term);

  if (deleteBlocksError) {
    return { error: deleteBlocksError.message };
  }

  if (blocksToInsert.length) {
    const { error: blocksError } = await supabase.from("user_timetable_blocks").insert(blocksToInsert);
    if (blocksError) {
      return { error: blocksError.message };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/events");
  revalidatePath("/settings");
  return { success: "Settings saved." };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function sendFriendRequestAction(formData: FormData) {
  const recipientId = String(formData.get("recipient_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/friends");
  const { supabase, user } = await getViewerContext();

  if (!recipientId || recipientId === user!.id) {
    redirect(withMessage(returnTo, "error", "Choose a valid friend to add."));
  }

  const [userAId, userBId] = orderFriendPair(user!.id, recipientId);
  const { data: existingFriendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("user_a_id", userAId)
    .eq("user_b_id", userBId)
    .maybeSingle();

  if (existingFriendship) {
    redirect(withMessage(returnTo, "error", "You are already friends with that user."));
  }

  const { data: existingRequest } = await supabase
    .from("friend_requests")
    .select("id")
    .or(
      `and(sender_user_id.eq.${user!.id},receiver_user_id.eq.${recipientId},status.eq.pending),and(sender_user_id.eq.${recipientId},receiver_user_id.eq.${user!.id},status.eq.pending)`,
    )
    .maybeSingle();

  if (existingRequest) {
    redirect(withMessage(returnTo, "error", "There is already a pending request between you."));
  }

  const { error } = await supabase.from("friend_requests").insert({
    sender_user_id: user!.id,
    receiver_user_id: recipientId,
    status: "pending",
  });

  if (error) {
    redirect(withMessage(returnTo, "error", error.message));
  }

  revalidatePath("/friends");
  redirect(withMessage(returnTo, "notice", "Friend request sent."));
}

export async function respondToFriendRequestAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const { supabase, user } = await getViewerContext();

  const { data: request } = await supabase
    .from("friend_requests")
    .select("id, sender_user_id, receiver_user_id, status")
    .eq("id", requestId)
    .eq("receiver_user_id", user!.id)
    .eq("status", "pending")
    .single();

  if (!request) {
    redirect(withMessage("/friends", "error", "That friend request is no longer available."));
  }

  const nextStatus = decision === "accept" ? "accepted" : "rejected";
  const { error: updateError } = await supabase
    .from("friend_requests")
    .update({ status: nextStatus })
    .eq("id", requestId);

  if (updateError) {
    redirect(withMessage("/friends", "error", updateError.message));
  }

  if (nextStatus === "accepted") {
    const [userAId, userBId] = orderFriendPair(user!.id, request.sender_user_id);
    await supabase.from("friendships").insert({
      user_a_id: userAId,
      user_b_id: userBId,
    });
  }

  revalidatePath("/friends");
  redirect(
    withMessage(
      "/friends",
      "notice",
      nextStatus === "accepted" ? "Friend request accepted." : "Friend request declined.",
    ),
  );
}

export async function createSharedPlanAction(formData: FormData) {
  const friendId = String(formData.get("friend_id") ?? "");
  const term = String(formData.get("term") ?? "") as Term;
  const { supabase, user } = await getViewerContext();

  if (!TERMS.includes(term)) {
    redirect(withMessage("/friends", "error", "Choose a valid term for the shared plan."));
  }

  const [userAId, userBId] = orderFriendPair(user!.id, friendId);
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("user_a_id", userAId)
    .eq("user_b_id", userBId)
    .maybeSingle();

  if (!friendship) {
    redirect(withMessage("/friends", "error", "You can only create plans with accepted friends."));
  }

  const { data: plan, error } = await supabase
    .from("shared_term_plans")
    .insert({
      owner_user_id: user!.id,
      friend_user_id: friendId,
      term,
      title: `${term} timetable`,
      notes: "",
    })
    .select("id")
    .single();

  if (error || !plan) {
    redirect(withMessage("/friends", "error", error?.message ?? "Could not create shared plan."));
  }

  await supabase.from("shared_term_plan_participants").insert([
    { plan_id: plan.id, user_id: user!.id },
    { plan_id: plan.id, user_id: friendId },
  ]);

  revalidatePath(`/friends/${friendId}`);
  redirect(`/plans/${plan.id}`);
}

export async function addPlanParticipantAction(formData: FormData) {
  const planId = String(formData.get("plan_id") ?? "");
  const participantId = String(formData.get("participant_id") ?? "");
  const { supabase, user } = await getViewerContext();

  const { data: plan } = await supabase
    .from("shared_term_plans")
    .select("id, owner_user_id, friend_user_id")
    .eq("id", planId)
    .single();

  if (!plan || (plan.owner_user_id !== user!.id && plan.friend_user_id !== user!.id)) {
    redirect(withMessage("/friends", "error", "You do not have access to that plan."));
  }

  const { error } = await supabase.from("shared_term_plan_participants").insert({
    plan_id: planId,
    user_id: participantId,
  });

  if (error) {
    redirect(withMessage(`/plans/${planId}`, "error", error.message));
  }

  revalidatePath(`/plans/${planId}`);
  redirect(withMessage(`/plans/${planId}`, "notice", "Friend added to the planner."));
}

export async function removePlanParticipantAction(formData: FormData) {
  const planId = String(formData.get("plan_id") ?? "");
  const participantId = String(formData.get("participant_id") ?? "");
  const { supabase, user } = await getViewerContext();

  const { data: plan } = await supabase
    .from("shared_term_plans")
    .select("id, owner_user_id, friend_user_id")
    .eq("id", planId)
    .single();

  if (!plan || (plan.owner_user_id !== user!.id && plan.friend_user_id !== user!.id)) {
    redirect(withMessage("/friends", "error", "You do not have access to that plan."));
  }

  if (participantId === plan.owner_user_id || participantId === plan.friend_user_id) {
    redirect(withMessage(`/plans/${planId}`, "error", "Core participants cannot be removed from this plan."));
  }

  await supabase
    .from("shared_term_plan_class_choices")
    .delete()
    .eq("plan_id", planId)
    .eq("participant_user_id", participantId);

  const { error } = await supabase
    .from("shared_term_plan_participants")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", participantId);

  if (error) {
    redirect(withMessage(`/plans/${planId}`, "error", error.message));
  }

  revalidatePath(`/plans/${planId}`);
  redirect(withMessage(`/plans/${planId}`, "notice", "Participant removed from the planner."));
}

export async function savePlannerWorkspaceAction(formData: FormData) {
  const planId = String(formData.get("plan_id") ?? "");
  const rawChoices = String(formData.get("planner_choices") ?? "[]");

  const { supabase, user } = await getViewerContext();
  const { data: plan } = await supabase
    .from("shared_term_plans")
    .select("id, owner_user_id, friend_user_id, term")
    .eq("id", planId)
    .single();

  if (!plan || (plan.owner_user_id !== user!.id && plan.friend_user_id !== user!.id)) {
    redirect(withMessage("/friends", "error", "You do not have access to update that plan."));
  }

  const { error: updateError } = await supabase
    .from("shared_term_plans")
    .update({
      title: `${plan.term} timetable`,
      notes: "",
    })
    .eq("id", planId);

  if (updateError) {
    redirect(withMessage(`/plans/${planId}`, "error", updateError.message));
  }

  let choices: PlannerChoice[] = [];
  try {
    choices = JSON.parse(rawChoices) as PlannerChoice[];
  } catch {
    redirect(withMessage(`/plans/${planId}`, "error", "Could not read the planner changes."));
  }

  const uniqueChoices = [...new Map(choices.map((choice) => [getPlannerChoiceKey(choice), choice])).values()];

  await supabase.from("shared_term_plan_class_choices").delete().eq("plan_id", planId);

  if (uniqueChoices.length) {
    const { error: insertError } = await supabase.from("shared_term_plan_class_choices").insert(
      uniqueChoices.map((choice) => ({
        plan_id: planId,
        scope_type: choice.scopeType,
        participant_user_id: choice.participantUserId,
        subject_code: choice.subjectCode,
        activity: choice.activity,
        class_id: choice.classId,
      })),
    );

    if (insertError) {
      redirect(withMessage(`/plans/${planId}`, "error", insertError.message));
    }
  }

  revalidatePath(`/plans/${planId}`);
  redirect(withMessage(`/plans/${planId}`, "notice", "Planner saved."));
}
