import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/access/current-user";
import { Loading, PageHeader, Section } from "@/app/ui/kit";
import { ConfirmLogout } from "@/app/ui/logout-button";
import { ThemeSwitcher } from "@/app/ui/theme";

export const metadata: Metadata = { title: "Tài khoản · Seedling" };

// Phones: everything about the person using the app, one screen, each control labelled in words.
// Safe settings first, sign-out last and on its own so it is not hit by mistake.
export default function AccountPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const user = await requireUser();
  const role = user.role === "area_leader" ? "Khu vực trưởng" : "Thánh đồ";
  const initial = user.name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? "?";
  return (
    <>
      <PageHeader title="Tài khoản" back="/" />
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/15 text-lg font-bold text-accent">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{user.name}</p>
          <p className="text-sm text-muted">{role}</p>
        </div>
      </div>

      <Section title="Giao diện">
        <ThemeSwitcher labeled />
        <p className="text-xs text-muted">“Tự động” đổi sáng/tối theo cài đặt của điện thoại.</p>
      </Section>

      <Section title="Bảo mật">
        <Link
          href="/doi-mat-khau"
          className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-muted/50 active:bg-line/30"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0 text-muted">
            <path
              d="M5 9h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Zm2 0V6.5a3 3 0 0 1 6 0V9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="flex-1">
            <span className="block font-medium text-ink">Đổi mật khẩu</span>
            <span className="block text-xs text-muted">Các thiết bị khác sẽ bị đăng xuất</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0 text-muted">
            <path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Link>
      </Section>

      <div className="mt-4">
        <ConfirmLogout />
      </div>
    </>
  );
}
