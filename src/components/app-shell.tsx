import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { APP_NAME } from "@/lib/constants";
import type { Profile } from "@/lib/types";

type AppShellProps = {
  profile: Profile | null;
  children: React.ReactNode;
};

export function AppShell({ profile, children }: AppShellProps) {
  const displayName = profile?.full_name?.trim() || profile?.username?.trim();

  return (
    <div className="app-shell">
      <header className="border-b border-[var(--border)] backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <Link href="/dashboard" className="inline-flex items-center gap-3" aria-label="Go to dashboard">
              <BrandLogo priority />
              <span>
                <span className="block text-lg font-semibold tracking-tight">{APP_NAME}</span>
                <span className="block text-sm text-[var(--muted)]">UNSW subject planning with your mates.</span>
              </span>
            </Link>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/dashboard" className="hover:text-[var(--accent)]">
              Dashboard
            </Link>
            <Link href="/plans" className="hover:text-[var(--accent)]">
              Timetables
            </Link>
            <Link href="/events" className="hover:text-[var(--accent)]">
              Events
            </Link>
            <Link href="/friends" className="hover:text-[var(--accent)]">
              Friends
            </Link>
            <Link href="/settings" className="hover:text-[var(--accent)]">
              Settings
            </Link>
            <form action="/api/signout" method="post">
              <button
                type="submit"
                className="rounded-full border border-[var(--border)] px-4 py-2 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {displayName ? `Log out ${displayName}` : "Log out"}
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
