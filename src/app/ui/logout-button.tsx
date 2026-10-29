"use client";

import { useTransition, type ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";
import { THEME_KEY } from "./theme-script";

// Design doc, Security: logout must leave no listener data behind on a shared phone.
async function wipeClientState() {
  try {
    if ("caches" in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  } catch {}
  try {
    // The theme choice is a device setting, not user data: keep it across logins.
    const theme = localStorage.getItem(THEME_KEY);
    localStorage.clear();
    if (theme) localStorage.setItem(THEME_KEY, theme);
    sessionStorage.clear();
  } catch {}
}

export function LogoutButton({ className, children = "Đăng xuất" }: { className?: string; children?: ReactNode }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await logoutAction();
          await wipeClientState();
          window.location.replace("/login");
        })
      }
    >
      {pending ? "Đang đăng xuất…" : children}
    </button>
  );
}
