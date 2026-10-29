"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY, type ThemePref } from "./theme-script";

declare global {
  interface Window {
    __seedlingTheme?: () => void;
  }
}

const subscribers = new Set<() => void>();

function readPref(): ThemePref {
  const p = document.documentElement.dataset.themePref;
  return p === "light" || p === "dark" ? p : "system";
}

function setPref(p: ThemePref) {
  try {
    if (p === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, p);
  } catch {}
  window.__seedlingTheme?.();
  subscribers.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

const OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  {
    value: "system",
    label: "Tự động",
    icon: "M3 4.5h14v9H3zM7 16.5h6M10 13.5v3",
  },
  {
    value: "light",
    label: "Sáng",
    icon: "M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.3 4.3l1.1 1.1M14.6 14.6l1.1 1.1M4.3 15.7l1.1-1.1M14.6 5.4l1.1-1.1",
  },
  {
    value: "dark",
    label: "Tối",
    icon: "M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a6.8 6.8 0 1 0 8.7 8.7Z",
  },
];

// Segmented control: auto (follows the phone) / light / dark. Server render assumes "system"; the real choice
// shows after hydration. `labeled`: full width with the words under each icon, for the account page.
export function ThemeSwitcher({ className = "", labeled = false }: { className?: string; labeled?: boolean }) {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);
  return (
    <div
      role="radiogroup"
      aria-label="Giao diện"
      className={`${labeled ? "grid grid-cols-3 rounded-xl" : "inline-flex rounded-full"} border border-line bg-sunken p-0.5 ${className}`}
    >
      {OPTIONS.map((o) => {
        const on = pref === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={labeled ? undefined : o.label}
            title={labeled ? undefined : o.label}
            onClick={() => setPref(o.value)}
            className={`inline-flex items-center justify-center transition-colors ${
              labeled ? "h-14 flex-col gap-1 rounded-[10px] text-xs font-medium" : "h-8 w-9 rounded-full"
            } ${on ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d={o.icon} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {labeled && o.label}
          </button>
        );
      })}
    </div>
  );
}
