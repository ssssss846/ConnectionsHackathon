import Link from "next/link";

import { Notice } from "@/components/notice";
import { TimetableView } from "@/components/timetable-view";
import { TERMS, TERM_LABELS, calculateStudyProgression } from "@/lib/constants";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { profile, subjectsByTerm, sharedFriendsBySubject, timetableBlocks } =
    await getDashboardData();
  const params = await searchParams;
  const studyProgression = calculateStudyProgression({
    enrolledYear: profile.enrolled_year,
    enrolledTerm: profile.enrolled_term,
  });

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
          {profile.degree || studyProgression ? (
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
              {profile.degree ? (
                <span className="rounded-full bg-[var(--card-strong)] px-3 py-2">{profile.degree}</span>
              ) : null}
              {studyProgression ? (
                <span className="rounded-full bg-[var(--card-strong)] px-3 py-2">
                  Year {studyProgression.year}, term {studyProgression.term}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/events"
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Find events together
            </Link>
            <Link
              href="/settings"
              className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Update settings
            </Link>
            <Link
              href="/friends#same-degree"
              className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Find mutuals
            </Link>
          </div>
        </div>

        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
          <h2 className="text-xl font-semibold">Current subjects</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
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
          <h2 className="text-2xl font-semibold">Timetable calendar</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Your saved busy times are used to find shared free windows with friends. The calendar shows dated imports on their real dates and manual blocks as regular weekly classes.
          </p>
        </div>
        <TimetableView blocks={timetableBlocks} />
        <Link
          href="/settings"
          className="inline-flex rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Edit timetable and courses
        </Link>
      </section>
    </div>
  );
}
