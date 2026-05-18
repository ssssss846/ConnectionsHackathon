import Link from "next/link";

import { createSharedPlanAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { TERMS, TERM_LABELS } from "@/lib/constants";
import { getFriendDetail } from "@/lib/data";

export default async function FriendDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ friendId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ friendId }, query] = await Promise.all([params, searchParams]);
  const { friendProfile, friendSubjects, commonSubjects, plans } = await getFriendDetail(friendId);

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
          <Link href="/friends" className="text-sm font-medium text-[var(--accent)]">
            Back to friends
          </Link>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{friendProfile.full_name}</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {friendProfile.zid} · {friendProfile.unsw_email}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Compare your subjects with {friendProfile.full_name} and start a term plan together.
          </p>
        </div>

        <form
          action={createSharedPlanAction}
          className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm"
        >
          <input type="hidden" name="friend_id" value={friendProfile.id} />
          <h2 className="text-xl font-semibold">Create shared plan</h2>
          <div className="mt-5 space-y-4">
            <select
              name="term"
              className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
              defaultValue="T1"
            >
              {TERMS.map((term) => (
                <option key={term} value={term}>
                  {TERM_LABELS[term]}
                </option>
              ))}
            </select>
            <button className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]">
              Start plan
            </button>
          </div>
        </form>
      </section>

      {query.notice ? <Notice tone="success" message={query.notice} /> : null}
      {query.error ? <Notice tone="error" message={query.error} /> : null}

      <section className="grid gap-5 lg:grid-cols-3">
        {TERMS.map((term) => (
          <div
            key={term}
            className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm"
          >
            <h2 className="text-xl font-semibold">{TERM_LABELS[term]}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Their enrolled subjects</p>
            <ul className="mt-4 space-y-2 text-sm">
              {friendSubjects[term].length ? (
                friendSubjects[term].map((subject) => (
                  <li key={subject.code} className="rounded-2xl bg-[var(--card-strong)] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{subject.code}</p>
                        <p className="text-xs text-[var(--muted)]">{subject.name}</p>
                      </div>
                      {commonSubjects[term].some((common) => common.code === subject.code) ? (
                        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-strong)]">
                          Shared with you
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-[var(--muted)]">No subjects listed.</li>
              )}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm">
        <h2 className="text-xl font-semibold">Existing shared plans</h2>
        <div className="mt-4 space-y-3">
          {plans.length ? (
            plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/plans/${plan.id}`}
                className="block rounded-2xl bg-[var(--card-strong)] px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <p className="font-semibold">{TERM_LABELS[plan.term]} timetable</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Open shared planner
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No shared plans yet for this friendship.</p>
          )}
        </div>
      </section>
    </div>
  );
}
