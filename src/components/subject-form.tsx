"use client";

import { useActionState, useDeferredValue, useEffect, useState } from "react";

import { MAX_SUBJECTS_PER_TERM, TERMS, TERM_LABELS, type Term } from "@/lib/constants";
import type { FormState, SubjectSelection, SubjectsByTerm } from "@/lib/types";

const initialState: FormState = {};

type SubjectFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultSubjects: SubjectsByTerm;
  submitLabel: string;
  redirectTo?: string;
};

type SubjectFieldsProps = {
  defaultSubjects: SubjectsByTerm;
};

type SubjectSlot = SubjectSelection & {
  id: string;
  query: string;
};

type SuggestionsBySlot = Record<string, SubjectSelection[]>;
type StatusBySlot = Record<string, "idle" | "loading" | "error">;

function createSlot(term: Term, index: number, subject?: SubjectSelection): SubjectSlot {
  return {
    id: `${term}-${subject?.code ?? "new"}-${index}`,
    code: subject?.code ?? "",
    name: subject?.name ?? "",
    query: subject?.code ?? "",
  };
}

function buildInitialSlots(defaultSubjects: SubjectsByTerm) {
  return TERMS.reduce(
    (accumulator, term) => {
      const subjects = defaultSubjects[term];
      accumulator[term] = subjects.length
        ? subjects.map((subject, index) => createSlot(term, index, subject))
        : [];
      return accumulator;
    },
    {} as Record<Term, SubjectSlot[]>,
  );
}

export function SubjectFields({ defaultSubjects }: SubjectFieldsProps) {
  const [slotsByTerm, setSlotsByTerm] = useState<Record<Term, SubjectSlot[]>>(
    buildInitialSlots(defaultSubjects),
  );
  const [suggestionsBySlot, setSuggestionsBySlot] = useState<SuggestionsBySlot>({});
  const [statusBySlot, setStatusBySlot] = useState<StatusBySlot>({});
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const deferredSlotsByTerm = useDeferredValue(slotsByTerm);

  useEffect(() => {
    const activeSlot = TERMS.flatMap((term) => deferredSlotsByTerm[term]).find(
      (slot) => slot.id === activeSlotId,
    );

    if (!activeSlot) {
      return;
    }

    const normalizedQuery = activeSlot.query.trim();
    if (normalizedQuery.length < 2) {
      return;
    }

    const term = TERMS.find((candidate) =>
      deferredSlotsByTerm[candidate].some((slot) => slot.id === activeSlot.id),
    );
    if (!term) return;

    const controller = new AbortController();

    fetch(
      `/api/course-search?q=${encodeURIComponent(normalizedQuery)}&term=${encodeURIComponent(term)}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          courses?: SubjectSelection[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Course search failed.");
        }

        setSuggestionsBySlot((current) => ({
          ...current,
          [activeSlot.id]: payload.courses ?? [],
        }));
        setStatusBySlot((current) => ({ ...current, [activeSlot.id]: "idle" }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error(error);
        setSuggestionsBySlot((current) => ({ ...current, [activeSlot.id]: [] }));
        setStatusBySlot((current) => ({ ...current, [activeSlot.id]: "error" }));
      });

    return () => controller.abort();
  }, [activeSlotId, deferredSlotsByTerm]);

  function updateSlot(term: Term, slotId: string, nextValue: Partial<SubjectSlot>) {
    setSlotsByTerm((current) => ({
      ...current,
      [term]: current[term].map((slot) =>
        slot.id === slotId ? { ...slot, ...nextValue } : slot,
      ),
    }));
  }

  function selectSubject(term: Term, slotId: string, subject: SubjectSelection) {
    updateSlot(term, slotId, {
      code: subject.code,
      name: subject.name,
      query: `${subject.code} ${subject.name}`,
    });
    setSuggestionsBySlot((current) => ({ ...current, [slotId]: [] }));
    setActiveSlotId(null);
  }

  function addSlot(term: Term) {
    setSlotsByTerm((current) => {
      if (current[term].length >= MAX_SUBJECTS_PER_TERM) {
        return current;
      }

      return {
        ...current,
        [term]: [...current[term], createSlot(term, current[term].length)],
      };
    });
  }

  function removeSlot(term: Term, slotId: string) {
    setSlotsByTerm((current) => ({
      ...current,
      [term]: current[term].filter((slot) => slot.id !== slotId),
    }));
    setSuggestionsBySlot((current) => ({ ...current, [slotId]: [] }));
    if (activeSlotId === slotId) {
      setActiveSlotId(null);
    }
  }

  return (
      <div className="grid gap-4 lg:grid-cols-3">
        {TERMS.map((term) => (
          <section
            key={term}
            className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow)] backdrop-blur-sm"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{TERM_LABELS[term]}</h3>
              </div>
              <button
                type="button"
                onClick={() => addSlot(term)}
                disabled={slotsByTerm[term].length >= MAX_SUBJECTS_PER_TERM}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add subject
              </button>
            </div>

            <div className="space-y-3">
              {slotsByTerm[term].length ? (
                slotsByTerm[term].map((slot) => (
                  <div key={slot.id} className="rounded-2xl border border-[var(--border)] bg-white/70 p-2.5">
                    <input
                      type="hidden"
                      name={term}
                      value={slot.code && slot.name ? JSON.stringify({ code: slot.code, name: slot.name }) : ""}
                    />

                    {slot.code && slot.name ? (
                      <div className="rounded-xl bg-[var(--card-strong)] px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">{slot.code}</p>
                            <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{slot.name}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSlot(term, slot.id)}
                            className="text-[11px] font-semibold text-[var(--muted)] transition hover:text-[var(--danger)]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <input
                          value={slot.query}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateSlot(term, slot.id, {
                              query: value,
                              code: "",
                              name: "",
                            });
                            if (value.trim().length < 2) {
                              setSuggestionsBySlot((current) => ({ ...current, [slot.id]: [] }));
                              setStatusBySlot((current) => ({ ...current, [slot.id]: "idle" }));
                            } else {
                              setStatusBySlot((current) => ({ ...current, [slot.id]: "loading" }));
                            }
                            setActiveSlotId(slot.id);
                          }}
                          onFocus={() => setActiveSlotId(slot.id)}
                          placeholder="Search COMP1531 or Software Engineering Fundamentals"
                          className="w-full bg-transparent text-[13px] leading-5 outline-none"
                        />

                        {activeSlotId === slot.id && suggestionsBySlot[slot.id]?.length ? (
                          <div className="mt-2 space-y-1 rounded-2xl border border-[var(--border)] bg-white p-1.5">
                            {suggestionsBySlot[slot.id].map((subject) => (
                              <button
                                key={subject.code}
                                type="button"
                                onClick={() => selectSubject(term, slot.id, subject)}
                                className="block w-full rounded-xl px-2.5 py-1.5 text-left text-[13px] transition hover:bg-[var(--accent-soft)]"
                              >
                                <span className="font-semibold">{subject.code}</span> {subject.name}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {activeSlotId === slot.id && statusBySlot[slot.id] === "loading" ? (
                          <p className="mt-1.5 text-[11px] text-[var(--muted)]">Searching UNSW courses...</p>
                        ) : null}

                        {activeSlotId === slot.id && statusBySlot[slot.id] === "error" ? (
                          <p className="mt-1.5 text-[11px] text-[var(--danger)]">
                            Could not search courses right now. Try again in a moment.
                          </p>
                        ) : null}

                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeSlot(term, slot.id)}
                            className="text-[11px] font-semibold text-[var(--muted)] transition hover:text-[var(--danger)]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                  No subjects added yet for {TERM_LABELS[term]}.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
  );
}

export function SubjectForm({
  action,
  defaultSubjects,
  submitLabel,
  redirectTo,
}: SubjectFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}

      <SubjectFields defaultSubjects={defaultSubjects} />

      {state.error ? (
        <p className="rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
