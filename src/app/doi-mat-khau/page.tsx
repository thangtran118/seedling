import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/access/current-user";
import { AuthCard } from "@/app/ui/form";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Đổi mật khẩu · Seedling" };

export default function ChangePasswordPage() {
  return (
    <AuthCard title="Đổi mật khẩu" subtitle="Đổi mật khẩu sẽ đăng xuất bạn khỏi mọi thiết bị khác.">
      <Suspense fallback={null}>
        <Gate />
      </Suspense>
    </AuthCard>
  );
}

async function Gate() {
  const user = await requireUser("password-change");
  return <ChangePasswordForm forced={user.mustChangePassword} minLength={PASSWORD_MIN_LENGTH} />;
}
