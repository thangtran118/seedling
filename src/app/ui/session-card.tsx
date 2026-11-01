import Link from "next/link";
import type { ReactNode } from "react";
import { joinSessionAction } from "@/app/actions/sessions";
import type { SessionListItem } from "@/lib/access/sessions";
import {
  dayKey,
  formatTime,
  isOpenPhase,
  lessonCode,
  lessonName,
  needsSharer,
  PHASE_LABEL,
  sessionPhase,
  WEEKDAY_SHORT,
  weekdayIndex,
} from "@/lib/domain";
import { ActionForm, PendingButton } from "./action-form";
import { KindIcon, PhaseBadge, PhaseMark } from "./kit";

const names = (xs: { name: string }[]) => xs.map((x) => x.name).join(", ");

// One "label · value" pair of the card's list; a muted value stands for "nothing yet", a red one for "needed".
function Row({
  label,
  children,
  empty = false,
  alert = false,
}: {
  label: string;
  children: ReactNode;
  empty?: boolean;
  alert?: boolean;
}) {
  return (
    <>
      <dt className={`text-[13px] leading-5 ${alert ? "font-medium text-danger" : "text-muted"}`}>{label}</dt>
      <dd
        className={`min-w-0 text-sm leading-5 break-words ${
          alert ? "font-semibold text-danger" : empty ? "text-muted" : "font-medium text-ink"
        }`}
      >
        {children}
      </dd>
    </>
  );
}

// The chiên's người đồng hành: "An, Bình"; with several listeners, per listener: "Lan: An · Hùng: Bình, Chi".
function Owners({ listeners }: { listeners: SessionListItem["listeners"] }) {
  const withOwners = listeners.filter((l) => l.owners.length);
  if (withOwners.length === 0) return null;
  return (
    <Row label="AE đồng hành">
      {listeners.length === 1
        ? withOwners[0].owners.join(", ")
        : withOwners.map((l, i) => (
            <span key={l.id}>
              {i > 0 && " · "}
              <span className="font-normal text-muted">{l.name}:</span> {l.owners.join(", ")}
            </span>
          ))}
    </Row>
  );
}

// Listener names, each followed by the lesson to share next when the viewer may see it: "Lan M4, Hùng B2".
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
              aria-label={`kế tiếp ${lessonName(l.nextLesson.route, l.nextLesson.n)}`}
            >
              {lessonCode(l.nextLesson.route, l.nextLesson.n)}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

// One session as a card, the same on every page. Header: the listener names in large type on the left (a badge under
// them when the session is live or cancelled), the time (and date) on the right, after the calendar legend's phase
// mark; then the people, the place and, when it is another one, the area as a two-column list. A visit today with no
// AE chia sẻ chính yet gets a red border and a red line until someone takes it. While the viewer can still join,
// "Tham gia ca" spans the bottom of the card, under the thumb and clear of the text, so narrow phones never cut the
// names short.
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
  const key = dayKey(s.startsAt);
  const canJoin = s.canJoin && isOpenPhase(phase);
  const cancelled = phase === "cancelled";
  const alert = needsSharer(s, now);
  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors ${
        alert
          ? "border-danger/50 hover:border-danger"
          : phase === "live"
            ? "border-live/40 hover:border-live/70"
            : "border-line hover:border-muted/50"
      } ${cancelled ? "bg-sunken" : "bg-surface"}`}
    >
      <Link href={`/ca/${s.id}`} className="block p-3.5 active:bg-line/30">
        {/* Header: who on the left (with any tags under the names), when on the right. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-lg leading-snug font-bold ${cancelled ? "text-muted line-through" : "text-ink"}`}>
              {s.kind === "outreach" ? (
                <span className="inline-flex items-center gap-1.5">
                  <KindIcon kind="outreach" size={18} />
                  Đi tiếp xúc
                </span>
              ) : (
                <ListenerNames listeners={s.listeners} />
              )}
            </p>
            {(cancelled || phase === "live") && (
              <div className="mt-1">
                <PhaseBadge phase={phase} />
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end pt-0.5">
            <span className="flex items-center gap-1.5">
              <PhaseMark phase={phase} />
              <span className="sr-only">{PHASE_LABEL[phase]}</span>
              <span
                className={`text-lg leading-snug font-bold tabular-nums ${cancelled ? "text-muted line-through" : "text-ink"}`}
              >
                {formatTime(s.startsAt)}
              </span>
            </span>
            {showDate && (
              <span className="text-xs text-muted tabular-nums">
                {WEEKDAY_SHORT[weekdayIndex(key)]} {key.slice(8)}/{key.slice(5, 7)}
              </span>
            )}
          </div>
        </div>

        <dl
          className={`mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-line pt-2 ${
            cancelled ? "opacity-60" : ""
          }`}
        >
          {s.kind === "visit" && <Owners listeners={s.listeners} />}
          <Row label="AE tham gia" empty={s.members.length === 0}>
            {s.members.length ? names(s.members) : "Chưa có ai"}
          </Row>
          {s.kind === "visit" && (
            <Row label="AE chia sẻ chính" empty={!s.sharer} alert={alert}>
              {s.sharer?.name ?? "Chưa có ae np"}
            </Row>
          )}
          <Row label="Địa điểm" empty={!s.locationLabel}>
            {s.locationLabel ?? "Chưa ghi"}
          </Row>
          {s.otherArea && <Row label="Khu vực">{s.otherArea}</Row>}
        </dl>
        {note && <p className="mt-2 text-sm font-medium text-accent">{note}</p>}
      </Link>
      {canJoin && (
        <ActionForm action={joinSessionAction} hidden={{ sessionId: s.id }} className="px-3.5 pb-3.5">
          <PendingButton className="h-11 w-full rounded-xl bg-accent text-base font-semibold text-on-accent transition-opacity hover:opacity-90">
            Tham gia ca
          </PendingButton>
        </ActionForm>
      )}
    </div>
  );
}
