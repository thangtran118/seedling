import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { ThemeSwitcher } from "./theme";

// Phones: account settings folded behind one button so they stop taking space from today's sessions.
// Plain <details>, no client state; md+ has the same links in the side rail.
export function AccountMenu({ name, role }: { name: string; role: string }) {
  return (
    <details className="group relative md:hidden">
      <summary
        aria-label="Tài khoản"
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-surface text-sm font-bold text-ink [&::-webkit-details-marker]:hidden"
      >
        {name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? "?"}
      </summary>
      <div className="absolute right-0 z-30 mt-2 flex w-56 flex-col gap-1 rounded-2xl border border-line bg-surface p-3 text-sm shadow-lg shadow-black/10">
        <span className="font-semibold text-ink">{name}</span>
        <span className="text-xs text-muted">{role}</span>
        <ThemeSwitcher className="mt-3 self-start" />
        <Link href="/doi-mat-khau" className="mt-2 py-1.5 text-ink">
          Đổi mật khẩu
        </Link>
        <LogoutButton className="py-1.5 text-left text-danger" />
      </div>
    </details>
  );
}
