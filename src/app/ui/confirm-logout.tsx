"use client";

import { useState } from "react";
import { LogoutButton } from "./logout-button";

// Account page: a full-width button that asks once before signing out, since a stray tap would mean
// typing the password again on a phone.
export function ConfirmLogout() {
  const [asking, setAsking] = useState(false);
  const button = "flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold";
  if (!asking)
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={`${button} border border-danger/40 bg-surface text-danger hover:bg-danger/10`}
      >
        Đăng xuất
      </button>
    );
  return (
    <div
      role="alertdialog"
      aria-label="Xác nhận đăng xuất"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <p className="text-sm text-ink">Đăng xuất khỏi điện thoại này? Lần sau bạn cần nhập lại mật khẩu.</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAsking(false)}
          autoFocus
          className={`${button} border border-line text-ink hover:bg-sunken`}
        >
          Ở lại
        </button>
        <LogoutButton className={`${button} bg-danger text-surface disabled:opacity-60`} />
      </div>
    </div>
  );
}
