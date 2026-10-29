"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { FormError, SubmitButton } from "@/app/ui/form";
import { PasswordField } from "@/app/ui/password-field";

export function ChangePasswordForm({ forced, minLength }: { forced: boolean; minLength: number }) {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {forced && (
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-ink">
          Đây là lần đăng nhập đầu tiên. Hãy đặt mật khẩu riêng của bạn.
        </p>
      )}
      {!forced && <PasswordField label="Mật khẩu hiện tại" name="current" autoComplete="current-password" required />}
      <PasswordField
        label="Mật khẩu mới"
        name="next"
        autoComplete="new-password"
        minLength={minLength}
        hint={`Ít nhất ${minLength} ký tự, có cả chữ và số.`}
        required
      />
      <PasswordField label="Nhập lại mật khẩu mới" name="confirm" autoComplete="new-password" required />
      <FormError message={state?.error} />
      <SubmitButton pending={pending}>Lưu mật khẩu</SubmitButton>
      {/* Opened from the account page: a way back without saving. */}
      {!forced && (
        <Link
          href="/tai-khoan"
          className="flex h-11 items-center justify-center text-sm font-semibold text-muted hover:text-ink"
        >
          Hủy
        </Link>
      )}
    </form>
  );
}
