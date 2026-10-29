// Server-safe: renders the history timeline and notes list, handing both to the client tabs.
import type { ListenerHistoryItem } from "@/lib/access/listeners";
import { formatDate, formatDateTime, noteKey, sessionPhase } from "@/lib/domain";
import { Card, Empty, PHASE_TONE, PhaseBadge, Section } from "./kit";
import { HistoryTabs, NoteItem, type Note } from "./listener-notes";

// The listener's history in two tabs, "Hẹn ca | Ghi chú" (the listener page and each listener on a session page).
// Just the sessions when the viewer may not read the notes. currentSessionId marks the session being viewed;
// anchorId lets a "#…" link open the notes tab.
export function ListenerHistory({
  history,
  notes,
  currentSessionId,
  anchorId,
  title = "Lịch sử",
}: {
  history: ListenerHistoryItem[] | null;
  notes: Note[] | null;
  currentSessionId?: string;
  anchorId?: string;
  title?: string;
}) {
  if (history === null) return null;
  // Saved automatically: every session with this chiên shows here, and turns "Hoàn thành" 2 hours after it starts
  // unless it was cancelled.
  const now = new Date();
  const items = history.map((h) => ({ ...h, phase: sessionPhase(h.state, h.startsAt, now) }));
  const done = items.filter((h) => h.phase === "done");

  const timeline =
    items.length === 0 ? (
      <Empty>Chưa có ca nào.</Empty>
    ) : (
      <div className="flex flex-col gap-2">
        {done.length > 0 && (
          <p className="text-xs text-muted">
            {done.length} ca hoàn thành · gần nhất {formatDate(done[0].startsAt)}
          </p>
        )}
        <ol className="relative flex flex-col gap-3 border-l-2 border-line pl-4">
          {items.map((h) => (
            <li key={h.sessionId} className="relative">
              <span
                className={`absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-bg ${PHASE_TONE[h.phase].bg}`}
                aria-hidden
              />
              <Card
                href={`/ca/${h.sessionId}`}
                className={`${h.phase === "cancelled" ? "opacity-60" : ""} ${h.sessionId === currentSessionId ? "border-accent/50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`font-semibold text-ink ${h.phase === "cancelled" ? "line-through" : ""}`}>
                    {formatDateTime(h.startsAt)}
                    {h.sessionId === currentSessionId && (
                      <span className="ml-1.5 whitespace-nowrap text-xs font-medium text-muted">(ca này)</span>
                    )}
                  </span>
                  <PhaseBadge phase={h.phase} />
                </div>
                {h.locationLabel && <p className="mt-1 text-sm text-muted">{h.locationLabel}</p>}
                <p className="mt-1.5 text-sm text-muted">
                  <span className="text-ink">Người trudo:</span> {h.members.join(", ")}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    );

  if (notes === null) {
    return <Section title={title === "Lịch sử" ? "Lịch sử hẹn ca" : title}>{timeline}</Section>;
  }
  return (
    <HistoryTabs
      anchorId={anchorId}
      title={title}
      sessionsLabel={`Hẹn ca (${items.length})`}
      notesLabel={`Ghi chú (${notes.length})`}
      sessions={timeline}
      notes={
        notes.length === 0 ? (
          <Empty>Chưa có ghi chú.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((n) => (
              <NoteItem key={noteKey(n)} note={n} />
            ))}
          </div>
        )
      }
    />
  );
}
