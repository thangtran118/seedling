"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { SessionFormResult, SessionPayload } from "@/app/actions/sessions";
import {
  formatDateTime,
  isOpenPhase,
  PHASE_LABEL,
  sessionPhase,
  stageLabel,
  type SessionKind,
  type Route,
  type Stage,
} from "@/lib/domain";
import { INPUT, KindIcon } from "./kit";

export type PickListener = { id: number; name: string; stage: Stage; route: Route; linked: boolean };
export type PickMember = { id: number; name: string };

type Mode = "plan" | "edit";

export type SessionFormProps = {
  mode: Mode;
  currentUserId: number;
  listeners: PickListener[]; // choosable listeners (plan) or the fixed ones (edit)
  members: PickMember[];
  initial: {
    kind: SessionKind; // only chosen when planning
    listenerIds: number[];
    memberIds: number[];
    startsAt: string; // datetime-local value, Vietnam time
    locationLabel: string;
    mapUrl: string;
    summary: string;
  };
  submit: (payload: SessionPayload) => Promise<SessionFormResult>;
};

const KINDS: { kind: SessionKind; label: string }[] = [
  { kind: "visit", label: "Gặp chiên" },
  { kind: "outreach", label: "Đi tiếp xúc" },
];

const TITLE: Record<Mode, string> = {
  plan: "Đặt lịch",
  edit: "Lưu thay đổi",
};

export function SessionForm(props: SessionFormProps) {
  const { mode, currentUserId, listeners, members, initial, submit } = props;
  const fixedListeners = mode === "edit";
  const recorderFixed = mode === "plan";

  const [kind, setKind] = useState<SessionKind>(initial.kind);
  const outreach = kind === "outreach";
  // Planning a visit needs a listener the planner accompanies; without one only outreach is open.
  const canVisit = listeners.length > 0;
  const [listenerIds, setListenerIds] = useState<number[]>(initial.listenerIds);
  const [memberIds, setMemberIds] = useState<number[]>(initial.memberIds);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [locationLabel, setLocationLabel] = useState(initial.locationLabel);
  const [mapUrl, setMapUrl] = useState(initial.mapUrl);
  const [summary, setSummary] = useState(initial.summary);
  const [showSummary, setShowSummary] = useState(Boolean(initial.summary));
  // Planning a visit: the planner may take the sharing on right away (only for themselves, never for someone else).
  const [iShare, setIShare] = useState(false);
  // Missing required fields, shown only after a submit attempt so an empty form does not open in red.
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<
    Extract<SessionFormResult, { duplicates: unknown }>["duplicates"] | null
  >(null);
  const [pending, startTransition] = useTransition();

  const others = members.filter((m) => !(recorderFixed && m.id === currentUserId));
  const totalMembers = (recorderFixed ? 1 : 0) + memberIds.length;

  function toggleListener(id: number) {
    if (listenerIds.includes(id)) {
      setListenerIds(listenerIds.filter((x) => x !== id));
      return;
    }
    setListenerIds([...listenerIds, id]);
  }

  function toggleMember(id: number) {
    if (memberIds.includes(id)) return setMemberIds(memberIds.filter((x) => x !== id));
    setMemberIds([...memberIds, id]);
  }

  function send(confirmDistinct = false) {
    setError(null);
    startTransition(async () => {
      const result = await submit({
        kind,
        listenerIds: outreach ? [] : listenerIds,
        memberIds,
        startsAt,
        locationLabel,
        mapUrl,
        summary,
        iShare: mode === "plan" && !outreach && iShare,
        confirmDistinct,
      });
      // A successful submit redirects; anything returned is a problem to show.
      if ("duplicates" in result) setDuplicates(result.duplicates);
      else setError(result.error);
    });
  }

  const missing = {
    listeners: !outreach && listenerIds.length === 0,
    members: mode !== "plan" && totalMembers < 1,
    startsAt: !startsAt,
    location: mode === "plan" && !locationLabel.trim(),
  };
  const show = (k: keyof typeof missing) => tried && missing[k];

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (Object.values(missing).some(Boolean)) {
          e.currentTarget.querySelector<HTMLElement>("[data-missing]")?.scrollIntoView({ block: "center" });
          return;
        }
        send(false);
      }}
    >
      {/* 0. Kind: meeting known listeners, or going out to meet new people (no listener to pick). */}
      {mode === "plan" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Loại ca</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1">
            {KINDS.map((k) => {
              const on = kind === k.kind;
              const disabled = k.kind === "visit" && !canVisit;
              return (
                <button
                  type="button"
                  key={k.kind}
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => setKind(k.kind)}
                  className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    on ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  <KindIcon kind={k.kind} />
                  {k.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* 1. Listeners */}
      {!outreach && (
        <fieldset className="flex flex-col gap-2" data-missing={show("listeners") || undefined}>
          <legend className="mb-1 text-sm font-semibold text-ink">
            Chiên {!fixedListeners && <Required />}
            {listenerIds.length > 0 && !fixedListeners && (
              <span className="font-normal text-muted"> · đã chọn {listenerIds.length}</span>
            )}
          </legend>
          {fixedListeners ? (
            <p className="text-base text-ink">{listeners.map((l) => l.name).join(", ")}</p>
          ) : (
            <>
              <ListenerSelect
                listeners={listeners}
                selected={listenerIds}
                onToggle={toggleListener}
                invalid={show("listeners")}
              />
              {show("listeners") && <FieldError>Chọn ít nhất một chiên.</FieldError>}
            </>
          )}
        </fieldset>
      )}

      {/* 2. Companions */}
      {mode !== "plan" && (
        <fieldset className="flex flex-col gap-2" data-missing={show("members") || undefined}>
          <legend className="mb-1 text-sm font-semibold text-ink">
            Người đi cùng{" "}
            <span className="font-normal text-muted">
              ({totalMembers}
              {recorderFixed ? " người, tính cả bạn" : " người"})
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {recorderFixed && (
              <span className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-on-accent">Bạn</span>
            )}
            {others.map((m) => {
              const on = memberIds.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  aria-pressed={on}
                  onClick={() => toggleMember(m.id)}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors ${
                    on ? "bg-accent text-on-accent" : "border border-line bg-surface text-ink hover:bg-sunken"
                  }`}
                >
                  {on && <span aria-hidden>✓</span>}
                  {m.id === currentUserId ? `${m.name} (bạn)` : m.name}
                </button>
              );
            })}
          </div>
          {show("members") && <FieldError>Chọn ít nhất một người đi cùng.</FieldError>}
        </fieldset>
      )}

      {/* 3. When and where */}
      <fieldset className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">
            Thời gian <Required />
          </span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            data-missing={show("startsAt") || undefined}
            aria-invalid={show("startsAt") || undefined}
            className={`${INPUT} h-12`}
          />
          {show("startsAt") && <FieldError>Chọn ngày giờ.</FieldError>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">
            {outreach ? "Khu vực tiếp xúc" : "Nơi gặp"}{" "}
            {mode === "plan" ? <Required /> : <span className="font-normal text-muted">(không bắt buộc)</span>}
          </span>
          <input
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            maxLength={80}
            placeholder={outreach ? "VD: Công viên Phùng Khoang" : "VD: Quán cafe Kết"}
            data-missing={show("location") || undefined}
            aria-invalid={show("location") || undefined}
            className={`${INPUT} h-12`}
          />
          {show("location") && <FieldError>{outreach ? "Nhập khu vực tiếp xúc." : "Nhập nơi gặp."}</FieldError>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">
            Link Google Maps <span className="font-normal text-muted">(không bắt buộc)</span>
          </span>
          <input
            type="url"
            inputMode="url"
            value={mapUrl}
            onChange={(e) => setMapUrl(e.target.value)}
            maxLength={500}
            placeholder="https://maps.app.goo.gl/..."
            className={`${INPUT} h-12`}
          />
        </label>
        {/* Visit sessions: notes go on each chiên (listener page or the session page), not on the session. */}
        {mode !== "plan" &&
          outreach &&
          (!showSummary ? (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent"
            >
              + Ghi chú
            </button>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">Ghi chú</span>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={2000}
                rows={3}
                className={`${INPUT} py-2`}
              />
            </label>
          ))}
      </fieldset>

      {/* 4. AE chia sẻ chính */}
      {mode === "plan" && !outreach && (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
          <input
            type="checkbox"
            checked={iShare}
            onChange={(e) => setIShare(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-accent"
          />
          <span className="flex flex-col">
            <span className="text-base font-semibold text-ink">Tôi chia sẻ chính</span>
          </span>
        </label>
      )}

      {duplicates && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg bg-amber-500/15 p-3 text-sm text-ink">
          <p className="font-semibold">Hôm nay đã có ca với chiên này:</p>
          <ul className="flex flex-col gap-1">
            {duplicates.map((d) => {
              const phase = sessionPhase(d.state, d.startsAt);
              return (
                <li key={d.sessionId + d.listenerName}>
                  <Link href={`/ca/${d.sessionId}`} className="underline">
                    {d.listenerName} · {PHASE_LABEL[phase]} lúc {formatDateTime(d.startsAt)} · {d.createdByName} tạo
                  </Link>
                  {isOpenPhase(phase) ? " (mở để tham gia)" : ""}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => send(true)}
            disabled={pending}
            className="h-11 self-start rounded-lg border border-line bg-surface px-3 text-sm font-semibold"
          >
            Đây là một ca khác, vẫn lưu
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] h-12 rounded-xl bg-accent text-base font-semibold text-on-accent shadow-lg shadow-black/15 disabled:opacity-60 md:bottom-6"
      >
        {pending ? "Đang lưu…" : TITLE[mode]}
      </button>
    </form>
  );
}

function Required() {
  return (
    <span className="text-danger" aria-label="bắt buộc">
      *
    </span>
  );
}

function FieldError({ children }: { children: string }) {
  return (
    <span role="alert" className="text-sm font-medium text-danger">
      {children}
    </span>
  );
}

// Multi-select: a field that opens a searchable list with tick boxes; picked listeners show as removable chips.
function ListenerSelect({
  listeners,
  selected,
  onToggle,
  invalid,
}: {
  listeners: PickListener[];
  selected: number[];
  onToggle: (id: number) => void;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listeners.filter((l) => !q || l.name.toLowerCase().includes(q));
  }, [listeners, query]);
  const picked = listeners.filter((l) => selected.includes(l.id));

  // Close on a tap outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative flex flex-col gap-2">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${INPUT} flex h-12 cursor-pointer items-center justify-between gap-2 text-left ${invalid ? "border-danger!" : ""}`}
      >
        <span className={picked.length ? "text-ink" : "text-muted"}>
          {picked.length ? `Đã chọn ${picked.length} chiên` : "Chọn chiên…"}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-[3.25rem] z-20 flex flex-col gap-2 rounded-xl border border-line bg-surface p-2 shadow-lg shadow-black/15">
          {listeners.length > 6 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên…"
              aria-label="Tìm chiên theo tên"
              type="search"
              autoFocus
              className={`${INPUT} h-11`}
            />
          )}
          <div role="listbox" aria-multiselectable className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {visible.map((l) => {
              const on = selected.includes(l.id);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  key={l.id}
                  onClick={() => onToggle(l.id)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    on ? "bg-accent/10" : "hover:bg-sunken"
                  }`}
                >
                  <Check on={on} />
                  <span className="flex-1 font-medium text-ink">{l.name}</span>
                  <span className="text-xs text-muted">{stageLabel(l.stage, l.route)}</span>
                </button>
              );
            })}
            {visible.length === 0 && (
              <p className="px-2.5 py-2 text-sm text-muted">
                Không có ai.{" "}
                <Link href="/nguoi-nghe/moi" className="text-accent underline">
                  Thêm chiên
                </Link>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 cursor-pointer rounded-lg bg-accent text-sm font-semibold text-on-accent"
          >
            Xong
          </button>
        </div>
      )}

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((l) => (
            <span
              key={l.id}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-accent/10 pl-3 pr-1 text-sm font-medium text-ink"
            >
              {l.name}
              <button
                type="button"
                onClick={() => onToggle(l.id)}
                aria-label={`Bỏ chọn ${l.name}`}
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-accent/15 hover:text-ink"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Box with a tick: the selected state is not carried by the border color alone.
function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
        on ? "border-accent bg-accent text-on-accent" : "border-line"
      }`}
    >
      {on && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="m2.5 6.2 2.3 2.3 4.7-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
