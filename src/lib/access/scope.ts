// Who may see and do what across areas and the region (design doc docs/designs/dia-vuc.md). Pure: no database, so
// the whole rule set is unit-tested (scope.test.ts). Access files load the rows and ask here; they do not compare
// roles or area ids themselves.
//
// - Everything about listeners and sessions (summaries, listening history, notes, session notes) is open to every
//   member of the region; nothing crosses regions.
// - A listener's contact fields: its người đồng hành, the leader of the listener's area, the region leader.
// - Editing stays with the people linked to the listener (decision 2026-10-18); leaders get no edit right from this.
// - The region leader (địa vực trưởng) oversees every area of the region and belongs to none (areaId null).
import type { SessionUser } from "./auth";
import { forbiddenError, notFoundError } from "./errors";

export type Viewer = Pick<SessionUser, "id" | "role" | "areaId" | "regionId">;
// areaId null: the region leader's account, or a session they created (it belongs to every area).
export type Placed = { areaId: number | null; regionId: number };

export const isRegionLeader = (v: Viewer) => v.role === "region_leader";
export const isLeader = (v: Viewer) => v.role === "area_leader" || v.role === "region_leader";

export const inRegion = (v: Viewer, t: { regionId: number }) => t.regionId === v.regionId;

// Leads the area `t` is in: its own area leader, or the leader of the region holding it.
export const leadsArea = (v: Viewer, t: Placed) =>
  inRegion(v, t) && (isRegionLeader(v) || (v.role === "area_leader" && t.areaId !== null && t.areaId === v.areaId));

export const canSeeContact = (v: Viewer, listener: Placed, linked: boolean) =>
  inRegion(v, listener) && (linked || leadsArea(v, listener));

// Adding a người đồng hành: someone already linked, or a leader of the listener's area (a leader adding themselves
// is how they gain edit rights). Removing one is a leader-only action.
export const canAddLinks = (v: Viewer, listener: Placed, linked: boolean) =>
  inRegion(v, listener) && (linked || leadsArea(v, listener));
export const canRemoveLinks = (v: Viewer, listener: Placed) => leadsArea(v, listener);

// Notes are added by a người đồng hành only, wherever the viewer's own area is.
export const canAddNote = (v: Viewer, listener: Placed, linked: boolean) => inRegion(v, listener) && linked;

// Managing an account (create, reset password, lock, remove, see per-member stats): a leader of that person's area.
// An area leader's own account is managed by the region leader only.
export const canManageMember = (v: Viewer, target: Placed & { role: Viewer["role"] }) =>
  target.role === "member" ? leadsArea(v, target) : isRegionLeader(v) && inRegion(v, target);

export function requireInRegion<T extends { regionId: number }>(
  v: Viewer,
  t: T | null | undefined,
  what = "Không tìm thấy dữ liệu.",
): asserts t is T {
  if (!t || !inRegion(v, t)) throw notFoundError(what);
}

// An area picked by the caller (filters, stats, member admin) must be one of the viewer's region.
export function requireAreaInRegion<T extends { regionId: number }>(
  v: Viewer,
  area: T | null | undefined,
): asserts area is T {
  requireInRegion(v, area, "Không tìm thấy khu vực.");
}

export function requireRegionLeader(v: Viewer) {
  if (!isRegionLeader(v)) throw forbiddenError("Chỉ địa vực trưởng mới làm được việc này.");
}

export function requireLeader(v: Viewer) {
  if (!isLeader(v)) throw forbiddenError("Chỉ khu vực trưởng mới làm được việc này.");
}

export function requireLeadsArea(v: Viewer, t: Placed) {
  if (!leadsArea(v, t)) throw forbiddenError("Chỉ trưởng của khu vực này mới làm được việc này.");
}

export function requireCanManageMember(v: Viewer, target: Placed & { role: Viewer["role"] }) {
  if (!inRegion(v, target)) throw notFoundError("Không tìm thấy thành viên.");
  if (!canManageMember(v, target))
    throw forbiddenError(
      target.role === "member"
        ? "Chỉ trưởng của khu vực này mới làm được việc này."
        : "Chỉ địa vực trưởng mới quản lý được tài khoản khu vực trưởng.",
    );
}

export const roleLabel = (role: Viewer["role"]) =>
  role === "region_leader" ? "Địa vực trưởng" : role === "area_leader" ? "Khu vực trưởng" : "Thánh đồ";
