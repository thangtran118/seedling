import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/access/current-user";
import { isLeader, isRegionLeader, roleLabel } from "@/lib/access/scope";
import { Loading, PageHeader, Section } from "@/app/ui/kit";
import { LogoutButton } from "@/app/ui/logout-button";
import { ThemeSwitcher } from "@/app/ui/theme";

export const metadata: Metadata = { title: "Tài khoản · Seedling" };

// The last tab on phones: everything about the person using the app, one screen, each control labelled in words.
// Safe settings first, sign-out last and on its own so it is not hit by mistake. Leaders also reach Thành viên
// here, since the phone tab bar has no room for it (md+ keeps it in the side rail).
export default function AccountPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const user = await requireUser();
  const role = roleLabel(user.role);
  const initial = user.name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? "?";
  return (
    <>
      <PageHeader title="Tài khoản" />
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
        <Row
          href="/doi-mat-khau"
          icon="M5 9h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Zm2 0V6.5a3 3 0 0 1 6 0V9"
          title="Đổi mật khẩu"
          note="Các thiết bị khác sẽ bị đăng xuất"
        />
      </Section>

      {isLeader(user) && (
        <div className="md:hidden">
          <Section title="Quản lý khu vực">
            {isRegionLeader(user) && (
              <Row
                href="/khu-vuc"
                icon="M3 5.5 8 3l4 2 5-2.5v12L12 17l-4-2-5 2.5v-12ZM8 3v12m4-10v12"
                title="Khu vực"
                note="Thêm khu vực, gán khu vực trưởng"
              />
            )}
            <Row
              href="/thanh-vien"
              icon="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"
              title="Thành viên"
              note="Thêm ae mới, cấp lại mật khẩu"
            />
          </Section>
        </div>
      )}

      <div className="mt-4">
        <LogoutButton className="flex h-12 w-full items-center justify-center rounded-xl border border-danger/40 bg-surface text-base font-semibold text-danger hover:bg-danger/10 disabled:opacity-60" />
      </div>
    </>
  );
}

// One tappable line that opens another screen: icon, title, a short note on what is there, chevron.
function Row({ href, icon, title, note }: { href: string; icon: string; title: string; note: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-muted/50 active:bg-line/30"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0 text-muted">
        <path d={icon} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="flex-1">
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-xs text-muted">{note}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0 text-muted">
        <path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
