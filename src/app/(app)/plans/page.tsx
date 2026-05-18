import Link from "next/link";

import { TERM_LABELS } from "@/lib/constants";
import { getPlansIndexData } from "@/lib/data";

export default async function PlansIndexPage() {
  const { plans } = await getPlansIndexData();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          Timetables
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Your shared term planners</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Open an existing planner to keep arranging classes with your friends.
        </p>
      </section>

      <section className="grid gap-4">
        {plans.length ? (
          plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/plans/${plan.id}`}
              className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">{TERM_LABELS[plan.term]}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {(plan.participants ?? [])
                      .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant))
                      .map((participant) => participant.full_name)
                      .join(" · ")}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                  Open timetable
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-sm text-[var(--muted)]">
            No shared timetables yet. Create one from a friend&apos;s profile.
          </div>
        )}
      </section>
    </div>
  );
}
