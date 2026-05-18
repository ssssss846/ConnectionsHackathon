"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { FormState } from "@/lib/types";

const initialState: FormState = {};

type AuthFormProps = {
  mode: "login" | "signup";
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignUp = mode === "signup";

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
        <input
          id="password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
        />
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
