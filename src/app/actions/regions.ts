"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/access/current-user";
import { assignAreaLeader, createArea, createAreaLeader, deleteArea, renameArea } from "@/lib/access/regions";
import { guard, idSchema, isActionError } from "./guard";
import type { MemberState } from "./members";

// Area management (the region leader); the access layer checks the role.

export async function createAreaAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const user = await requireUser();
  const result = await guard(() => createArea(user, String(formData.get("name") ?? "")));
  if (isActionError(result)) return { error: result.error };
  refresh();
  return { message: "Đã thêm khu vực." };
}

async function withArea(formData: FormData) {
  const user = await requireUser();
  const parsed = idSchema.safeParse(formData.get("areaId"));
  return { user, areaId: parsed.success ? parsed.data : null };
}

export async function renameAreaAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const { user, areaId } = await withArea(formData);
  if (!areaId) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => renameArea(user, areaId, String(formData.get("name") ?? "")));
  if (isActionError(result)) return { error: result.error };
  refresh();
  return { message: "Đã đổi tên." };
}

export async function deleteAreaAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const { user, areaId } = await withArea(formData);
  if (!areaId) return { error: "Dữ liệu không hợp lệ." };
  const result = await guard(() => deleteArea(user, areaId));
  if (isActionError(result)) return { error: result.error };
  refresh();
  return { message: "Đã xóa khu vực." };
}

export async function assignLeaderAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const { user, areaId } = await withArea(formData);
  const target = idSchema.safeParse(formData.get("userId"));
  if (!areaId || !target.success) return { error: "Chọn một người." };
  const result = await guard(() => assignAreaLeader(user, areaId, target.data));
  if (isActionError(result)) return { error: result.error };
  refresh();
  return { message: "Đã gán khu vực trưởng." };
}

export async function createLeaderAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const { user, areaId } = await withArea(formData);
  if (!areaId) return { error: "Dữ liệu không hợp lệ." };
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const result = await guard(() => createAreaLeader(user, areaId, { name, phone }));
  if (isActionError(result)) return { error: result.error };
  refresh();
  return { credentials: { name: name.trim(), ...result } };
}
