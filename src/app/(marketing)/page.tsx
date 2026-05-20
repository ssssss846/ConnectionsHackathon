import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { APP_NAME } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="app-shell">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-12 sm:px-8">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <BrandLogo size="hero" priority />
            <span className="inline-flex rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--muted)] backdrop-blur-sm">
              Built for UNSW students first
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-[var(--foreground)] sm:text-6xl">
                Plan uni life with the people already around you.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
                {APP_NAME} helps UNSW students coordinate courses, timetables, friends, and events in one place.
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
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-[var(--card-strong)] p-4">
                <h3 className="font-semibold">Plan your courses and timetables with friends</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Compare subjects, build shared term planners, and coordinate classes before the week fills up.
                </p>
              </div>
              <div className="rounded-3xl bg-[var(--card-strong)] p-4">
                <h3 className="font-semibold">Organise your free-time social life with friends</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  See shared free windows and find events that actually fit everyone&apos;s calendar.
                </p>
              </div>
              <div className="rounded-3xl bg-[var(--card-strong)] p-4">
                <h3 className="font-semibold">Discover mutuals taking the same degree</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Spot friends in your degree and find people who are likely moving through the same path.
                </p>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
