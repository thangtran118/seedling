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
import { KindIcon, PHASE_TONE, PhaseBadge } from "./kit";

const names = (xs: { name: string }[]) => xs.map((x) => x.name).join(", ");

// One "Label: value" line under the listener names; a muted value stands for "nothing yet", a red one for "needed".
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
  const value = alert ? "font-semibold text-danger" : empty ? "" : "font-medium text-ink";
  return (
    <p className={`mt-0.5 text-sm ${alert ? "text-danger" : "text-muted"}`}>
      {label}: <span className={value}>{children}</span>
    </p>
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

// One session as a row: time on the left, a stripe in the phase color, people on the right. The same card on every
// page. The phase shows only as the stripe's color, except a cancelled session: a grey card with a "Đã hủy" badge.
// A visit today with no AE chia sẻ chính yet gets a red border and a red line until someone takes it.
// While the viewer can still join, a "Tham gia" button floats in the top-right corner instead of taking a row of its
// own; it is as tall as the first line, with a larger invisible tap area.
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
  const canJoin = s.canJoin && isOpenPhase(phase);
  const cancelled = phase === "cancelled";
  const alert = needsSharer(s, now);
  return (
    <div
      className={`relative rounded-2xl border transition-colors ${
        alert ? "border-danger/60 hover:border-danger" : "border-line hover:border-muted/50"
      } ${cancelled ? "bg-sunken" : "bg-surface"}`}
    >
      <Link href={`/ca/${s.id}`} className="flex gap-3 rounded-2xl p-3 active:bg-line/30">
        <div className="flex w-12 shrink-0 flex-col items-center justify-center text-center">
          <span className={`text-base font-bold tabular-nums ${cancelled ? "text-muted line-through" : "text-ink"}`}>
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
        <span className="sr-only">{PHASE_LABEL[phase]}</span>
        <div className="min-w-0 flex-1">
          {/* pr-24: the listener names stop short of the floating "Tham gia" button. */}
          <div className={`flex items-start justify-between gap-2 ${canJoin ? "pr-24" : ""}`}>
            <span className={`truncate font-semibold ${cancelled ? "text-muted line-through" : "text-ink"}`}>
              {s.kind === "outreach" ? (
                <span className="inline-flex items-center gap-1.5">
                  <KindIcon kind="outreach" size={16} />
                  Đi tiếp xúc
                </span>
              ) : (
                <ListenerNames listeners={s.listeners} />
              )}
            </span>
            {cancelled && <PhaseBadge phase={phase} />}
          </div>
          <div className={cancelled ? "opacity-60" : ""}>
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
          </div>
          {note && <p className="mt-1 text-sm font-medium text-accent">{note}</p>}
        </div>
      </Link>
      {canJoin && (
        <ActionForm
          action={joinSessionAction}
          hidden={{ sessionId: s.id }}
          className="absolute right-2 top-2 flex max-w-48 flex-col items-end text-right"
        >
          <PendingButton className="relative h-8 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent shadow-md before:absolute before:-inset-x-1 before:-inset-y-1.5 before:content-['']">
            Tham gia
          </PendingButton>
        </ActionForm>
      )}
    </div>
  );
}
