"use client";

import { useRef, useState } from "react";
import { addMonths, dayKey, formatDayLong, formatMonth, monthGrid, relativeDay, WEEKDAY_SHORT } from "@/lib/domain";
import { INPUT } from "./kit";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const QUARTERS = ["00", "15", "30", "45"];

// One field for day and time. Tapping it opens a sheet (from the bottom on phones) with the month and the hours
// side by side, so both are chosen in one place and confirmed with "Xong". day is "YYYY-MM-DD", time "HH:MM".
export function DateTimePicker({
  day,
  time,
  onChange,
  invalid,
}: {
  day: string;
  time: string;
  onChange: (day: string, time: string) => void;
  invalid: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const today = dayKey(new Date());
  // The sheet edits a draft; the field changes only on "Xong".
  const [draftDay, setDraftDay] = useState(day);
  const [hour, setHour] = useState(time.slice(0, 2));
  const [minute, setMinute] = useState(time.slice(3, 5));
  const [month, setMonth] = useState((day || today).slice(0, 7));

  function open() {
    setDraftDay(day || today);
    setHour(time.slice(0, 2));
    setMinute(time.slice(3, 5) || "00");
    setMonth((day || today).slice(0, 7));
    dialog.current?.showModal();
  }
  const close = () => dialog.current?.close();
  const done = Boolean(draftDay && hour && minute);
  // A minute off the quarter hours (an older session) stays pickable.
  const minutes = minute && !QUARTERS.includes(minute) ? [...QUARTERS, minute].sort() : QUARTERS;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className={`${INPUT} flex h-14 w-full items-center gap-3 text-left ${invalid ? "border-danger!" : ""}`}
      >
        <CalendarGlyph />
        {day && time ? (
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
            <span className="text-base font-semibold tabular-nums text-ink">
              {formatDayLong(day)} · {time}
            </span>
            <span className="text-sm text-muted">{relativeDay(day, today)}</span>
          </span>
        ) : (
          <span className="flex-1 text-muted">Chọn ngày giờ</span>
        )}
      </button>

      <dialog
        ref={dialog}
        aria-label="Chọn ngày giờ"
        // A tap on the dimmed backdrop lands on the dialog itself and closes it.
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/45 md:m-auto md:max-w-md md:rounded-3xl"
      >
        <div className="flex flex-col gap-4 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-line md:hidden" />

          {/* What will be saved, in words */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold tabular-nums">
                {draftDay ? formatDayLong(draftDay) : "Chọn ngày"}
                {hour && minute && ` · ${hour}:${minute}`}
              </p>
              {draftDay && <p className="text-sm text-muted">{relativeDay(draftDay, today)}</p>}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Đóng"
              className="-mr-1 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-sunken"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="size-5"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* Month */}
          <section className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <MonthStep label="Tháng trước" onClick={() => setMonth(addMonths(month, -1))} back />
              <h3 className="text-base font-semibold">{formatMonth(month)}</h3>
              <MonthStep label="Tháng sau" onClick={() => setMonth(addMonths(month, 1))} />
            </div>
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted">
              {WEEKDAY_SHORT.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid(month)
                .flat()
                .map((k) => {
                  const on = k === draftDay;
                  const inMonth = k.startsWith(month);
                  const past = k < today;
                  return (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setDraftDay(k)}
                      aria-pressed={on}
                      aria-label={formatDayLong(k)}
                      className={`mx-auto grid size-10 place-items-center rounded-full text-base tabular-nums transition-colors ${
                        on
                          ? "bg-accent font-bold text-on-accent"
                          : k === today
                            ? "font-bold text-accent ring-2 ring-accent/40 ring-inset hover:bg-sunken"
                            : inMonth && !past
                              ? "text-ink hover:bg-sunken"
                              : "text-muted/60 hover:bg-sunken"
                      }`}
                    >
                      {Number(k.slice(8))}
                    </button>
                  );
                })}
            </div>
          </section>

          {/* Time */}
          <section className="flex flex-col gap-2 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-muted">Giờ</h3>
            <div className="grid grid-cols-8 gap-1">
              {HOURS.map((h) => (
                <Choice key={h} on={h === hour} onClick={() => setHour(h)}>
                  {h}
                </Choice>
              ))}
            </div>
            <h3 className="mt-1 text-sm font-semibold text-muted">Phút</h3>
            <div className="grid auto-cols-fr grid-flow-col gap-1">
              {minutes.map((m) => (
                <Choice key={m} on={m === minute} onClick={() => setMinute(m)}>
                  :{m}
                </Choice>
              ))}
            </div>
          </section>

          <button
            type="button"
            disabled={!done}
            onClick={() => {
              onChange(draftDay, `${hour}:${minute}`);
              close();
            }}
            className="mt-4 mb-1 h-12 rounded-xl bg-accent text-base font-semibold text-on-accent transition-opacity disabled:opacity-40"
          >
            {hour ? "Xong" : "Chọn giờ"}
          </button>
        </div>
      </dialog>
    </>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-10 rounded-lg text-base tabular-nums transition-colors ${
        on ? "bg-accent font-bold text-on-accent" : "bg-sunken text-ink hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

function MonthStep({ label, onClick, back }: { label: string; onClick: () => void; back?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full text-ink hover:bg-sunken"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden
      >
        <path d={back ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
      </svg>
    </button>
  );
}

function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-5 shrink-0 text-muted"
    >
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </svg>
  );
}
