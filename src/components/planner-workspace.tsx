"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  PlannerChoice,
  PlannerClassOption,
  PlannerSubjectGroup,
  PlanParticipant,
  SharedPlanRow,
} from "@/lib/types";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  Mon: "M",
  Tue: "T",
  Wed: "W",
  Thu: "T",
  Fri: "F",
};
const START_MINUTES = 8 * 60;
const END_MINUTES = 21 * 60;
const PIXELS_PER_MINUTE = 1;
const PARTICIPANT_COLORS = [
  "bg-[#dcefdc] text-[#1f4e39] border-[#7fb08d]",
  "bg-[#f8dfc3] text-[#8b4d14] border-[#e0ab72]",
  "bg-[#dce9fb] text-[#1f4777] border-[#80a6dd]",
  "bg-[#f3daf1] text-[#7a285f] border-[#d59fc9]",
  "bg-[#fbe1d8] text-[#8a3b2a] border-[#dd9988]",
];

type PlannerWorkspaceProps = {
  plan: SharedPlanRow;
  participants: PlanParticipant[];
  commonSubjects: PlannerSubjectGroup[];
  individualSubjects: PlannerSubjectGroup[];
  selectedChoices: PlannerChoice[];
  addableFriends: PlanParticipant[];
  initialMessages: Array<{
    tone: "success" | "error" | "info";
    message: string;
  }>;
  saveAction: (formData: FormData) => Promise<void>;
  addParticipantAction: (formData: FormData) => Promise<void>;
  removeParticipantAction: (formData: FormData) => Promise<void>;
};

type DragChoice = {
  scopeType: "common" | "individual";
  participantUserId: string | null;
  subjectCode: string;
  activity: string;
  classOptions: PlannerClassOption[];
};

type AutoTask = {
  scopeType: "common" | "individual";
  participantUserId: string | null;
  participantIds: string[];
  subjectCode: string;
  activity: string;
  options: PlannerClassOption[];
};

type PlacedOption = {
  task: AutoTask;
  option: PlannerClassOption;
};

type ToastMessage = {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
};

function getChoiceKey(choice: Pick<PlannerChoice, "scopeType" | "participantUserId" | "subjectCode" | "activity">) {
  return [choice.scopeType, choice.participantUserId ?? "all", choice.subjectCode, choice.activity].join(":");
}

function uniquePlannerChoices(choices: PlannerChoice[]) {
  return [...new Map(choices.map((choice) => [getChoiceKey(choice), choice])).values()];
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getParticipantColor(index: number) {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}

export function PlannerWorkspace({
  plan,
  participants,
  commonSubjects,
  individualSubjects,
  selectedChoices,
  addableFriends,
  initialMessages,
  saveAction,
  addParticipantAction,
  removeParticipantAction,
}: PlannerWorkspaceProps) {
  const [choices, setChoices] = useState<PlannerChoice[]>(selectedChoices);
  const [history, setHistory] = useState<PlannerChoice[][]>([]);
  const [future, setFuture] = useState<PlannerChoice[][]>([]);
  const [activeTab, setActiveTab] = useState<string>("combined");
  const [dragging, setDragging] = useState<DragChoice | null>(null);
  const [participantSearch, setParticipantSearch] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [closingToastIds, setClosingToastIds] = useState<number[]>([]);
  const nextToastId = useRef(1);
  const seededMessages = useRef(false);

  const participantColorMap = useMemo(
    () => new Map(participants.map((participant, index) => [participant.id, getParticipantColor(index)])),
    [participants],
  );

  const classOptionLookup = useMemo(() => {
    const lookup = new Map<string, PlannerClassOption>();

    for (const subject of commonSubjects) {
      for (const activityGroup of subject.activityOptions) {
        for (const option of activityGroup.options) {
          lookup.set(
            getChoiceKey({
              scopeType: "common",
              participantUserId: null,
              subjectCode: subject.subject.code,
              activity: activityGroup.activity,
            }) + `:${option.classId}`,
            option,
          );
        }
      }
    }

    for (const subject of individualSubjects) {
      const participantId = subject.participants[0]!.id;
      for (const activityGroup of subject.activityOptions) {
        for (const option of activityGroup.options) {
          lookup.set(
            getChoiceKey({
              scopeType: "individual",
              participantUserId: participantId,
              subjectCode: subject.subject.code,
              activity: activityGroup.activity,
            }) + `:${option.classId}`,
            option,
          );
        }
      }
    }

    return lookup;
  }, [commonSubjects, individualSubjects]);

  const selectedOptionEntries = useMemo(
    () =>
      choices
        .map((choice) => {
          const found = classOptionLookup.get(`${getChoiceKey(choice)}:${choice.classId}`);
          return found ? { choice, classOption: found } : null;
        })
        .filter(Boolean) as Array<{ choice: PlannerChoice; classOption: PlannerClassOption }>,
    [choices, classOptionLookup],
  );

  const filteredAddableFriends = useMemo(() => {
    const query = participantSearch.trim().toLowerCase();
    if (!query) return addableFriends;

    return addableFriends.filter((friend) =>
      [friend.full_name, friend.zid, friend.unsw_email].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [addableFriends, participantSearch]);

  const visibleCalendarEntries = useMemo(() => {
    return selectedOptionEntries.filter(({ choice }) => {
      if (activeTab === "combined") {
        return true;
      }

      if (choice.scopeType === "common") {
        const group = commonSubjects.find((subject) => subject.subject.code === choice.subjectCode);
        return group?.participants.some((participant) => participant.id === activeTab) ?? false;
      }

      return choice.participantUserId === activeTab;
    });
  }, [activeTab, commonSubjects, selectedOptionEntries]);

  const dismissToast = useCallback((id: number) => {
    setClosingToastIds((current) => (current.includes(id) ? current : [...current, id]));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      setClosingToastIds((current) => current.filter((toastId) => toastId !== id));
    }, 220);
  }, []);

  const pushToast = useCallback((tone: "success" | "error" | "info", message: string) => {
    const id = nextToastId.current++;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      dismissToast(id);
    }, 5000);
  }, [dismissToast]);

  useEffect(() => {
    if (seededMessages.current) return;
    seededMessages.current = true;

    for (const entry of initialMessages) {
      pushToast(entry.tone, entry.message);
    }
  }, [initialMessages, pushToast]);

  function applyChoices(updater: (current: PlannerChoice[]) => PlannerChoice[]) {
    setChoices((current) => {
      const next = updater(current);
      const same =
        current.length === next.length &&
        current.every((choice, index) => JSON.stringify(choice) === JSON.stringify(next[index]));
      if (same) {
        return current;
      }
      setHistory((previous) => [...previous, current]);
      setFuture([]);
      return next;
    });
  }

  function setChoice(nextChoice: PlannerChoice) {
    applyChoices((current) => {
      const key = getChoiceKey(nextChoice);
      return [...current.filter((choice) => getChoiceKey(choice) !== key), nextChoice];
    });
  }

  function undoChoices() {
    setHistory((previous) => {
      const last = previous[previous.length - 1];
      if (!last) return previous;
      setFuture((currentFuture) => [choices, ...currentFuture]);
      setChoices(last);
      return previous.slice(0, -1);
    });
  }

  function redoChoices() {
    setFuture((previous) => {
      const next = previous[0];
      if (!next) return previous;
      setHistory((currentHistory) => [...currentHistory, choices]);
      setChoices(next);
      return previous.slice(1);
    });
  }

  function clearChoices() {
    applyChoices(() => []);
  }

  function overlaps(left: PlannerClassOption, right: PlannerClassOption) {
    return left.times.some((leftTime) =>
      right.times.some(
        (rightTime) =>
          leftTime.day === rightTime.day &&
          leftTime.startMinutes < rightTime.endMinutes &&
          rightTime.startMinutes < leftTime.endMinutes,
      ),
    );
  }

  function canOverlapByRule(leftTask: AutoTask, rightTask: AutoTask) {
    const leftActivity = leftTask.activity.toLowerCase();
    const rightActivity = rightTask.activity.toLowerCase();
    return (
      (leftActivity.includes("lec") && rightActivity.includes("lec")) ||
      leftTask.options.length === 1 ||
      rightTask.options.length === 1
    );
  }

  function autoGenerateChoices() {
    const tasks: AutoTask[] = [
      ...commonSubjects.flatMap((subject) =>
        subject.activityOptions.map((activityGroup) => ({
          scopeType: "common" as const,
          participantUserId: null,
          participantIds: subject.participants.map((participant) => participant.id),
          subjectCode: subject.subject.code,
          activity: activityGroup.activity,
          options: [...activityGroup.options].sort((left, right) =>
            left.section.localeCompare(right.section) ||
            left.classNumber.localeCompare(right.classNumber),
          ),
        })),
      ),
      ...individualSubjects.flatMap((subject) =>
        subject.activityOptions.map((activityGroup) => ({
          scopeType: "individual" as const,
          participantUserId: subject.participants[0]!.id,
          participantIds: [subject.participants[0]!.id],
          subjectCode: subject.subject.code,
          activity: activityGroup.activity,
          options: [...activityGroup.options].sort((left, right) =>
            left.section.localeCompare(right.section) ||
            left.classNumber.localeCompare(right.classNumber),
          ),
        })),
      ),
    ];

    const scheduleByParticipant = new Map<string, PlacedOption[]>();
    const best = { choices: [] as PlannerChoice[] };
    const deadline = Date.now() + 6000;
    let timedOut = false;

    function canUseOption(task: AutoTask, option: PlannerClassOption) {
      return task.participantIds.every((participantId) => {
        const currentSchedule = scheduleByParticipant.get(participantId) ?? [];
        return currentSchedule.every(
          (existing) => canOverlapByRule(task, existing.task) || !overlaps(existing.option, option),
        );
      });
    }

    function placeOption(task: AutoTask, option: PlannerClassOption) {
      for (const participantId of task.participantIds) {
        const currentSchedule = scheduleByParticipant.get(participantId) ?? [];
        scheduleByParticipant.set(participantId, [...currentSchedule, { task, option }]);
      }
    }

    function unplaceOption(task: AutoTask, option: PlannerClassOption) {
      for (const participantId of task.participantIds) {
        const currentSchedule = scheduleByParticipant.get(participantId) ?? [];
        scheduleByParticipant.set(
          participantId,
          currentSchedule.filter((existing) => existing.option.classId !== option.classId),
        );
      }
    }

    function scoreOption(task: AutoTask, option: PlannerClassOption, remainingTasks: AutoTask[]) {
      let conflictCost = 0;

      for (const remainingTask of remainingTasks) {
        if (
          !remainingTask.participantIds.some((participantId) =>
            task.participantIds.includes(participantId),
          )
        ) {
          continue;
        }

        for (const candidate of remainingTask.options) {
          if (!canOverlapByRule(task, remainingTask) && overlaps(option, candidate)) {
            conflictCost += 1;
          }
        }
      }

      const totalMinutes = option.times.reduce(
        (sum, time) => sum + (time.endMinutes - time.startMinutes),
        0,
      );

      return { conflictCost, totalMinutes };
    }

    function chooseNextTask(remainingTasks: AutoTask[]) {
      let bestTask: AutoTask | null = null;
      let bestOptions: PlannerClassOption[] = [];

      for (const task of remainingTasks) {
        const validOptions = task.options.filter((option) => canUseOption(task, option));

        if (!bestTask || validOptions.length < bestOptions.length) {
          bestTask = task;
          bestOptions = validOptions;
        }
      }

      return bestTask ? { task: bestTask, validOptions: bestOptions } : null;
    }

    function backtrack(remainingTasks: AutoTask[], builtChoices: PlannerChoice[]) {
      if (Date.now() > deadline) {
        timedOut = true;
        return false;
      }

      if (builtChoices.length > best.choices.length) {
        best.choices = [...builtChoices];
      }

      if (!remainingTasks.length) {
        return true;
      }

      if (builtChoices.length + remainingTasks.length <= best.choices.length) {
        return false;
      }

      const selected = chooseNextTask(remainingTasks);
      if (!selected) {
        return false;
      }

      const { task, validOptions } = selected;
      const nextRemainingTasks = remainingTasks.filter(
        (candidate) =>
          !(
            candidate.scopeType === task.scopeType &&
            candidate.participantUserId === task.participantUserId &&
            candidate.subjectCode === task.subjectCode &&
            candidate.activity === task.activity
          ),
      );

      const orderedOptions = [...validOptions].sort((left, right) => {
        const leftScore = scoreOption(task, left, nextRemainingTasks);
        const rightScore = scoreOption(task, right, nextRemainingTasks);

        return (
          leftScore.conflictCost - rightScore.conflictCost ||
          leftScore.totalMinutes - rightScore.totalMinutes ||
          left.section.localeCompare(right.section) ||
          left.classNumber.localeCompare(right.classNumber)
        );
      });

      for (const option of orderedOptions) {
        placeOption(task, option);

        builtChoices.push({
          scopeType: task.scopeType,
          participantUserId: task.participantUserId,
          subjectCode: task.subjectCode,
          activity: task.activity,
          classId: option.classId,
        });

        if (backtrack(nextRemainingTasks, builtChoices)) {
          return true;
        }

        builtChoices.pop();
        unplaceOption(task, option);
      }

      backtrack(nextRemainingTasks, builtChoices);
      return false;
    }

    const solvedAll = backtrack(tasks, []);

    const uniqueBestChoices = uniquePlannerChoices(best.choices);

    if (!uniqueBestChoices.length) {
      pushToast("error", "Could not find any clash-free class selections for this plan.");
      return;
    }

    applyChoices(() => uniqueBestChoices);
    pushToast(
      solvedAll ? "success" : "info",
      solvedAll
        ? "Auto-generated a clash-free timetable."
        : timedOut
          ? `Auto-generated ${uniqueBestChoices.length} of ${tasks.length} activity selections before timing out. The rest still need manual choices.`
          : `Auto-generated ${uniqueBestChoices.length} of ${tasks.length} activity selections. The rest still need manual choices.`,
    );
  }

  function renderActivityCard(
    scopeType: "common" | "individual",
    subject: PlannerSubjectGroup,
    activity: string,
    options: PlannerClassOption[],
    participantUserId: string | null,
  ) {
    const selectedChoice =
      choices.find(
        (choice) =>
          choice.scopeType === scopeType &&
          choice.participantUserId === participantUserId &&
          choice.subjectCode === subject.subject.code &&
          choice.activity === activity,
      ) ?? null;

    const selectedOption =
      selectedChoice
        ? options.find((option) => option.classId === selectedChoice.classId) ?? null
        : null;

    return (
      <div
        key={`${subject.subject.code}-${activity}-${participantUserId ?? "all"}`}
        className="rounded-2xl border border-[var(--border)] bg-white/75 p-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{activity}</p>
          </div>
          <button
            type="button"
            draggable
            onDragStart={() =>
              setDragging({
                scopeType,
                participantUserId,
                subjectCode: subject.subject.code,
                activity,
                classOptions: options,
              })
            }
            onDragEnd={() => setDragging(null)}
            className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Drag group
          </button>
        </div>
        <div className="space-y-2 text-[12px] text-[var(--muted)]">
          <p>{options.length} options available</p>
          {selectedOption ? (
            <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-[var(--accent-strong)]">
              <p className="font-semibold">
                Selected {selectedOption.section} · {selectedOption.classNumber}
              </p>
              {selectedOption.times.map((time) => (
                <p key={time.timeId} className="mt-1 text-[11px]">
                  {time.day} {time.time} · {time.location}
                </p>
              ))}
            </div>
          ) : (
            <p>Drag this activity onto a highlighted slot or click an overlay to choose a class option.</p>
          )}
        </div>
      </div>
    );
  }

  const gridHeight = (END_MINUTES - START_MINUTES) * PIXELS_PER_MINUTE;

  return (
    <div className="space-y-6">
      {toasts.length ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 flex w-full max-w-3xl -translate-x-1/2 flex-col gap-3 px-4">
          {toasts.map((toast) => {
            const toneClasses =
              toast.tone === "error"
                ? "border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]"
                : toast.tone === "success"
                  ? "border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[var(--border)] bg-white/95 text-[var(--foreground)]";
            const isClosing = closingToastIds.includes(toast.id);

            return (
              <div
                key={toast.id}
                className={`toast-message pointer-events-auto flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow)] backdrop-blur-sm ${isClosing ? "toast-message-out" : "toast-message-in"} ${toneClasses}`}
              >
                <p>{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full px-2 py-1 text-xs font-semibold transition hover:bg-black/5"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <section className="relative z-[200] grid gap-3 xl:grid-cols-[96px_minmax(0,1fr)_auto] xl:items-center">
        <div className="flex items-center justify-center rounded-[24px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center shadow-[var(--shadow)] backdrop-blur-sm">
          <p className="text-2xl font-semibold tracking-tight">{plan.term}</p>
        </div>

        <div className="relative rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow)] backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="flex min-w-max items-center gap-2 pr-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("combined")}
                  className={`rounded-[18px] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                    activeTab === "combined"
                      ? "bg-[#2e2d2b] text-white"
                      : "border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:border-[var(--accent)]"
                  }`}
                >
                  Combined
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ownerId = participants.find((participant) => participant.is_owner)?.id;
                    if (ownerId) {
                      setActiveTab(ownerId);
                    }
                  }}
                  className={`rounded-[18px] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                    participants.find((participant) => participant.is_owner)?.id === activeTab
                      ? "bg-[#2e2d2b] text-white"
                      : "border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:border-[var(--accent)]"
                  }`}
                >
                  Me
                </button>
                {participants
                  .filter((participant) => !participant.is_owner)
                  .map((participant, index) => {
                    const removable = participant.id !== plan.friend_user_id;
                    const paletteIndex = participants.findIndex((entry) => entry.id === participant.id);

                    return (
                      <div
                        key={participant.id}
                        className={`flex items-center gap-1 rounded-[18px] border px-1 ${
                          activeTab === participant.id
                            ? "border-[#2e2d2b] bg-[#2e2d2b] text-white"
                            : "border-[var(--border)] bg-white/80 text-[var(--foreground)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveTab(participant.id)}
                          className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em]"
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] ${
                              getParticipantColor(paletteIndex === -1 ? index + 1 : paletteIndex)
                            }`}
                          >
                            {getInitials(participant.full_name)}
                          </span>
                          {participant.full_name.split(" ")[0]}
                        </button>
                        {removable ? (
                          <form action={removeParticipantAction}>
                            <input type="hidden" name="plan_id" value={plan.id} />
                            <input type="hidden" name="participant_id" value={participant.id} />
                            <button
                              title={`Remove ${participant.full_name}`}
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold transition ${
                                activeTab === participant.id
                                  ? "text-white/75 hover:bg-white/10 hover:text-white"
                                  : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                              }`}
                            >
                              ×
                            </button>
                          </form>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="relative z-[300] min-w-[220px] shrink-0">
              <input
                value={participantSearch}
                onChange={(event) => setParticipantSearch(event.target.value)}
                placeholder={addableFriends.length ? "Search friends" : "No more friends"}
                className="w-full rounded-[18px] border border-[var(--border)] bg-white/85 px-4 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
                disabled={!addableFriends.length}
              />
              {addableFriends.length && participantSearch.trim() ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[500] rounded-2xl border border-[var(--border)] bg-white p-2 shadow-xl">
                  <div className="max-h-56 overflow-y-auto">
                    {filteredAddableFriends.length ? (
                      filteredAddableFriends.map((friend) => (
                        <form key={friend.id} action={addParticipantAction}>
                          <input type="hidden" name="plan_id" value={plan.id} />
                          <input type="hidden" name="participant_id" value={friend.id} />
                          <button className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-[var(--accent-soft)]">
                            <span>
                              <span className="block text-sm font-semibold">{friend.full_name}</span>
                              <span className="block text-xs text-[var(--muted)]">{friend.zid}</span>
                            </span>
                            <span className="text-xs font-semibold text-[var(--accent-strong)]">Add</span>
                          </button>
                        </form>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-[var(--muted)]">No matching friends.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-[var(--shadow)] backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={autoGenerateChoices}
              title="Auto-generate timetable"
              className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Auto
            </button>
            <button
              type="button"
              onClick={undoChoices}
              disabled={!history.length}
              title="Undo"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-lg transition disabled:opacity-40"
            >
              ↶
            </button>
            <button
              type="button"
              onClick={redoChoices}
              disabled={!future.length}
              title="Redo"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-lg transition disabled:opacity-40"
            >
              ↷
            </button>
            <button
              type="button"
              onClick={clearChoices}
              title="Clear all"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--danger)]/30 text-lg text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
            >
              ⌦
            </button>
          </div>
        </div>
      </section>

      <div className="relative z-0 grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
        <section className="space-y-5">
          <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] backdrop-blur-sm">
            <div className="mb-4 grid grid-cols-[56px_repeat(5,minmax(0,1fr))] gap-2">
              <div />
              {DAY_ORDER.map((day) => (
                <div key={day} className="rounded-2xl bg-[var(--card-strong)] px-3 py-2 text-center text-sm font-semibold">
                  {DAY_LABELS[day]}
                </div>
              ))}
            </div>

            <div className="relative grid grid-cols-[56px_repeat(5,minmax(0,1fr))] gap-2" style={{ minHeight: gridHeight }}>
              <div className="relative">
                {Array.from({ length: (END_MINUTES - START_MINUTES) / 60 + 1 }, (_, index) => {
                  const hour = 8 + index;
                  return (
                    <div
                      key={hour}
                      className="absolute left-0 text-[11px] text-[var(--muted)]"
                      style={{ top: (hour * 60 - START_MINUTES) * PIXELS_PER_MINUTE - 8 }}
                    >
                      {hour}:00
                    </div>
                  );
                })}
              </div>

              {DAY_ORDER.map((day) => (
                <div key={day} className="relative rounded-[28px] border border-[var(--border)] bg-white/70" style={{ height: gridHeight }}>
                  {Array.from({ length: (END_MINUTES - START_MINUTES) / 60 }, (_, index) => (
                    <div
                      key={`${day}-line-${index}`}
                      className="absolute left-0 right-0 border-t border-dashed border-[var(--border)]/50"
                      style={{ top: index * 60 * PIXELS_PER_MINUTE }}
                    />
                  ))}

                  {dragging?.classOptions.flatMap((option) =>
                    option.times
                      .filter((time) => time.day === day)
                      .map((time) => (
                        <button
                          key={`drag-${option.classId}-${time.timeId}`}
                          type="button"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            setChoice({
                              scopeType: dragging.scopeType,
                              participantUserId: dragging.participantUserId,
                              subjectCode: dragging.subjectCode,
                              activity: dragging.activity,
                              classId: option.classId,
                            });
                            setDragging(null);
                          }}
                          onClick={() => {
                            setChoice({
                              scopeType: dragging.scopeType,
                              participantUserId: dragging.participantUserId,
                              subjectCode: dragging.subjectCode,
                              activity: dragging.activity,
                              classId: option.classId,
                            });
                            setDragging(null);
                          }}
                          className="absolute left-1 right-1 rounded-xl border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)]/70 px-2 py-1 text-left"
                          style={{
                            top: (time.startMinutes - START_MINUTES) * PIXELS_PER_MINUTE,
                            height: (time.endMinutes - time.startMinutes) * PIXELS_PER_MINUTE,
                          }}
                        >
                          <p className="text-[10px] font-bold text-[var(--accent-strong)]">{option.section}</p>
                          <p className="text-[9px] text-[var(--accent-strong)]">{time.time}</p>
                        </button>
                      )),
                  )}

                  {visibleCalendarEntries.flatMap(({ choice, classOption }) =>
                    classOption.times
                      .filter((time) => time.day === day)
                      .map((time) => {
                        const commonGroup = commonSubjects.find(
                          (subject) => subject.subject.code === choice.subjectCode,
                        );
                        const participant =
                          choice.scopeType === "individual"
                            ? participants.find((candidate) => candidate.id === choice.participantUserId)
                            : null;
                        const colorClass =
                          choice.scopeType === "individual" && participant
                            ? participantColorMap.get(participant.id) ?? PARTICIPANT_COLORS[0]
                            : "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent)]/40";

                        return (
                          <div
                            key={`${choice.scopeType}-${choice.subjectCode}-${choice.activity}-${time.timeId}`}
                            className={`absolute left-1 right-1 overflow-hidden rounded-xl border px-2 py-1 shadow-sm ${colorClass}`}
                            style={{
                              top: (time.startMinutes - START_MINUTES) * PIXELS_PER_MINUTE,
                              height: (time.endMinutes - time.startMinutes) * PIXELS_PER_MINUTE,
                            }}
                          >
                            <p className="truncate text-[11px] font-bold leading-4">{choice.subjectCode}</p>
                            <p className="truncate text-[10px] leading-4">{choice.activity}</p>
                            <p className="truncate text-[10px] leading-4">{classOption.section}</p>
                            <p className="mt-1 truncate whitespace-nowrap text-[9px] leading-3">
                              {choice.scopeType === "common"
                                ? commonGroup?.participants.map((entry) => getInitials(entry.full_name)).join(" · ")
                                : participant
                                  ? getInitials(participant.full_name)
                                  : ""}
                            </p>
                          </div>
                        );
                      }),
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <form action={saveAction}>
              <input type="hidden" name="plan_id" value={plan.id} />
              <input type="hidden" name="planner_choices" value={JSON.stringify(choices)} />
              <button className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]">
                Save planner
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-2">
          <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Common subjects</h2>
            <div className="mt-4 space-y-4">
              {commonSubjects.length ? (
                commonSubjects.map((subject) => (
                  <div key={`common-${subject.subject.code}`} className="space-y-3 rounded-2xl bg-[var(--card-strong)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{subject.subject.code}</p>
                        <p className="text-xs text-[var(--muted)]">{subject.subject.name}</p>
                      </div>
                      <div className="flex gap-1">
                        {subject.participants.map((participant) => (
                          <span
                            key={participant.id}
                            title={participant.full_name}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent-strong)]"
                          >
                            {getInitials(participant.full_name)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {subject.activityOptions.map((activityGroup) =>
                      renderActivityCard("common", subject, activityGroup.activity, activityGroup.options, null),
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">No common subjects between participants yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Individual subjects</h2>
            <div className="mt-4 space-y-4">
              {individualSubjects.length ? (
                individualSubjects.map((subject) => (
                  <div key={`individual-${subject.participants[0]!.id}-${subject.subject.code}`} className="space-y-3 rounded-2xl bg-[var(--card-strong)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{subject.subject.code}</p>
                        <p className="text-xs text-[var(--muted)]">{subject.subject.name}</p>
                      </div>
                      <span
                        title={subject.participants[0]!.full_name}
                        className={`flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-[11px] font-bold ${
                          participantColorMap.get(subject.participants[0]!.id) ?? PARTICIPANT_COLORS[0]
                        }`}
                      >
                        {getInitials(subject.participants[0]!.full_name)}
                      </span>
                    </div>
                    {subject.activityOptions.map((activityGroup) =>
                      renderActivityCard(
                        "individual",
                        subject,
                        activityGroup.activity,
                        activityGroup.options,
                        subject.participants[0]!.id,
                      ),
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">No individual-only subjects in this term.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
