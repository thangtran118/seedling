"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { saveListenerAction } from "@/app/actions/listeners";
import {
  applyStage,
  changeRoute,
  lessonName,
  lessonsOf,
  lessonUnit,
  nextLesson,
  ROUTE_KEYS,
  ROUTES,
  stageLabel,
  stageOf,
  stagesOf,
  tapLesson,
  type Progress,
  type Route,
} from "@/lib/domain";
import { INPUT, StageBadge } from "./kit";

// Listener page edits (route, stage, lesson, người đồng hành to add) stay local until the one "Lưu" bar at the
// bottom.
type Editor = {
  saved: Progress;
  progress: Progress;
  setProgress: (p: Progress) => void;
  addUserIds: string[];
  setAddUserIds: (ids: string[]) => void;
  dirty: boolean;
  reset: () => void;
  save: () => void;
  pending: boolean;
  error: string | null;
};

const EditorContext = createContext<Editor | null>(null);

function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("ListenerEditor is missing");
  return ctx;
}

// Re-mount it (key) when the saved values change so the draft starts from them again.
export function ListenerEditor({
  listenerId,
  initial,
  children,
}: {
  listenerId: string;
  initial: Progress;
  children: ReactNode;
}) {
  const [progress, setProgress] = useState(initial);
  const [addUserIds, setAddUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const progressDirty =
    progress.route !== initial.route ||
    progress.manualStatus !== initial.manualStatus ||
    progress.lessons !== initial.lessons;

  const reset = () => {
    setProgress(initial);
    setAddUserIds([]);
    setError(null);
  };
  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveListenerAction(listenerId, {
        progress: progressDirty ? { ...progress, expectedRoute: initial.route } : undefined,
        addUserIds,
      });
      if (result?.error) setError(result.error);
    });

  return (
    <EditorContext
      value={{
        saved: initial,
        progress,
        setProgress,
        addUserIds,
        setAddUserIds,
        dirty: progressDirty || addUserIds.length > 0,
        reset,
        save,
        pending,
        error,
      }}
    >
      {children}
      <SaveBar />
    </EditorContext>
  );
}

// Who, then the lessons: "Đang nghe mảnh N" (or B N / F N) and the next one to share over the route's lessons, the
// current one ringed. People in charge edit it by tapping a lesson or with the route and status selects below,
// saved with the page's "Lưu" bar.
export function ListenerMainCard({ name, age, canEdit }: { name: string; age: number | null; canEdit: boolean }) {
  const { saved, progress, setProgress } = useEditor();
  const { route } = progress;
  const stage = stageOf(progress);
  const closed = progress.manualStatus === "baptem" || progress.manualStatus === "tu_choi";
  const lessons = lessonsOf(route);
  const heard = lessons.filter((n) => n <= progress.lessons);
  const next = nextLesson(heard, route);
  const listening = !closed && progress.lessons > 0;

  // A new route starts from 0. Going back to the saved route brings the saved progress back; leaving a route with
  // saved progress asks first, since saving wipes it.
  const pickRoute = (to: Route) => {
    if (to === saved.route) return setProgress(saved);
    if (
      saved.lessons > 0 &&
      progress.route === saved.route &&
      !window.confirm(
        `Tiến độ đã lưu (${stageLabel(stageOf(saved), saved.route)}) sẽ bị xoá khi lưu. Đổi sang ${ROUTES[to].name}?`,
      )
    )
      return;
    setProgress(changeRoute(progress, to));
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="min-w-0">
        <h2 className="break-words text-2xl font-bold leading-tight text-ink">{name}</h2>
        <p className="mt-0.5 text-sm text-muted">{age === null ? "Chưa rõ tuổi" : `${age} tuổi`}</p>
      </div>

      <div className={`flex flex-col gap-2.5 rounded-xl p-3 ${listening ? "bg-accent/10" : "bg-sunken"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-muted">
          {listening ? (
            <p>
              Đang nghe{" "}
              <b className="text-base font-semibold tabular-nums text-accent">{lessonName(route, progress.lessons)}</b>
              <span className="tabular-nums">/{lessons.length}</span>
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <StageBadge stage={stage} route={route} />
              {closed && (
                <span className="tabular-nums">
                  đã nghe {progress.lessons}/{lessons.length} {lessonUnit(route)}
                </span>
              )}
            </p>
          )}
          {!closed &&
            (next === null ? (
              <p className="font-semibold text-done">
                Đã nghe đủ {lessons.length} {lessonUnit(route)}
              </p>
            ) : (
              <p>
                Kế tiếp <b className="font-semibold text-ink tabular-nums">{lessonName(route, next)}</b>
              </p>
            ))}
        </div>

        {/* Seven per row: Mảnh 1-7 and F1-F5 fit on one row, B1-B12 wraps onto two. */}
        <div className="grid grid-cols-7 gap-1.5">
          {lessons.map((n) => {
            const on = n <= progress.lessons;
            const current = listening && n === progress.lessons;
            const cls = `flex h-11 items-center justify-center rounded-lg text-base font-bold tabular-nums transition-colors ${
              on
                ? closed
                  ? "bg-line text-ink"
                  : "bg-accent text-on-accent"
                : "border border-line bg-surface text-muted"
            } ${current ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`;
            return canEdit ? (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                aria-current={current ? "step" : undefined}
                aria-label={stageLabel(`${n}`, route)}
                onClick={() => setProgress(tapLesson(progress, n))}
                className={`${cls} active:scale-95`}
              >
                {n}
              </button>
            ) : (
              <span key={n} aria-current={current ? "step" : undefined} className={cls}>
                {n}
              </span>
            );
          })}
        </div>
        {canEdit && (
          <p className="text-xs text-muted">Chạm vào {lessonUnit(route)} vừa nghe xong để cập nhật.</p>
        )}
      </div>

      {canEdit && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Lộ trình</span>
            <select value={route} onChange={(e) => pickRoute(e.target.value as Route)} className={`${INPUT} h-11`}>
              {ROUTE_KEYS.map((r) => (
                <option key={r} value={r}>
                  {ROUTES[r].name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Trạng thái</span>
            <select
              value={stage}
              onChange={(e) => setProgress(applyStage(progress, e.target.value as typeof stage))}
              className={`${INPUT} h-11`}
            >
              {stagesOf(route).map((s) => (
                <option key={s} value={s}>
                  {stageLabel(s, route)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}

// Pick people one by one from the select; they queue up as chips (tap ✕ to drop one) and are added on "Lưu".
export function CompanionPicker({ choices }: { choices: { id: string; label: string }[] }) {
  const { addUserIds, setAddUserIds } = useEditor();
  const picked = choices.filter((c) => addUserIds.includes(c.id));
  const left = choices.filter((c) => !addUserIds.includes(c.id));
  return (
    <>
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {picked.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setAddUserIds(addUserIds.filter((id) => id !== c.id))}
                aria-label={`Bỏ chọn ${c.label}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-accent bg-accent/10 pl-3 pr-2.5 text-sm font-medium text-accent"
              >
                + {c.label}
                <span aria-hidden className="text-base leading-none">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {left.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && setAddUserIds([...addUserIds, e.target.value])}
          className={`${INPUT} h-11`}
        >
          <option value="">{picked.length ? "Thêm người nữa…" : "Thêm người đồng hành…"}</option>
          {left.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
    </>
  );
}

// Above the phone tab bar; on md+ at the bottom of the content column.
function SaveBar() {
  const { dirty, reset, save, pending, error } = useEditor();
  if (!dirty) return null;
  return (
    <>
      <div className="h-20" aria-hidden />
      <div className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 md:bottom-6 md:left-68 md:right-8">
        <div className="mx-auto flex max-w-xl flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-lg shadow-black/15">
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="h-11 flex-1 rounded-lg border border-line text-ink"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="h-11 flex-[2] rounded-lg bg-accent font-semibold text-on-accent disabled:opacity-60"
            >
              {pending ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
