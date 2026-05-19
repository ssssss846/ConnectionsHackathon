"use client";

import Link from "next/link";
import { useActionState } from "react";

import { INTEREST_OPTIONS } from "@/lib/constants";
import type { FormState } from "@/lib/types";

type OnboardingInterestsFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

const initialState: FormState = {};

export function OnboardingInterestsForm({ action }: OnboardingInterestsFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pick your interests</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            These help tune event recommendations and group plans.
          </p>
        </div>
        <Link
          href="#course-setup"
          className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Skip
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map((interest) => (
          <label
            key={interest}
            className="cursor-pointer rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold capitalize text-[var(--muted)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)] has-[:checked]:text-[var(--accent-strong)]"
          >
            <input type="checkbox" name="interests" value={interest} className="sr-only" />
            {interest}
          </label>
        ))}
      </div>

      {state.error ? (
        <p className="mt-4 rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save interests"}
      </button>
    </form>
  );
}
