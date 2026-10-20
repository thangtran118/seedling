import Link from "next/link";
import type { SessionListItem } from "@/lib/access/sessions";
import {
  dayKey,
  formatDuration,
  formatTime,
  SESSION_LIVE_MS,
  sessionPhase,
  WEEKDAY_SHORT,
  weekdayIndex,
} from "@/lib/domain";
import { LiveDot, PHASE_TONE, PhaseBadge } from "./kit";

const names = (xs: { name: string }[]) => xs.map((x) => x.name).join(", ");

// One session as a row: time on the left, a stripe in the phase color, people on the right.
export function SessionCard({
  s,
  note,
  now = new Date(),
  showDate = true,
}: {
  s: SessionListItem;
  note?: string;
  now?: Date;
  showDate?: boolean;
}) {
  const phase = sessionPhase(s.state, s.startsAt, now);
  const tone = PHASE_TONE[phase];
  const key = dayKey(s.startsAt);
  return (
    <Link
      href={`/ca/${s.id}`}
      className={`flex gap-3 rounded-2xl border bg-surface p-3 transition-colors hover:border-muted/50 active:bg-line/30 ${
        phase === "live" ? "border-live/40" : "border-line"
      }`}
    >
      <div className="flex w-12 shrink-0 flex-col items-center justify-center text-center">
        <span
          className={`text-base font-bold tabular-nums ${phase === "cancelled" ? "text-muted line-through" : "text-ink"}`}
        >
          {formatTime(s.startsAt)}
        </span>
        {showDate && (
          <span className="text-[11px] text-muted">
            {WEEKDAY_SHORT[weekdayIndex(key)]} {key.slice(8)}/{key.slice(5, 7)}
          </span>
        )}
      </div>
      <span
        className={`w-1 shrink-0 rounded-full ${tone.bg} ${phase === "upcoming" ? "opacity-40" : ""}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className={`truncate font-semibold ${phase === "cancelled" ? "text-muted line-through" : "text-ink"}`}>
            {names(s.listeners)}
          </span>
          <PhaseBadge phase={phase} />
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {s.locationLabel ?? "Chưa ghi nơi gặp"} · {names(s.members)}
        </p>
        {note && <p className="mt-1 text-sm font-medium text-accent">{note}</p>}
      </div>
    </Link>
  );
}

// Hero card for a session in progress: what the area is doing right now.
export function LiveSessionCard({ s, now = new Date() }: { s: SessionListItem; now?: Date }) {
  const start = new Date(s.startsAt).getTime();
  const elapsed = now.getTime() - start;
  const progress = Math.min(100, Math.max(4, (elapsed / SESSION_LIVE_MS) * 100));
  return (
    <Link
      href={`/ca/${s.id}`}
      className="relative block overflow-hidden rounded-2xl border border-live/40 bg-live/[0.04] p-4 shadow-sm transition-colors hover:border-live/70"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-live">
          <LiveDot />
          Đang diễn ra
        </span>
        <span className="text-xs tabular-nums text-muted">
          từ {formatTime(s.startsAt)} · {formatDuration(elapsed)}
        </span>
      </div>
      <p className="mt-2 text-lg font-bold leading-snug text-ink">{names(s.listeners)}</p>
      <p className="mt-0.5 text-sm text-muted">{s.locationLabel ?? "Chưa ghi nơi gặp"}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.members.map((m) => (
          <span key={m.id} className="rounded-full bg-sunken px-2 py-0.5 text-xs text-ink">
            {m.name}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-live/10" aria-hidden>
        <div className="h-full bg-live" style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}
