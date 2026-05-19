"use client";

import { useEffect, useState } from "react";

type NoticeProps = {
  tone?: "success" | "error" | "info";
  message: string;
};

export function Notice({ tone = "info", message }: NoticeProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const closeTimer = window.setTimeout(() => {
      setIsClosing(true);
    }, 3500);
    const removeTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, 3720);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  const toneClasses =
    tone === "error"
      ? "border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]"
      : tone === "success"
        ? "border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        : "border-[var(--border)] bg-white/95 text-[var(--foreground)]";

  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-50 w-full max-w-2xl -translate-x-1/2 px-4">
      <div
        className={`toast-message pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow)] backdrop-blur-sm ${isClosing ? "toast-message-out" : "toast-message-in"} ${toneClasses}`}
      >
        {message}
      </div>
    </div>
  );
}
