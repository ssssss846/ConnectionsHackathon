"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { DEGREE_OPTIONS, TERMS, TERM_LABELS } from "@/lib/constants";
import type { FormState } from "@/lib/types";

const initialState: FormState = {};

type AuthFormProps = {
  mode: "login" | "signup";
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const isSignUp = mode === "signup";
  const enrolmentYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 13 }, (_, index) => currentYear + 1 - index);
  }, []);

  return (
    <form action={formAction} className="space-y-5">
      {isSignUp ? (
        <>
          <div>
            <label htmlFor="full_name" className="mb-2 block text-sm font-medium text-[var(--muted)]">
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              placeholder="Samuel Rubianto"
              className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label htmlFor="zid" className="mb-2 block text-sm font-medium text-[var(--muted)]">
              zID
            </label>
            <input
              id="zid"
              name="zid"
              placeholder="z1234567"
              className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="degree" className="mb-2 block text-sm font-medium text-[var(--muted)]">
              Degree
            </label>
            <select
              id="degree"
              name="degree"
              className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select your degree
              </option>
              {DEGREE_OPTIONS.map((degree) => (
                <option key={degree} value={degree}>
                  {degree}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="enrolled_year" className="mb-2 block text-sm font-medium text-[var(--muted)]">
                Enrolment year
              </label>
              <select
                id="enrolled_year"
                name="enrolled_year"
                className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                required
                defaultValue={new Date().getFullYear()}
              >
                {enrolmentYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="enrolled_term" className="mb-2 block text-sm font-medium text-[var(--muted)]">
                Enrolment term
              </label>
              <select
                id="enrolled_term"
                name="enrolled_term"
                className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                required
                defaultValue="T1"
              >
                {TERMS.map((term) => (
                  <option key={term} value={term}>
                    {TERM_LABELS[term]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : null}

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-[var(--muted)]">
          UNSW email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="z1234567@ad.unsw.edu.au"
          className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
          autoComplete="email"
          required
        />
        <p className="mt-2 text-xs text-[var(--muted)]">
          Use your UNSW account email ending in <span className="font-medium">unsw.edu.au</span>.
        </p>
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-[var(--muted)]">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 8 characters"
            className="w-full rounded-2xl border border-[var(--border)] bg-white/90 py-3 pl-4 pr-12 outline-none transition focus:border-[var(--accent)]"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--card-strong)] hover:text-[var(--accent)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
                <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5 0 9 4.5 10 8a12 12 0 0 1-3 4.7" />
                <path d="M6.6 6.6C4.4 8 3 10.2 2 12c1 3.5 5 8 10 8 1.8 0 3.5-.6 5-1.5" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Working..." : isSignUp ? "Create account" : "Log in"}
      </button>

      <p className="text-sm text-[var(--muted)]">
        {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={isSignUp ? "/login" : "/signup"}
          className="font-semibold text-[var(--accent)]"
        >
          {isSignUp ? "Log in here" : "Sign up here"}
        </Link>
      </p>
    </form>
  );
}
