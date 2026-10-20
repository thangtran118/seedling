"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Field, FormError, SubmitButton } from "@/app/ui/form";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Số điện thoại"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="username"
        defaultValue={state?.phone}
        required
      />
      <Field label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
      <FormError message={state?.error} />
      <SubmitButton pending={pending}>Đăng nhập</SubmitButton>
    </form>
  );
}
