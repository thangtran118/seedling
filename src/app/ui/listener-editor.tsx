"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { saveListenerAction } from "@/app/actions/listeners";
import { applyStage, LESSONS, nextLesson, stageLabel, STAGES, stageOf, tapLesson, type Progress } from "@/lib/domain";
import { INPUT, StageBadge } from "./kit";

// Listener page edits (stage, mảnh, người đồng hành to add) stay local until the one "Lưu" bar at the bottom.
type Editor = {
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
  const progressDirty = progress.manualStatus !== initial.manualStatus || progress.lessons !== initial.lessons;

  const reset = () => {
    setProgress(initial);
    setAddUserIds([]);
    setError(null);
  };
  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveListenerAction(listenerId, {
        progress: progressDirty ? progress : undefined,
        addUserIds,
      });
      if (result?.error) setError(result.error);
    });

  return (
    <EditorContext
      value={{
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

export function ListenerMainCard({
  name,
  age,
  notes,
  canEdit,
}: {
  name: string;
  age: number | null;
  notes: string | null;
  canEdit: boolean;
}) {
  const { progress, setProgress } = useEditor();
  const stage = stageOf(progress);
  const closed = progress.manualStatus === "baptem" || progress.manualStatus === "tu_choi";
  const heard = LESSONS.filter((n) => n <= progress.lessons);
  const next = nextLesson(heard);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-bold leading-tight text-ink">{name}</h2>
          <p className="mt-0.5 text-sm text-muted">{age === null ? "Chưa rõ tuổi" : `${age} tuổi`}</p>
        </div>
        <StageBadge stage={stage} size="md" />
      </div>

      {notes && <p className="whitespace-pre-wrap rounded-xl bg-sunken px-3 py-2 text-sm text-ink">{notes}</p>}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Mảnh</span>
          <span className="text-sm text-muted">
            {progress.lessons === 0 ? (
              "Chưa nghe mảnh nào"
            ) : (
              <>
                {progress.lessons}/{LESSONS.length}
                {!closed &&
                  (next === null ? (
                    " · đã nghe đủ"
                  ) : (
                    <>
                      {" "}
                      · kế tiếp <b className="text-ink">mảnh {next}</b>
                    </>
                  ))}
              </>
            )}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {LESSONS.map((n) => {
            const on = n <= progress.lessons;
            const cls = `flex h-12 items-center justify-center rounded-lg text-base font-bold tabular-nums ${
              on ? (closed ? "bg-line text-ink" : "bg-accent text-on-accent") : "border border-line text-muted"
            }`;
            return canEdit ? (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                aria-label={`Mảnh ${n}`}
                onClick={() => setProgress(tapLesson(progress, n))}
                className={`${cls} active:scale-95`}
              >
                {n}
              </button>
            ) : (
              <span key={n} className={cls}>
                {n}
              </span>
            );
          })}
        </div>
      </div>

      {canEdit && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Trạng thái</span>
          <select
            value={stage}
            onChange={(e) => setProgress(applyStage(progress, e.target.value as typeof stage))}
            className={`${INPUT} h-11`}
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {stageLabel(s)}
              </option>
            ))}
          </select>
        </label>
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
