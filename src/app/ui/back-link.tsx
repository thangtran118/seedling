"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Set once the viewer has moved between pages inside the app; until then "back" would leave the app
// (a shared link, a fresh tab), so the back button follows its fixed href instead.
let movedInApp = false;
let firstPath: string | null = null;

// Rendered once in the app layout.
export function NavHistory() {
  const pathname = usePathname();
  useEffect(() => {
    if (firstPath === null) firstPath = pathname;
    else if (pathname !== firstPath) movedInApp = true;
  }, [pathname]);
  return null;
}

// Goes back to wherever the viewer came from (calendar, listener page, home…); falls back to `href`.
export function BackLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label="Quay lại"
      className={className}
      onClick={(e) => {
        if (!movedInApp || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
