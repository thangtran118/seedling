"use server";

import { redirect } from "next/navigation";
import { changePassword, login, revokeSession } from "@/lib/access/auth";
import {
  clearSessionCookie,
  clientIp,
  readSessionToken,
  requireUser,
  setSessionCookie,
} from "@/lib/access/current-user";

// `phone` is echoed back because React resets the form after an action; without it a typo in the
// password would also wipe the phone number.
export type FormState = { error?: string; phone?: string } | undefined;

const LOGIN_ERRORS = {
  invalid: "Sai số điện thoại hoặc mật khẩu.",
  rate_limited: "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  locked: "Tài khoản đang bị khóa. Hãy nhờ khu vực trưởng mở khóa.",
  temp_expired: "Mật khẩu tạm đã hết hạn. Hãy nhờ khu vực trưởng cấp lại.",
} as const;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await login(phone, password, await clientIp());
  if (!result.ok) return { error: LOGIN_ERRORS[result.error], phone };

  await setSessionCookie(result.token, result.expiresAt);
  redirect(result.user.mustChangePassword ? "/doi-mat-khau" : "/");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("password-change");
  // Absent on the first-login form: the user signed in with the temporary password moments ago.
  const current = user.mustChangePassword ? null : String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) return { error: "Hai lần nhập mật khẩu mới không khớp." };

  const result = await changePassword(user.id, current, next);
  if (!result.ok) return { error: result.error };
  await setSessionCookie(result.token, result.expiresAt);
  redirect("/");
}

// No server redirect here: the caller (LogoutButton) does a full page reload so that pages Next.js keeps
// hidden in the DOM (Activity, up to 3 routes) are discarded along with any listener data they hold.
export async function logoutAction() {
  const token = await readSessionToken();
  if (token) await revokeSession(token);
  await clearSessionCookie();
}
