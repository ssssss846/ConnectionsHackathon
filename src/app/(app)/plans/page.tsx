import Link from "next/link";

import { createPersonalPlanAction, deleteSharedPlanAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { PendingButton } from "@/components/pending-button";
import { TERMS, TERM_LABELS } from "@/lib/constants";
import { getPlansIndexData } from "@/lib/data";

export default async function PlansIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { plans } = await getPlansIndexData();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
            Timetables
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Your term planners</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Start with your own timetable, then add classmates when you are ready to compare options.
          </p>
        </div>

        <form
          action={createPersonalPlanAction}
          className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm"
        >
          <h2 className="text-xl font-semibold">Create timetable</h2>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <select
              name="term"
              className="min-h-12 flex-1 rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
              defaultValue="T1"
            >
              {TERMS.map((term) => (
                <option key={term} value={term}>
                  {TERM_LABELS[term]}
                </option>
              ))}
            </select>
            <PendingButton
              pendingLabel="Creating..."
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              <span aria-hidden="true" className="text-lg leading-none">+</span>
              New
            </PendingButton>
          </div>
        </form>
      </section>

      {params.notice ? <Notice tone="success" message={params.notice} /> : null}
      {params.error ? <Notice tone="error" message={params.error} /> : null}

      <section className="grid gap-4">
        {plans.length ? (
          plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)] backdrop-blur-sm"
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
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/plans/${plan.id}`}
                    className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent)] hover:text-white"
                  >
                    Open timetable
                  </Link>
                  <form action={deleteSharedPlanAction}>
                    <input type="hidden" name="plan_id" value={plan.id} />
                    <PendingButton
                      pendingLabel="Deleting..."
                      className="rounded-full border border-[var(--danger)]/30 px-3 py-1 text-xs font-semibold text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
                    >
                      Delete
                    </PendingButton>
                  </form>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-sm text-[var(--muted)]">
            No timetables yet. Create one above, then add friends from inside the planner.
          </div>
        )}
      </section>
    </div>
  );
}
