"use client";

import { useActionState, useState } from "react";
import {
  createMemberAction,
  removeMemberAction,
  resetPasswordAction,
  setLockedAction,
  type MemberState,
} from "@/app/actions/members";
import type { MemberAdminView } from "@/lib/access/members";
import { INPUT } from "./kit";

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
      <CopyButton text={`Seedling\nSĐT: ${phone}\nMật khẩu tạm: ${tempPassword}`} />
    </div>
  );
}

// Copies the login message so it can be pasted into Zalo / Telegram as is.
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(
          () => setCopied(true),
          () => {},
        )
      }
      className="mt-2 h-10 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-accent hover:bg-sunken"
    >
      {copied ? "Đã sao chép ✓" : "Sao chép để gửi"}
    </button>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Tên</span>
          <input name="name" required autoComplete="off" className={`${INPUT} h-11`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Số điện thoại</span>
          <input name="phone" type="tel" inputMode="tel" required autoComplete="off" className={`${INPUT} h-11`} />
        </label>
      </div>
      <button disabled={pending} className="h-12 rounded-xl bg-accent font-semibold text-on-accent disabled:opacity-60">
        {pending ? "Đang tạo…" : "Tạo tài khoản"}
      </button>
      <StateLine state={state} />
    </form>
  );
}

const small =
  "h-10 rounded-lg border border-line px-3 text-sm text-ink transition-colors hover:bg-sunken disabled:opacity-50";

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
  ].filter(Boolean);

  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-semibold ${member.active ? "text-ink" : "text-muted line-through"}`}>{member.name}</span>
        <a href={`tel:${member.phone}`} className="text-sm text-muted tabular-nums hover:text-accent">
          {member.phone}
        </a>
      </div>
      {badges.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <li key={String(b)} className="rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-muted">
              {b}
            </li>
          ))}
        </ul>
      )}
      {member.active && !isSelf && (
        <div className="mt-2 flex flex-wrap gap-2">
          <form
            action={resetAction}
            onSubmit={(e) => {
              if (!window.confirm(`Cấp mật khẩu tạm mới cho ${member.name}? Mật khẩu cũ sẽ không dùng được nữa.`))
                e.preventDefault();
            }}
          >
            {hidden}
            <button disabled={resetting} className={small}>
              Cấp lại mật khẩu
            </button>
          </form>
          <form
            action={lockAction}
            onSubmit={(e) => {
              if (!member.locked && !window.confirm(`Khóa tài khoản của ${member.name}?`)) e.preventDefault();
            }}
          >
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
            <button disabled={removing} className={`${small} border-danger/40 text-danger hover:bg-danger/10`}>
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
