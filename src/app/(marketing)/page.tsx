import Link from "next/link";

import { APP_NAME, TERMS, TERM_LABELS } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="app-shell">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-12 sm:px-8">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--muted)] backdrop-blur-sm">
              Built for UNSW students first
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-[var(--foreground)] sm:text-6xl">
                Make term plans with your mates before the timetable chaos begins.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
                {APP_NAME} helps friends compare yearly subjects, spot common courses, and build a
                shared term plan together before class registration opens.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white/80 px-6 py-3 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Log in
              </Link>
            </div>

          </div>

          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                  MVP features
                </p>
                <h2 className="mt-2 text-2xl font-semibold">What you can do first</h2>
              </div>
              <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                Hackathon-friendly
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-[var(--card-strong)] p-4">
                <h3 className="font-semibold">Yearly subject setup</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Enter up to four subjects for each of{" "}
                  {TERMS.map((term) => TERM_LABELS[term]).join(", ")}.
                </p>
              </div>
              <div className="rounded-3xl bg-[var(--card-strong)] p-4">
                <h3 className="font-semibold">Friend requests and comparison</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Search by username, add friends, and immediately see which subjects overlap.
                </p>
              </div>
              <div className="rounded-3xl bg-[var(--card-strong)] p-4">
                <h3 className="font-semibold">Shared term planning</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Create a lightweight plan with notes and shared subjects for a single term.
                </p>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
