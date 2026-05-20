import { AuthForm } from "@/components/auth-form";
import { signInAction } from "@/app/actions";

export default function LoginPage() {
  return (
    <div className="app-shell">
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-12">
        <section className="w-full rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[var(--shadow)] backdrop-blur-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
            Welcome back
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Log in to your planner</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Use your UNSW email and password to open your subject dashboard and shared term plans.
          </p>

          <div className="mt-8">
            <AuthForm mode="login" action={signInAction} />
          </div>
        </section>
      </main>
    </div>
  );
}
