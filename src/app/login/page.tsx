import type { Metadata } from "next";
import { AuthCard } from "@/app/ui/form";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập · Seedling" };

export default function LoginPage() {
  return (
    <AuthCard title="Đăng nhập" subtitle="Tài khoản do khu vực trưởng cấp.">
      <LoginForm />
    </AuthCard>
  );
}
