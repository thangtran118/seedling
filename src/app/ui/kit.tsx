// Server-safe presentational components shared by the app screens.
import Link from "next/link";
import type { ReactNode } from "react";
import { LESSONS, PHASE_LABEL, STATUS_LABEL, type DisplayStatus, type SessionPhase } from "@/lib/domain";

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="flex items-center gap-3 pb-2">
      {back && (
        <Link href={back} aria-label="Quay lại" className="-ml-2 rounded-full p-2 text-muted hover:bg-line/40">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M12.5 4.5 7 10l5.5 5.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      )}
      <h1 className="flex-1 truncate text-2xl font-bold tracking-tight text-ink">{title}</h1>
      {action}
    </header>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, href, className = "" }: { children: ReactNode; href?: string; className?: string }) {
  const cls = `block rounded-2xl border border-line bg-surface p-3.5 ${className}`;
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-muted/50 active:bg-line/30`}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">{children}</p>
  );
}

const STATUS_TONE: Record<DisplayStatus, string> = {
  moi_quen: "bg-line/50 text-ink",
  goi_mo: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  dang_hoc: "bg-accent/15 text-accent",
  baptem: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  tu_choi: "bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// Seven small squares, filled up through the highest lesson heard (progress is sequential: no gaps).
export function LessonDots({ heard, size = "sm" }: { heard: number[]; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-5 w-5 text-[10px]" : "h-8 w-8 text-sm";
  return (
    <span className="inline-flex gap-1" aria-label={`Đã nghe mảnh ${heard.join(", ") || "chưa có"}`}>
      {LESSONS.map((l) => (
        <span
          key={l}
          className={`inline-flex ${box} items-center justify-center rounded font-semibold ${
            heard.includes(l) ? "bg-accent text-on-accent" : "border border-line text-muted"
          }`}
        >
          {l}
        </span>
      ))}
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const cls = variant === "primary" ? "bg-accent text-on-accent" : "border border-line bg-surface text-ink";
  return (
    <Link
      href={href}
      className={`flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold ${cls}`}
    >
      {children}
    </Link>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "success"; children: ReactNode }) {
  const cls = {
    info: "bg-accent/10 text-ink",
    warn: "bg-amber-500/15 text-ink",
    success: "bg-accent/15 text-ink",
  }[tone];
  return <div className={`rounded-lg px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function Loading() {
  return <p className="py-6 text-center text-sm text-muted">Đang tải…</p>;
}

// ---------- session phases ----------

export const PHASE_TONE: Record<SessionPhase, { text: string; bg: string; soft: string; border: string }> = {
  live: { text: "text-live", bg: "bg-live", soft: "bg-live/10", border: "border-live" },
  upcoming: { text: "text-plan", bg: "bg-plan", soft: "bg-plan/10", border: "border-plan" },
  done: { text: "text-done", bg: "bg-done", soft: "bg-done/10", border: "border-done" },
  cancelled: { text: "text-muted", bg: "bg-muted", soft: "bg-line/40", border: "border-line" },
};

// Pulsing dot for sessions in progress (the pulse stops under prefers-reduced-motion).
export function LiveDot({ className = "h-2.5 w-2.5" }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} aria-hidden>
      <span className="live-ping absolute inset-0 rounded-full bg-live" />
      <span className="relative inline-flex h-full w-full rounded-full bg-live" />
    </span>
  );
}

// Shape carries the phase too (not color alone): ring = not started, dot = completed, dash = cancelled.
export function PhaseMark({ phase }: { phase: SessionPhase }) {
  if (phase === "live") return <LiveDot className="h-2 w-2" />;
  const shape = {
    upcoming: "h-2 w-2 rounded-full border-[1.5px] border-plan",
    done: "h-2 w-2 rounded-full bg-done",
    cancelled: "h-[2px] w-2 rounded-full bg-muted",
  }[phase];
  return <span className={`inline-block shrink-0 ${shape}`} aria-hidden />;
}

export function PhaseBadge({ phase }: { phase: SessionPhase }) {
  const t = PHASE_TONE[phase];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${t.soft} ${t.text}`}
    >
      <PhaseMark phase={phase} />
      {PHASE_LABEL[phase]}
    </span>
  );
}

export function PhaseLegend({ phases }: { phases: SessionPhase[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {phases.map((p) => (
        <li key={p} className="inline-flex items-center gap-1.5">
          <PhaseMark phase={p} />
          {PHASE_LABEL[p]}
        </li>
      ))}
    </ul>
  );
}

// ---------- numbers ----------

// "+2 so với tuần trước" under a weekly count.
export function StatTile({
  label,
  value,
  sub,
  href,
  alert,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  alert?: boolean; // the number needs attention: a warning glyph, never color alone
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  const body = (
    <>
      <p className={`font-medium text-muted ${sm ? "text-[11px] leading-tight" : "text-xs"}`}>{label}</p>
      <p
        className={`flex items-baseline gap-1.5 font-bold tabular-nums tracking-tight text-ink ${sm ? "mt-0.5 text-2xl" : "mt-1 text-3xl"}`}
      >
        {value}
        {alert && (
          <span className="text-base text-late" aria-label="cần chú ý">
            ▲
          </span>
        )}
      </p>
      {sub && <p className={`mt-0.5 text-muted ${sm ? "text-[11px] leading-tight" : "text-xs"}`}>{sub}</p>}
    </>
  );
  const cls = `rounded-2xl border bg-surface ${sm ? "p-3" : "p-3.5"} ${alert ? "border-late/50" : "border-line"}`;
  return href ? (
    <Link href={href} className={`${cls} block transition-colors hover:border-muted/50 active:bg-line/30`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ---------- phone actions ----------

// The one action that must stay under the thumb on phones; hidden from md up, where it sits in the page.
export function Fab({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex h-14 items-center gap-2 rounded-full bg-accent pr-5 pl-4 text-base font-semibold text-on-accent shadow-lg shadow-black/20 active:scale-[0.98] md:hidden"
    >
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {children}
    </Link>
  );
}
