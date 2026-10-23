"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ListenerFormInput, ListenerFormResult } from "@/app/actions/listeners";
import { applyStage, stageLabel, STAGES, type Stage } from "@/lib/domain";

type Values = {
  name: string;
  birthYear: string;
  stage: Stage;
  phone: string;
  hometown: string;
  facebook: string;
  zalo: string;
  telegram: string;
  notes: string;
};

const input = "h-12 rounded-lg border border-line bg-surface px-3 text-base text-ink";

// Controlled inputs + direct action call (not <form action>): a "possible duplicate" answer must not wipe the form.
export function ListenerForm({
  mode,
  initial,
  submit,
}: {
  mode: "create" | "edit";
  initial: Values;
  submit: (input: ListenerFormInput) => Promise<ListenerFormResult>;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<{ id: string; name: string; birthYear: number | null }[] | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  function send(confirmNew: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await submit({
        name: v.name,
        birthYear: v.birthYear,
        progress: mode === "create" ? applyStage({ manualStatus: "moi_quen", lessons: 0 }, v.stage) : undefined,
        private: {
          phone: v.phone,
          hometown: v.hometown,
          facebook: v.facebook,
          zalo: v.zalo,
          telegram: v.telegram,
          notes: v.notes,
        },
        confirmNew,
      });
      if ("similar" in result) setSimilar(result.similar);
      else setError(result.error);
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Tên *</span>
        <input value={v.name} onChange={set("name")} required maxLength={100} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Năm sinh</span>
          <input value={v.birthYear} onChange={set("birthYear")} inputMode="numeric" maxLength={4} className={input} />
        </label>
        {mode === "create" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Trạng thái</span>
            <select value={v.stage} onChange={set("stage")} className={input}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {stageLabel(s)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-semibold text-ink">Thông tin riêng tư</legend>
        {(
          [
            ["phone", "Số điện thoại", "tel"],
            ["hometown", "Quê quán", "text"],
            ["facebook", "Facebook", "text"],
            ["zalo", "Zalo", "text"],
            ["telegram", "Telegram", "text"],
          ] as const
        ).map(([key, label, type]) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="text-sm text-ink">{label}</span>
            <input value={v[key]} onChange={set(key)} type={type} className={input} />
          </label>
        ))}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink">Ghi chú (sở thích, thói quen…)</span>
          <textarea
            value={v.notes}
            onChange={set("notes")}
            rows={3}
            maxLength={2000}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink"
          />
        </label>
      </fieldset>

      {similar && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg bg-amber-500/15 p-3 text-sm text-ink">
          <p className="font-semibold">Có thể người này đã có trong khu vực:</p>
          <ul className="flex flex-col gap-1">
            {similar.map((s) => (
              <li key={s.id}>
                <Link href={`/nguoi-nghe/${s.id}`} className="underline">
                  {s.name}
                  {s.birthYear ? ` (${s.birthYear})` : ""}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={pending}
            onClick={() => send(true)}
            className="h-10 self-start rounded-lg border border-line bg-surface px-3"
          >
            Không phải, vẫn tạo người mới
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
        disabled={pending || !v.name.trim()}
        className="h-12 rounded-lg bg-accent text-base font-semibold text-on-accent disabled:opacity-50"
      >
        {pending ? "Đang lưu…" : mode === "create" ? "Thêm chiên" : "Lưu"}
      </button>
    </form>
  );
}
