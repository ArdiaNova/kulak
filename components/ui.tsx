import type { ReactNode } from "react";

/** Small shared primitives: cards, chips, buttons, money. */

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const TONES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  delivered: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  paying: "bg-blue-50 text-blue-700 ring-blue-200",
  approved: "bg-blue-50 text-blue-700 ring-blue-200",
  pending_approval: "bg-amber-50 text-amber-700 ring-amber-200",
  drafted: "bg-neutral-50 text-neutral-600 ring-neutral-200",
  denied: "bg-red-50 text-red-700 ring-red-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  payment_failed: "bg-red-50 text-red-700 ring-red-200",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  low: "bg-amber-50 text-amber-700 ring-amber-200",
  critical: "bg-red-50 text-red-700 ring-red-200",
  auto: "bg-blue-50 text-blue-700 ring-blue-200",
  manual: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

export function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  const palette = TONES[tone] ?? "bg-neutral-100 text-neutral-600 ring-neutral-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${palette}`}
    >
      {children}
    </span>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  pending_approval: "pending",
  payment_failed: "failed",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function Button({
  children,
  onClick,
  busy = false,
  disabled = false,
  variant = "secondary",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  title?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700 border-transparent"
      : variant === "danger"
        ? "bg-white text-red-600 hover:bg-red-50 border-red-200"
        : variant === "ghost"
          ? "bg-transparent text-neutral-600 hover:bg-neutral-100 border-transparent"
          : "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-200";

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {busy && (
        <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-neutral-500">{children}</div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-200/70 ${className}`} />;
}
