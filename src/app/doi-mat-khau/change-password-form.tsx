"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { Field, FormError, SubmitButton } from "@/app/ui/form";

export function ChangePasswordForm({ forced, minLength }: { forced: boolean; minLength: number }) {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {forced && (
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-ink">
          Đây là lần đăng nhập đầu tiên. Hãy đặt mật khẩu riêng của bạn.
        </p>
      )}
      <Field
        label={forced ? "Mật khẩu tạm" : "Mật khẩu hiện tại"}
        name="current"
        type="password"
        autoComplete="current-password"
        required
      />
      <Field
        label="Mật khẩu mới"
        name="next"
        type="password"
        autoComplete="new-password"
        minLength={minLength}
        hint={`Ít nhất ${minLength} ký tự, có cả chữ và số.`}
        required
      />
      <Field label="Nhập lại mật khẩu mới" name="confirm" type="password" autoComplete="new-password" required />
      <FormError message={state?.error} />
      <SubmitButton pending={pending}>Lưu mật khẩu</SubmitButton>
    </form>
  );
}
