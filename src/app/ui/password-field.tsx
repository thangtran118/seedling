"use client";

import { useState, type InputHTMLAttributes } from "react";

// Password input with a show/hide toggle: long passwords typed on a phone are easy to get wrong unseen.
export function PasswordField({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="relative flex">
        <input
          {...input}
          type={shown ? "text" : "password"}
          className="h-12 w-full rounded-lg border border-line bg-surface pr-14 pl-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={shown ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted hover:text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10Zm8.2 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {shown && <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
          </svg>
        </button>
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
