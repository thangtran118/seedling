import Link from "next/link";
import type { SessionListItem } from "@/lib/access/sessions";
import { dayKey, formatTime, sessionPhase, WEEKDAY_SHORT, weekdayIndex } from "@/lib/domain";
import { KindIcon, PHASE_TONE, PhaseBadge } from "./kit";

const names = (xs: { name: string }[]) => xs.map((x) => x.name).join(", ");

// Listener names, each followed by the mảnh to share next when the viewer may see it: "Lan M4, Hùng M2".
function ListenerNames({ listeners }: { listeners: SessionListItem["listeners"] }) {
  return (
    <>
      {listeners.map((l, i) => (
        <span key={l.id}>
          {i > 0 && ", "}
          {l.name}
          {l.nextLesson != null && (
            <span
              className="ml-1 inline-flex items-center rounded-md bg-done/15 px-1.5 align-[1px] text-[11px] font-bold tabular-nums text-done"
              aria-label={`kế tiếp mảnh ${l.nextLesson}`}
            >
              M{l.nextLesson}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

// One session as a row: time on the left, a stripe in the phase color, people on the right.
export function SessionCard({
  s,
  note,
  now = new Date(),
  showDate = true,
  compact = false,
}: {
  s: SessionListItem;
  note?: string;
  now?: Date;
  showDate?: boolean;
  compact?: boolean; // one line of people: listeners only, "Bạn đi" when the viewer is in it
}) {
  const phase = sessionPhase(s.state, s.startsAt, now);
  const tone = PHASE_TONE[phase];
  const key = dayKey(s.startsAt);
  return (
    <Link
      href={`/ca/${s.id}`}
      className="flex gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-muted/50 active:bg-line/30"
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
            {s.kind === "outreach" ? (
              <span className="inline-flex items-center gap-1.5">
                <KindIcon kind="outreach" size={16} />
                Đi tiếp xúc
              </span>
            ) : (
              <ListenerNames listeners={s.listeners} />
            )}
          </span>
          {compact ? (
            s.isMember && (
              <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                Bạn đi
              </span>
            )
          ) : (
            <PhaseBadge phase={phase} />
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {s.locationLabel ?? "Chưa ghi nơi gặp"}
          {!compact && <> · {names(s.members)}</>}
        </p>
        {note && <p className="mt-1 text-sm font-medium text-accent">{note}</p>}
      </div>
    </Link>
  );
}
