"use client";

import { useActionState } from "react";
import {
  createMemberAction,
  removeMemberAction,
  resetPasswordAction,
  setLockedAction,
  type MemberState,
} from "@/app/actions/members";
import type { MemberAdminView } from "@/lib/access/members";

function Credentials({ state }: { state: MemberState }) {
  if (!state?.credentials) return null;
  const { name, phone, tempPassword } = state.credentials;
  return (
    <div className="mt-2 rounded-lg bg-accent/10 p-3 text-sm text-ink">
      <p>
        Gửi riêng cho <b>{name}</b>: SĐT <b>{phone}</b>, mật khẩu tạm{" "}
        <b className="font-mono text-base tracking-wider">{tempPassword}</b>
      </p>
      <p className="mt-1 text-xs text-muted">Mật khẩu chỉ hiện một lần, hết hạn sau 72 giờ.</p>
    </div>
  );
}

function StateLine({ state }: { state: MemberState }) {
  return (
    <>
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
      {state?.message && <p className="mt-2 text-sm text-muted">{state.message}</p>}
      <Credentials state={state} />
    </>
  );
}

export function CreateMemberForm() {
  const [state, action, pending] = useActionState(createMemberAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        <input name="name" placeholder="Tên" required className="h-11 rounded-lg border border-line bg-surface px-3" />
        <input
          name="phone"
          placeholder="Số điện thoại"
          type="tel"
          required
          className="h-11 rounded-lg border border-line bg-surface px-3"
        />
      </div>
      <button disabled={pending} className="h-11 rounded-lg bg-accent font-semibold text-on-accent disabled:opacity-60">
        {pending ? "Đang tạo…" : "Tạo tài khoản"}
      </button>
      <StateLine state={state} />
    </form>
  );
}

const small = "h-9 rounded-lg border border-line px-3 text-sm text-ink disabled:opacity-50";

export function MemberRow({ member, isSelf }: { member: MemberAdminView; isSelf: boolean }) {
  const [resetState, resetAction, resetting] = useActionState(resetPasswordAction, undefined);
  const [lockState, lockAction, locking] = useActionState(setLockedAction, undefined);
  const [removeState, removeAction, removing] = useActionState(removeMemberAction, undefined);
  const hidden = (
    <>
      <input type="hidden" name="userId" value={member.id} />
      <input type="hidden" name="name" value={member.name} />
    </>
  );
  const badges = [
    member.role === "area_leader" && "Khu vực trưởng",
    !member.active && "Đã vô hiệu",
    member.locked && "Đang khóa",
    member.active && member.mustChangePassword && "Chưa đổi mật khẩu",
    member.active && !member.mustChangePassword && !member.consented && "Chưa đồng ý",
  ].filter(Boolean);

  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">{member.name}</span>
        <span className="text-sm text-muted">{member.phone}</span>
      </div>
      {badges.length > 0 && <p className="mt-1 text-xs text-muted">{badges.join(" · ")}</p>}
      {member.active && !isSelf && (
        <div className="mt-2 flex flex-wrap gap-2">
          <form action={resetAction}>
            {hidden}
            <button disabled={resetting} className={small}>
              Cấp lại mật khẩu
            </button>
          </form>
          <form action={lockAction}>
            {hidden}
            <input type="hidden" name="locked" value={member.locked ? "false" : "true"} />
            <button disabled={locking} className={small}>
              {member.locked ? "Mở khóa" : "Khóa"}
            </button>
          </form>
          <form
            action={removeAction}
            onSubmit={(e) => {
              if (!window.confirm(`Xóa hoặc vô hiệu hóa tài khoản của ${member.name}?`)) e.preventDefault();
            }}
          >
            {hidden}
            <button disabled={removing} className={`${small} text-danger`}>
              Xóa
            </button>
          </form>
        </div>
      )}
      <StateLine state={resetState} />
      <StateLine state={lockState} />
      <StateLine state={removeState} />
    </li>
  );
}
