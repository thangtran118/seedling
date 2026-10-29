"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { SessionFormResult, SessionPayload } from "@/app/actions/sessions";
import { formatDateTime, isOpenPhase, PHASE_LABEL, sessionPhase, stageLabel, type Stage } from "@/lib/domain";
import { INPUT } from "./kit";

export type PickListener = { id: string; name: string; stage: Stage; linked: boolean };
export type PickMember = { id: string; name: string };

type Mode = "plan" | "edit";

export type SessionFormProps = {
  mode: Mode;
  currentUserId: string;
  listeners: PickListener[]; // choosable listeners (plan) or the fixed ones (edit)
  members: PickMember[];
  initial: {
    listenerIds: string[];
    memberIds: string[];
    startsAt: string; // datetime-local value, Vietnam time
    locationLabel: string;
    mapUrl: string;
    summary: string;
  };
  submit: (payload: SessionPayload) => Promise<SessionFormResult>;
};

const TITLE: Record<Mode, string> = {
  plan: "Đặt lịch",
  edit: "Lưu thay đổi",
};

export function SessionForm(props: SessionFormProps) {
  const { mode, currentUserId, listeners, members, initial, submit } = props;
  const fixedListeners = mode === "edit";
  const recorderFixed = mode === "plan";

  const [listenerIds, setListenerIds] = useState<string[]>(initial.listenerIds);
  const [memberIds, setMemberIds] = useState<string[]>(initial.memberIds);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [locationLabel, setLocationLabel] = useState(initial.locationLabel);
  const [mapUrl, setMapUrl] = useState(initial.mapUrl);
  const [summary, setSummary] = useState(initial.summary);
  const [showSummary, setShowSummary] = useState(Boolean(initial.summary));
  const [query, setQuery] = useState("");
  // Missing required fields, shown only after a submit attempt so an empty form does not open in red.
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<
    Extract<SessionFormResult, { duplicates: unknown }>["duplicates"] | null
  >(null);
  const [pending, startTransition] = useTransition();

  const visibleListeners = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listeners.filter((l) => !q || l.name.toLowerCase().includes(q));
  }, [listeners, query]);

  const others = members.filter((m) => !(recorderFixed && m.id === currentUserId));
  const totalMembers = (recorderFixed ? 1 : 0) + memberIds.length;

  function toggleListener(id: string) {
    if (listenerIds.includes(id)) {
      setListenerIds(listenerIds.filter((x) => x !== id));
      return;
    }
    setListenerIds([...listenerIds, id]);
  }

  function toggleMember(id: string) {
    if (memberIds.includes(id)) return setMemberIds(memberIds.filter((x) => x !== id));
    setMemberIds([...memberIds, id]);
  }

  function send(confirmDistinct = false) {
    setError(null);
    startTransition(async () => {
      const result = await submit({
        listenerIds,
        memberIds,
        startsAt,
        locationLabel,
        mapUrl,
        summary,
        confirmDistinct,
      });
      // A successful submit redirects; anything returned is a problem to show.
      if ("duplicates" in result) setDuplicates(result.duplicates);
      else setError(result.error);
    });
  }

  const missing = {
    listeners: listenerIds.length === 0,
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
      {/* 1. Listeners */}
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
            {listeners.length > 6 && (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên…"
                aria-label="Tìm chiên theo tên"
                type="search"
                className={`${INPUT} h-11`}
              />
            )}
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {visibleListeners.map((l) => {
                const on = listenerIds.includes(l.id);
                return (
                  <button
                    type="button"
                    key={l.id}
                    onClick={() => toggleListener(l.id)}
                    aria-pressed={on}
                    className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                      on ? "border-accent bg-accent/10" : "border-line bg-surface hover:bg-sunken"
                    }`}
                  >
                    <Check on={on} />
                    <span className="flex-1 font-medium text-ink">{l.name}</span>
                    <span className="text-xs text-muted">{stageLabel(l.stage)}</span>
                  </button>
                );
              })}
              {visibleListeners.length === 0 && (
                <p className="text-sm text-muted">
                  Không có ai.{" "}
                  <Link href="/nguoi-nghe/moi" className="text-accent underline">
                    Thêm chiên
                  </Link>
                </p>
              )}
            </div>
            {show("listeners") && <FieldError>Chọn ít nhất một chiên.</FieldError>}
          </>
        )}
      </fieldset>

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
            Nơi gặp {mode === "plan" ? <Required /> : <span className="font-normal text-muted">(không bắt buộc)</span>}
          </span>
          <input
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            maxLength={80}
            placeholder="VD: Quán cafe Kết"
            data-missing={show("location") || undefined}
            aria-invalid={show("location") || undefined}
            className={`${INPUT} h-12`}
          />
          {show("location") && <FieldError>Nhập nơi gặp.</FieldError>}
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
        {mode !== "plan" &&
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
