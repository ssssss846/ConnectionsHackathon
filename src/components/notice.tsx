type NoticeProps = {
  tone?: "success" | "error" | "info";
  message: string;
};

export function Notice({ tone = "info", message }: NoticeProps) {
  const toneClasses =
    tone === "error"
      ? "border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]"
      : tone === "success"
        ? "border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        : "border-[var(--border)] bg-white/70 text-[var(--muted)]";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses}`}>
      {message}
    </div>
  );
}
