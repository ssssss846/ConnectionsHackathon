export default function AppLoading() {
  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)]">
        <div className="h-4 w-36 animate-pulse rounded-full bg-[var(--card-strong)]" />
        <div className="mt-5 h-9 w-full max-w-xl animate-pulse rounded-2xl bg-[var(--card-strong)]" />
        <div className="mt-4 h-4 w-full max-w-2xl animate-pulse rounded-full bg-[var(--card-strong)]" />
        <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-[var(--card-strong)]" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)]"
          >
            <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--card-strong)]" />
            <div className="mt-4 h-16 animate-pulse rounded-2xl bg-[var(--card-strong)]" />
          </div>
        ))}
      </section>
    </div>
  );
}
