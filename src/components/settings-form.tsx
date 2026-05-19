"use client";

import { useActionState, useState } from "react";

import { INTEREST_OPTIONS, TERMS, TERM_LABELS, WEEK_DAYS, type Term } from "@/lib/constants";
import { formatMinutes } from "@/lib/timetable";
import type { FormState, TimetableBlock, TimetableSource } from "@/lib/types";

type EditableBlock = {
  id: string;
  day: number;
  start: string;
  end: string;
  label: string;
  location: string;
};

type SettingsFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  currentTerm: Term;
  selectedInterests: string[];
  timetableSource: TimetableSource | null;
  timetableBlocks: TimetableBlock[];
};

const initialState: FormState = {};

function minutesToInput(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function createBlock(index: number): EditableBlock {
  return {
    id: `new-${Date.now()}-${index}`,
    day: 1,
    start: "09:00",
    end: "10:00",
    label: "Class",
    location: "",
  };
}

export function SettingsForm({
  action,
  currentTerm,
  selectedInterests,
  timetableSource,
  timetableBlocks,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [term, setTerm] = useState<Term>(currentTerm);
  const [sourceType, setSourceType] = useState<"manual" | "calendar_url">(
    timetableSource?.source_type === "calendar_url" ? "calendar_url" : "manual",
  );
  const [blocks, setBlocks] = useState<EditableBlock[]>(
    timetableBlocks.map((block) => ({
      id: block.id ?? `${block.day_of_week}-${block.start_minutes}-${block.end_minutes}`,
      day: block.day_of_week,
      start: minutesToInput(block.start_minutes),
      end: minutesToInput(block.end_minutes),
      label: block.label,
      location: block.location ?? "",
    })),
  );

  function updateBlock(id: string, nextValue: Partial<EditableBlock>) {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...nextValue } : block)),
    );
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <h2 className="text-2xl font-semibold">Interests</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Pick the kinds of events you want recommended. When you choose friends, the app looks for overlap across the group.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => (
            <label
              key={interest}
              className="cursor-pointer rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold capitalize text-[var(--muted)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)] has-[:checked]:text-[var(--accent-strong)]"
            >
              <input
                type="checkbox"
                name="interests"
                value={interest}
                defaultChecked={selectedInterests.includes(interest)}
                className="sr-only"
              />
              {interest}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <h2 className="text-2xl font-semibold">Current term timetable</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Add busy blocks manually for one term, or paste your year-long myUNSW/Google Calendar feed link once and reuse it across terms.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold">
              Term
              <select
                name="term"
                value={term}
                onChange={(event) => setTerm(event.target.value as Term)}
                className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none"
              >
                {TERMS.map((termOption) => (
                  <option key={termOption} value={termOption}>
                    {TERM_LABELS[termOption]}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)] has-[:checked]:text-[var(--accent-strong)]">
                <input
                  type="radio"
                  name="source_type"
                  value="manual"
                  checked={sourceType === "manual"}
                  onChange={() => setSourceType("manual")}
                  className="sr-only"
                />
                Manual timetable
              </label>
              <label className="cursor-pointer rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)] has-[:checked]:text-[var(--accent-strong)]">
                <input
                  type="radio"
                  name="source_type"
                  value="calendar_url"
                  checked={sourceType === "calendar_url"}
                  onChange={() => setSourceType("calendar_url")}
                  className="sr-only"
                />
                Calendar link
              </label>
            </div>

            {sourceType === "calendar_url" ? (
              <label className="block text-sm font-semibold">
                Public calendar feed URL
                <input
                  name="calendar_url"
                  defaultValue={timetableSource?.calendar_url ?? ""}
                  placeholder="webcal://my.unsw.edu.au/cal/pttd/your-link.ics"
                  className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none"
                />
              </label>
            ) : (
              <input type="hidden" name="calendar_url" value={timetableSource?.calendar_url ?? ""} />
            )}
          </div>
        </div>

        {sourceType === "manual" ? (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold">Busy blocks</h3>
              <button
                type="button"
                onClick={() => setBlocks((current) => [...current, createBlock(current.length)])}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Add block
              </button>
            </div>

            {blocks.map((block) => (
              <div key={block.id} className="grid gap-2 rounded-3xl border border-[var(--border)] bg-white/80 p-3 md:grid-cols-[1fr_1fr_1fr_1.4fr_1.4fr_auto]">
                <select
                  value={block.day}
                  onChange={(event) => updateBlock(block.id, { day: Number(event.target.value) })}
                  className="h-10 rounded-full border border-[var(--border)] bg-white px-3 text-sm"
                >
                  {WEEK_DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.short}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={block.start}
                  onChange={(event) => updateBlock(block.id, { start: event.target.value })}
                  className="h-10 rounded-full border border-[var(--border)] bg-white px-3 text-sm"
                />
                <input
                  type="time"
                  value={block.end}
                  onChange={(event) => updateBlock(block.id, { end: event.target.value })}
                  className="h-10 rounded-full border border-[var(--border)] bg-white px-3 text-sm"
                />
                <input
                  value={block.label}
                  onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                  placeholder="Class or work"
                  className="h-10 rounded-full border border-[var(--border)] bg-white px-3 text-sm"
                />
                <input
                  value={block.location}
                  onChange={(event) => updateBlock(block.id, { location: event.target.value })}
                  placeholder="Location"
                  className="h-10 rounded-full border border-[var(--border)] bg-white px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="rounded-full px-3 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--danger)]"
                >
                  Remove
                </button>
                <input
                  type="hidden"
                  name="timetable_blocks"
                  value={JSON.stringify(block)}
                />
              </div>
            ))}

            {blocks.length ? null : (
              <p className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                No busy times saved. Recommendations will assume you are free from {formatMinutes(8 * 60)} to {formatMinutes(22 * 60)}.
              </p>
            )}
          </div>
        ) : null}
      </section>

      {state.error ? (
        <p className="rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save interests and timetable"}
      </button>
    </form>
  );
}
