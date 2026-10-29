"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { addNoteAction, deleteNoteAction, updateNoteAction } from "@/app/actions/listeners";
import { formatDate } from "@/lib/domain";
import { INPUT } from "./kit";

// Client copy of ListenerNote (the access-layer type is server-only).
export type Note = {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date | null;
  author: string;
  canEdit: boolean;
};

const NOTE_MAX = 2000;

function Buttons({ pending, onCancel, saveLabel }: { pending: boolean; onCancel: () => void; saveLabel: string }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="h-11 flex-1 rounded-lg border border-line text-ink transition-colors hover:bg-sunken"
      >
        Hủy
      </button>
      <button
        type="submit"
        disabled={pending}
        className="h-11 flex-[2] rounded-lg bg-accent font-semibold text-on-accent disabled:opacity-60"
      >
        {pending ? "Đang lưu…" : saveLabel}
      </button>
    </div>
  );
}

// "+ Thêm ghi chú", opening a text box in place. Only people in charge of the listener (người đồng hành) get it.
export function NoteComposer({ listenerId }: { listenerId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setBody("");
    setError(null);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-accent/60 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Thêm ghi chú
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addNoteAction(listenerId, { body });
          if (result?.error) setError(result.error);
          else close();
        });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Ghi chú mới</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={NOTE_MAX}
          autoFocus
          placeholder="Chiên chia sẻ gì, cần lưu ý gì cho lần sau…"
          className={`${INPUT} py-2`}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Buttons pending={pending} onCancel={close} saveLabel="Lưu ghi chú" />
    </form>
  );
}

// One note: text first, then who / when. Long notes fold after a few lines. The author can edit or
// delete it in place. Key it by noteKey (domain) so a saved edit starts the next one from the new text.
export function NoteItem({ note, featured = false }: { note: Note; featured?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const long = note.body.length > 280 || note.body.split("\n").length > 6;

  const box = `flex flex-col gap-2 rounded-xl p-3 ${featured ? "border border-accent/30 bg-accent/5" : "border border-line bg-surface"}`;

  if (editing) {
    return (
      <form
        className={box}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await updateNoteAction(note.id, body);
            if (result?.error) setError(result.error);
            else setEditing(false);
          });
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={NOTE_MAX}
          autoFocus
          aria-label="Sửa ghi chú"
          className={`${INPUT} py-2`}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Buttons
          pending={pending}
          onCancel={() => {
            setEditing(false);
            setBody(note.body);
            setError(null);
          }}
          saveLabel="Lưu"
        />
      </form>
    );
  }

  return (
    <article className={box}>
      <p
        className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink ${long && !expanded ? "line-clamp-6" : ""}`}
      >
        {note.body}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="-my-1 self-start py-1 text-sm font-semibold text-accent"
        >
          {expanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="font-medium text-ink">{note.author}</span>
        <span aria-hidden>·</span>
        <span>{formatDate(note.createdAt)}</span>
        {note.updatedAt && <span>(đã sửa)</span>}
        {note.canEdit && (
          <span className="ml-auto flex">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-9 rounded-lg px-2.5 text-sm font-medium text-accent hover:bg-accent/10"
            >
              Sửa
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Xóa ghi chú này?")) return;
                startTransition(async () => {
                  const result = await deleteNoteAction(note.id);
                  if (result?.error) setError(result.error);
                });
              }}
              className="h-9 rounded-lg px-2.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              Xóa
            </button>
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </article>
  );
}

// "Hẹn ca | Ghi chú" segmented tabs over the history. Hẹn ca first (it matters more); a link to #anchorId opens the
// notes tab.
export function HistoryTabs({
  anchorId,
  title,
  sessionsLabel,
  notesLabel,
  sessions,
  notes,
}: {
  anchorId?: string;
  title: string;
  sessionsLabel: string;
  notesLabel: string;
  sessions: ReactNode;
  notes: ReactNode;
}) {
  const [tab, setTab] = useState<"sessions" | "notes">("sessions");
  const uid = useId(); // several listeners' tabs can share a page
  useEffect(() => {
    if (!anchorId) return;
    const sync = () => window.location.hash === `#${anchorId}` && setTab("notes");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [anchorId]);

  const tabs = [
    { key: "sessions", label: sessionsLabel },
    { key: "notes", label: notesLabel },
  ] as const;
  return (
    <section id={anchorId} className="flex scroll-mt-4 flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`${uid}-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`h-10 rounded-lg text-sm transition-colors ${
              tab === t.key ? "bg-surface font-semibold text-ink shadow-sm" : "font-medium text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-panel-${tab}`} aria-labelledby={`${uid}-tab-${tab}`}>
        {tab === "sessions" ? sessions : notes}
      </div>
    </section>
  );
}
