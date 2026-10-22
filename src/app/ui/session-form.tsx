"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { LessonDots } from "@/app/ui/kit";
import type { SessionFormResult, SessionPayload } from "@/app/actions/sessions";
import {
  formatDateTime,
  LESSONS,
  nextLesson,
  SESSION_STATE_LABEL,
  STATUS_LABEL,
  type DisplayStatus,
} from "@/lib/domain";

export type PickListener = { id: string; name: string; status: DisplayStatus; lessons: number[]; linked: boolean };
export type PickMember = { id: string; name: string };
export type Prefill = Record<string, { memberIds: string[]; locationLabel: string | null }>;

type Mode = "record" | "plan" | "complete" | "edit";

export type SessionFormProps = {
  mode: Mode;
  currentUserId: string;
  listeners: PickListener[]; // choosable listeners (record/plan) or the fixed ones (complete/edit)
  members: PickMember[];
  prefill?: Prefill;
  initial: {
    listenerIds: string[];
    memberIds: string[];
    lessons: Record<string, number[]>;
    meetOnly: boolean;
    startsAt: string; // datetime-local value, Vietnam time
    locationLabel: string;
    locationDetail: string;
    summary: string;
  };
  submit: (payload: SessionPayload) => Promise<SessionFormResult>;
  editingPlanned?: boolean;
};

const TITLE: Record<Mode, string> = {
  record: "Lưu ca",
  plan: "Hẹn ca",
  complete: "Hoàn thành ca",
  edit: "Lưu thay đổi",
};

export function SessionForm(props: SessionFormProps) {
  const { mode, currentUserId, listeners, members, prefill = {}, initial, submit, editingPlanned = false } = props;
  const fixedListeners = mode === "complete" || mode === "edit";
  // A done session has lessons; a planned one (plan, or editing a planned) has none yet.
  const isDoneShape = mode === "record" || mode === "complete" || (mode === "edit" && !editingPlanned);
  const withLessons = isDoneShape;
  const recorderFixed = mode === "record" || mode === "plan";

  const [listenerIds, setListenerIds] = useState<string[]>(initial.listenerIds);
  const [memberIds, setMemberIds] = useState<string[]>(initial.memberIds);
  const [lessons, setLessons] = useState<Record<string, number[]>>(initial.lessons);
  const [meetOnly, setMeetOnly] = useState(initial.meetOnly);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [locationLabel, setLocationLabel] = useState(initial.locationLabel);
  const [locationDetail, setLocationDetail] = useState(initial.locationDetail);
  const [summary, setSummary] = useState(initial.summary);
  const [showMore, setShowMore] = useState(Boolean(initial.locationDetail || initial.summary));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<
    Extract<SessionFormResult, { duplicates: unknown }>["duplicates"] | null
  >(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(listeners.map((l) => [l.id, l])), [listeners]);
  const visibleListeners = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listeners.filter((l) => !q || l.name.toLowerCase().includes(q));
  }, [listeners, query]);

  const others = members.filter((m) => !(recorderFixed && m.id === currentUserId));
  const totalMembers = (recorderFixed ? 1 : 0) + memberIds.length;

  function toggleListener(id: string) {
    if (listenerIds.includes(id)) {
      setListenerIds(listenerIds.filter((x) => x !== id));
      setLessons(Object.fromEntries(Object.entries(lessons).filter(([k]) => k !== id)));
      return;
    }
    setListenerIds([...listenerIds, id]);
    const l = byId.get(id);
    const next = l ? nextLesson(l.lessons) : null;
    if (mode === "record" && next) setLessons({ ...lessons, [id]: [next] });
    // Prefill companions/place from the last session with this listener, only when nothing is chosen yet.
    const p = prefill[id];
    if (mode === "record" && p && listenerIds.length === 0) {
      if (memberIds.length === 0) setMemberIds(p.memberIds.filter((m) => others.some((o) => o.id === m)));
      if (!locationLabel && p.locationLabel) setLocationLabel(p.locationLabel);
    }
  }

  function toggleMember(id: string) {
    if (memberIds.includes(id)) return setMemberIds(memberIds.filter((x) => x !== id));
    setMemberIds([...memberIds, id]);
  }

  // Single-select: a session records the one lesson a chiên has now reached, not a set (earlier ones are implied).
  function selectLesson(listenerId: string, lesson: number) {
    const current = lessons[listenerId]?.[0];
    setLessons({ ...lessons, [listenerId]: current === lesson ? [] : [lesson] });
    if (current !== lesson) setMeetOnly(false);
  }

  function send(confirmDistinct = false) {
    setError(null);
    startTransition(async () => {
      const result = await submit({
        listenerIds,
        memberIds,
        lessons: meetOnly ? {} : lessons,
        meetOnly,
        startsAt,
        locationLabel,
        locationDetail,
        summary,
        confirmDistinct,
      });
      // A successful submit redirects; anything returned is a problem to show.
      if ("duplicates" in result) setDuplicates(result.duplicates);
      else setError(result.error);
    });
  }

  const membersOk = mode === "plan" || totalMembers >= 1;
  const anyLesson = Object.values(lessons).some((l) => l.length > 0);
  const lessonsOk = !withLessons || meetOnly || anyLesson;
  const canSubmit =
    listenerIds.length > 0 && membersOk && lessonsOk && startsAt && (mode !== "plan" || locationLabel.trim());

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

      {/* 2. Lessons per listener: pick the single lesson each chiên has now reached — mảnh trước đó tự tính là
          đã xong, nên không cần chọn lại. */}
      {withLessons && listenerIds.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-ink">Mảnh đạt được</legend>
          {listenerIds.map((lid) => {
            const l = byId.get(lid);
            const priorMax = l?.lessons.length ?? 0; // contiguous, so the count IS the highest lesson reached
            const chosen = meetOnly ? null : (lessons[lid]?.[0] ?? null);
            const reachable = LESSONS.filter((lesson) => lesson > priorMax);
            return (
              <div key={lid} className="flex flex-col gap-1.5">
                {listenerIds.length > 1 && <span className="text-sm text-muted">{l?.name}</span>}
                <div className="flex items-center gap-2">
                  <LessonDots heard={l?.lessons ?? []} />
                  <span className="text-xs text-muted">
                    {priorMax === 0 ? "Chưa nghe mảnh nào" : `Đã đến mảnh ${priorMax}`}
                  </span>
                </div>
                {reachable.length === 0 ? (
                  <p className="text-sm text-ink">Đã nghe đủ 7 mảnh.</p>
                ) : (
                  <div className="flex gap-1.5">
                    {reachable.map((lesson) => {
                      const on = chosen === lesson;
                      return (
                        <button
                          type="button"
                          key={lesson}
                          disabled={meetOnly}
                          aria-pressed={on}
                          onClick={() => selectLesson(lid, lesson)}
                          className={`h-11 flex-1 rounded-lg text-base font-semibold disabled:opacity-40 ${
                            on ? "bg-accent text-on-accent" : "border border-line bg-surface text-ink"
                          }`}
                        >
                          {lesson}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={meetOnly}
              onChange={(e) => setMeetOnly(e.target.checked)}
              className="h-4 w-4"
            />
            Chỉ gặp gỡ, chưa đạt mảnh mới
          </label>
          <p className="text-xs text-muted">Chọn mảnh chiên đạt đến trong ca này; mảnh trước đó tự tính là đã xong.</p>
        </fieldset>
      )}

      {/* 3. Companions */}
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

      {/* 4. When and where */}
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
            Khu vực gặp {mode === "plan" ? "" : <span className="font-normal text-muted">(không bắt buộc)</span>}
          </span>
          <input
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            maxLength={40}
            placeholder="VD: Q.3, Cafe Lê Lợi"
            className="h-12 rounded-lg border border-line bg-surface px-3 text-base text-ink"
          />
          <span className="text-xs text-muted">
            Cả khu vực đều thấy ô này. Không ghi địa chỉ nhà hay nơi làm việc của chiên; địa chỉ cụ thể ghi ở “Địa chỉ
            chi tiết” (chỉ thành viên ca và người đồng hành thấy).
          </span>
        </label>
        {!showMore ? (
          <button type="button" onClick={() => setShowMore(true)} className="self-start text-sm text-accent underline">
            + Địa chỉ chi tiết, tóm tắt
          </button>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">Địa chỉ chi tiết</span>
              <input
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                maxLength={200}
                className="h-12 rounded-lg border border-line bg-surface px-3 text-base text-ink"
              />
            </label>
            {mode !== "plan" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink">Tóm tắt</span>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink"
                />
              </label>
            )}
          </>
        )}
      </fieldset>

      {duplicates && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg bg-amber-500/15 p-3 text-sm text-ink">
          <p className="font-semibold">Hôm nay đã có ca với chiên này:</p>
          <ul className="flex flex-col gap-1">
            {duplicates.map((d) => (
              <li key={d.sessionId + d.listenerName}>
                <Link href={`/ca/${d.sessionId}`} className="underline">
                  {d.listenerName} · {SESSION_STATE_LABEL[d.state]} lúc {formatDateTime(d.startsAt)} · {d.createdByName}{" "}
                  ghi
                </Link>
                {d.state === "planned" ? " (mở để tham gia)" : " (nhờ người đồng hành thêm bạn vào ca)"}
              </li>
            ))}
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
      {mode === "record" && (
        <p className="text-xs text-muted">Sau khi lưu, chỉ người đồng hành của chiên mới sửa hoặc hủy được ca này.</p>
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
