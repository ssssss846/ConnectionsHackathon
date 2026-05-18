import Link from "next/link";

import { saveSubjectsAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubjectForm } from "@/components/subject-form";
import { TERMS, TERM_LABELS } from "@/lib/constants";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { profile, subjectsByTerm, sharedFriendsBySubject } = await getDashboardData();
  const params = await searchParams;

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
            Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Hey {profile.full_name}, here is your year at a glance.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Keep your subjects current so your friends can compare overlap and plan the term with you.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/friends"
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Manage friends
            </Link>
          </div>
        </div>

        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
          <h2 className="text-xl font-semibold">Current subjects</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {TERMS.map((term) => (
              <div key={term} className="rounded-3xl bg-[var(--card-strong)] p-4">
                <p className="text-sm font-semibold text-[var(--muted)]">{TERM_LABELS[term]}</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {subjectsByTerm[term].length ? (
                    subjectsByTerm[term].map((subject) => (
                      <li key={subject.code} className="rounded-xl bg-white/90 px-3 py-2">
                        <p className="text-sm font-bold">{subject.code}</p>
                        <p className="text-xs leading-5 text-[var(--muted)]">{subject.name}</p>
                        {(sharedFriendsBySubject.get(`${term}:${subject.code}`) ?? []).length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                              {(sharedFriendsBySubject.get(`${term}:${subject.code}`) ?? []).map((friend) => (
                                <span
                                  key={`${subject.code}-${friend.friendId}`}
                                  title={friend.fullName}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent-strong)]"
                                >
                                  {friend.initials}
                                </span>
                              ))}
                          </div>
                        ) : null}
                      </li>
                    ))
                  ) : (
                    <li className="text-[var(--muted)]">No subjects saved yet.</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {params.notice ? <Notice tone="success" message={params.notice} /> : null}
      {params.error ? <Notice tone="error" message={params.error} /> : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Update your yearly subjects</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Search real UNSW subjects and add up to four per term.
          </p>
        </div>
        <SubjectForm
          action={saveSubjectsAction}
          defaultSubjects={subjectsByTerm}
          submitLabel="Save subjects"
          redirectTo="/dashboard?notice=Subjects%20saved."
        />
      </section>
    </div>
  );
}
