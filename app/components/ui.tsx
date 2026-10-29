import type { ReactNode } from "react";

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PageTitle({ kicker, title, lede }: { kicker?: string; title: string; lede?: string }) {
  return (
    <header className="mb-8 max-w-2xl">
      {kicker ? <p className="text-xs uppercase tracking-[0.16em] text-muted">{kicker}</p> : null}
      <h1 className="mt-2 font-display text-5xl italic leading-none tracking-tight">{title}</h1>
      {lede ? <p className="mt-4 text-lg text-muted">{lede}</p> : null}
    </header>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">{children}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.14em] text-muted">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const controlClass =
  "w-full rounded-xl border border-line bg-card px-3 py-2 outline-none focus:border-rust";

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-paper hover:bg-rust">
      {children}
    </button>
  );
}
