"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { ThemeSwitcher } from "./theme";

type Item = { href: string; label: string; icon: string; also?: string[] };

const ICONS: Record<string, string> = {
  home: "M3 10.5 10 4l7 6.5V17a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1v-6.5Z",
  people:
    "M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5 0a2.5 2.5 0 1 0 0-5M1.5 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5M13.5 12c2.6 0 5 1.8 5 5",
  calendar: "M4 5h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 4h14M7 3v4m6-4v4",
  chart: "M3 17h14M5.5 14V9m4.5 5V5m4.5 9v-3",
  team: "M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5",
};

function Icon({ name }: { name: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d={ICONS[name]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useItems(isLeader: boolean) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/", label: "Hôm nay", icon: "home" },
    { href: "/lich", label: "Lịch", icon: "calendar" },
    { href: "/nguoi-nghe", label: "Chiên", icon: "people" },
    { href: "/thong-ke", label: "Thống kê", icon: "chart" },
    ...(isLeader ? [{ href: "/thanh-vien", label: "Thành viên", icon: "team" }] : []),
  ];
  const active = (item: Item) =>
    item.href === "/"
      ? pathname === "/"
      : [item.href, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return { items, active };
}

// Phones: bottom tab bar. Tablets and desktops (md+): a left rail, see SideNav.
export function BottomNav({ isLeader }: { isLeader: boolean }) {
  const { items, active } = useItems(isLeader);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              aria-current={active(item) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(item) ? "font-semibold text-accent" : "text-muted"}`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SideNav({ isLeader, name, areaRole }: { isLeader: boolean; name: string; areaRole: string }) {
  const { items, active } = useItems(isLeader);
  return (
    <nav className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
      <Link href="/" className="flex items-center gap-2 px-3 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={28} height={28} className="rounded-lg" />
        <span className="text-lg font-bold tracking-tight text-ink">Seedling</span>
      </Link>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active(item) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                active(item) ? "bg-accent/10 font-semibold text-accent" : "text-ink hover:bg-sunken"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-1 border-t border-line px-3 pt-4 text-sm">
        <Link href="/tai-khoan" className="flex flex-col rounded-lg hover:text-accent">
          <span className="font-semibold text-ink">{name}</span>
          <span className="text-xs text-muted">{areaRole}</span>
        </Link>
        <ThemeSwitcher className="mt-3 self-start" />
        <Link href="/doi-mat-khau" className="mt-2 text-muted hover:text-ink">
          Đổi mật khẩu
        </Link>
        <LogoutButton className="text-left text-muted hover:text-ink" />
      </div>
    </nav>
  );
}
