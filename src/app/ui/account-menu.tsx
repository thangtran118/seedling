"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { ThemeSwitcher } from "./theme";

// Phones: account settings folded behind one button so they stop taking space from today's sessions.
// A <details> menu that also closes on a tap outside or Escape; md+ has the same links in the side rail.
export function AccountMenu({ name, role }: { name: string; role: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={ref} className="group relative md:hidden">
      <summary
        aria-label="Tài khoản"
        className="flex h-11 w-11 list-none items-center justify-center rounded-full border border-line bg-surface text-sm font-bold text-ink group-open:border-accent [&::-webkit-details-marker]:hidden"
      >
        {name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? "?"}
      </summary>
      <div className="absolute right-0 z-30 mt-2 flex w-60 flex-col rounded-2xl border border-line bg-surface p-3 text-sm shadow-lg shadow-black/10">
        <span className="font-semibold text-ink">{name}</span>
        <span className="text-xs text-muted">{role}</span>
        <ThemeSwitcher className="mt-3 self-start" />
        <div className="mt-2 flex flex-col border-t border-line pt-1">
          <Link href="/doi-mat-khau" className="flex h-11 items-center text-ink">
            Đổi mật khẩu
          </Link>
          <LogoutButton className="flex h-11 items-center text-left text-danger" />
        </div>
      </div>
    </details>
  );
}
