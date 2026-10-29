"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  assignLeaderAction,
  createAreaAction,
  createLeaderAction,
  deleteAreaAction,
  renameAreaAction,
} from "@/app/actions/regions";
import type { AreaAdminView } from "@/lib/access/regions";
import { roleLabel } from "@/lib/access/scope";
import { INPUT } from "./kit";
import { StateLine } from "./members-admin";

const small =
  "h-10 rounded-lg border border-line px-3 text-sm text-ink transition-colors hover:bg-sunken disabled:opacity-50";

export function CreateAreaForm() {
  const [state, action, pending] = useActionState(createAreaAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={100}
          placeholder="Tên khu vực mới"
          aria-label="Tên khu vực mới"
          autoComplete="off"
          className={`${INPUT} h-11 min-w-0 flex-1`}
        />
        <button
          disabled={pending}
          className="h-11 rounded-xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-60"
        >
          {pending ? "Đang thêm…" : "Thêm"}
        </button>
      </div>
      <StateLine state={state} />
    </form>
  );
}

// candidates: plain members of the region (any area); picking one from another area moves them here.
export function AreaRow({ area, candidates }: { area: AreaAdminView; candidates: { id: number; label: string }[] }) {
  const [renameState, renameAction, renaming] = useActionState(renameAreaAction, undefined);
  const [deleteState, deleteAction, deleting] = useActionState(deleteAreaAction, undefined);
  const [assignState, assignAction, assigning] = useActionState(assignLeaderAction, undefined);
  const [leaderState, leaderAction, creating] = useActionState(createLeaderAction, undefined);
  const [panel, setPanel] = useState<"" | "rename" | "assign" | "create">("");
  const hidden = <input type="hidden" name="areaId" value={area.id} />;
  const toggle = (p: typeof panel) => setPanel((cur) => (cur === p ? "" : p));

  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">{area.name}</span>
        <span className="text-sm text-muted tabular-nums">
          {area.members} ae · {area.listeners} chiên
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        {area.leader ? (
          <>
            {roleLabel(area.leader.role)}: <b className="text-ink">{area.leader.name}</b>
          </>
        ) : (
          <span className="font-medium text-danger">Chưa có khu vực trưởng</span>
        )}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <Link href={`/thanh-vien?kv=${area.isHome ? "" : area.id}`} className={`${small} inline-flex items-center`}>
          Thành viên
        </Link>
        {!area.isHome && (
          <>
            <button type="button" className={small} aria-expanded={panel === "assign"} onClick={() => toggle("assign")}>
              Gán khu vực trưởng
            </button>
            <button type="button" className={small} aria-expanded={panel === "create"} onClick={() => toggle("create")}>
              Tạo tài khoản trưởng
            </button>
          </>
        )}
        <button type="button" className={small} aria-expanded={panel === "rename"} onClick={() => toggle("rename")}>
          Đổi tên
        </button>
        {area.deletable && (
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!window.confirm(`Xóa khu vực ${area.name}?`)) e.preventDefault();
            }}
          >
            {hidden}
            <button disabled={deleting} className={`${small} border-danger/40 text-danger hover:bg-danger/10`}>
              Xóa
            </button>
          </form>
        )}
      </div>

      {panel === "rename" && (
        <form action={renameAction} className="mt-2 flex gap-2">
          {hidden}
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={area.name}
            aria-label="Tên mới"
            className={`${INPUT} h-10 min-w-0 flex-1`}
          />
          <button disabled={renaming} className={small}>
            Lưu
          </button>
        </form>
      )}

      {panel === "assign" &&
        (candidates.length ? (
          <form
            action={assignAction}
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              if (area.leader && !window.confirm(`${area.leader.name} sẽ thôi làm khu vực trưởng. Tiếp tục?`))
                e.preventDefault();
            }}
          >
            {hidden}
            <select name="userId" aria-label="Người làm khu vực trưởng" className={`${INPUT} h-10 min-w-0 flex-1`}>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button disabled={assigning} className={small}>
              Gán
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted">Chưa có thánh đồ nào để chọn. Tạo tài khoản trưởng mới.</p>
        ))}

      {panel === "create" && (
        <form
          action={leaderAction}
          className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            if (area.leader && !window.confirm(`${area.leader.name} sẽ thôi làm khu vực trưởng. Tiếp tục?`))
              e.preventDefault();
          }}
        >
          {hidden}
          <input
            name="name"
            required
            placeholder="Tên"
            aria-label="Tên"
            autoComplete="off"
            className={`${INPUT} h-10`}
          />
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            placeholder="Số điện thoại"
            aria-label="Số điện thoại"
            autoComplete="off"
            className={`${INPUT} h-10`}
          />
          <button disabled={creating} className={small}>
            {creating ? "Đang tạo…" : "Tạo"}
          </button>
        </form>
      )}

      <StateLine state={renameState} />
      <StateLine state={deleteState} />
      <StateLine state={assignState} />
      <StateLine state={leaderState} />
    </li>
  );
}
