"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { SessionFormResult, SessionPayload } from "@/app/actions/sessions";
import { formatDateTime, isOpenPhase, PHASE_LABEL, sessionPhase, STATUS_LABEL, type DisplayStatus } from "@/lib/domain";

export type PickListener = { id: string; name: string; status: DisplayStatus; lessons: number[]; linked: boolean };
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

  const membersOk = mode === "plan" || totalMembers >= 1;
  const canSubmit = listenerIds.length > 0 && membersOk && startsAt && (mode !== "plan" || locationLabel.trim());

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
    >
      {/* 1. Listeners */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ink">Chiên</legend>
        {fixedListeners ? (
          <p className="text-base text-ink">{listeners.map((l) => l.name).join(", ")}</p>
        ) : (
          <>
            {listeners.length > 6 && (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên…"
                className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
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
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left ${
                      on ? "border-accent bg-accent/10" : "border-line bg-surface"
                    }`}
                  >
                    <span className="font-medium text-ink">{l.name}</span>
                    <span className="text-xs text-muted">
                      {STATUS_LABEL[l.status]}
                      {l.lessons.length ? ` · đến mảnh ${l.lessons.length}` : ""}
                      {l.linked ? " · của bạn" : ""}
                    </span>
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
          </>
        )}
      </fieldset>

      {/* 2. Companions */}
      {mode !== "plan" && (
        <fieldset className="flex flex-col gap-2">
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
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    on ? "bg-accent text-on-accent" : "border border-line bg-surface text-ink"
                  }`}
                >
                  {m.id === currentUserId ? `${m.name} (bạn)` : m.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* 3. When and where */}
      <fieldset className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Thời gian</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="h-12 rounded-lg border border-line bg-surface px-3 text-base text-ink"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">
            Nơi gặp {mode === "plan" ? "" : <span className="font-normal text-muted">(không bắt buộc)</span>}
          </span>
          <input
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            maxLength={80}
            placeholder="VD: Quán cafe Kết"
            className="h-12 rounded-lg border border-line bg-surface px-3 text-base text-ink"
          />
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
            className="h-12 rounded-lg border border-line bg-surface px-3 text-base text-ink"
          />
          <span className="text-xs text-muted">Trên Google Maps bấm Chia sẻ → Sao chép đường liên kết.</span>
        </label>
        {mode !== "plan" &&
          (!showSummary ? (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="self-start text-sm text-accent underline"
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
                className="rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink"
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
            className="h-10 self-start rounded-lg border border-line bg-surface px-3 text-sm"
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
        disabled={!canSubmit || pending}
        className="sticky bottom-20 h-12 rounded-lg bg-accent text-base font-semibold text-on-accent shadow-sm disabled:opacity-50"
      >
        {pending ? "Đang lưu…" : TITLE[mode]}
      </button>
    </form>
  );
}
