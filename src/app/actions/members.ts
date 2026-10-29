"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/access/current-user";
import { createMember, removeMember, resetMemberPassword, setMemberLocked } from "@/lib/access/members";
import { guard, idSchema, isActionError } from "./guard";

export type MemberState =
  { error?: string; credentials?: { name: string; phone: string; tempPassword: string }; message?: string } | undefined;

export async function createMemberAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const result = await guard(() => createMember(user, { name, phone }));
  if (isActionError(result)) return { error: result.error };
  refresh();
  return { credentials: { name: name.trim(), ...result } };
}

async function withMember(formData: FormData) {
  const user = await requireUser();
  const parsed = idSchema.safeParse(formData.get("userId"));
  return { user, targetId: parsed.success ? parsed.data : null, name: String(formData.get("name") ?? "") };
}

export async function resetPasswordAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const { user, targetId, name } = await withMember(formData);
  if (!targetId) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => resetMemberPassword(user, targetId));
  if (isActionError(result)) return { error: result.error };
  refresh();
  return { credentials: { name, ...result } };
}

export async function setLockedAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const { user, targetId } = await withMember(formData);
  if (!targetId) return { error: "Dữ liệu không hợp lệ." };
  const locked = formData.get("locked") === "true";
  const result = await guard(() => setMemberLocked(user, targetId, locked));
  if (result) return { error: result.error };
  refresh();
  return { message: locked ? "Đã khóa tài khoản và đăng xuất mọi thiết bị." : "Đã mở khóa." };
}

export async function removeMemberAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const { user, targetId } = await withMember(formData);
  if (!targetId) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => removeMember(user, targetId));
  if (isActionError(result)) return { error: result.error };
  refresh();
  return {
    message:
      result === "deleted" ? "Đã xóa tài khoản." : "Tài khoản đã có lịch sử ca nên được vô hiệu hóa thay vì xóa.",
  };
}
