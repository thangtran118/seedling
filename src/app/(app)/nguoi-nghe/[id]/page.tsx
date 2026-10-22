import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { addLinkAction, removeLinkAction, setLessonsAction, setStatusAction } from "@/app/actions/listeners";
import { requireUser } from "@/lib/access/current-user";
import { getListenerDetail, type ListenerDetail } from "@/lib/access/listeners";
import { listAreaMembers } from "@/lib/access/members";
import { formatDate, formatDateTime, LESSONS, sessionPhase, STATUS_LABEL, type ManualStatus } from "@/lib/domain";
import { ActionForm, PendingButton } from "@/app/ui/action-form";
import {
  ButtonLink,
  Card,
  Empty,
  LessonDots,
  Loading,
  Notice,
  PageHeader,
  PHASE_TONE,
  PhaseBadge,
  Section,
  StatusBadge,
} from "@/app/ui/kit";
import { LessonBlock, ProgressNote } from "@/app/ui/listener-card";
import { loadOr404 } from "@/app/ui/load";

export const metadata: Metadata = { title: "Chiên · Seedling" };

export default function ListenerPage(props: PageProps<"/nguoi-nghe/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Detail params={props.params} />
    </Suspense>
  );
}

const PRIVATE_LABELS = [
  ["phone", "Số điện thoại"],
  ["hometown", "Quê quán"],
  ["facebook", "Facebook"],
  ["zalo", "Zalo"],
  ["telegram", "Telegram"],
] as const;

const MANUAL: ManualStatus[] = ["moi_quen", "goi_mo", "baptem", "tu_choi"];

async function Detail({ params }: { params: PageProps<"/nguoi-nghe/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const l = await loadOr404(getListenerDetail(user, id));
  const members = l.canManageLinks ? await listAreaMembers(user) : [];
  const linkable = members.filter((m) => !l.links.some((x) => x.userId === m.id));

  return (
    <>
      <PageHeader
        title={l.name}
        back="/nguoi-nghe"
        action={
          l.canEdit ? (
            <Link href={`/nguoi-nghe/${l.id}/sua`} className="text-sm text-accent underline">
              Sửa
            </Link>
          ) : undefined
        }
      />
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex gap-4">
          <LessonBlock lessons={l.lessons} status={l.status} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <span className={`text-2xl font-bold leading-tight ${l.age === null ? "text-muted" : "text-ink"}`}>
              {l.age === null ? "Chưa rõ tuổi" : `${l.age} tuổi`}
            </span>
            <span>
              <StatusBadge status={l.status} />
            </span>
            <ProgressNote lessons={l.lessons} status={l.status} />
          </div>
        </div>
        <LessonDots heard={l.lessons} size="md" />
      </section>

      {/* Planning is for direct companions (người đồng hành) only, the area leader included. */}
      {l.canEdit && <ButtonLink href={`/ca/hen?nguoi-nghe=${l.id}`}>Đặt lịch trudo</ButtonLink>}

      {l.private && (
        <Section title="Thông tin riêng tư">
          <Card>
            <dl className="flex flex-col gap-2 text-sm">
              {PRIVATE_LABELS.map(([key, label]) => (
                <div key={key} className="flex justify-between gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="break-all text-right text-ink">
                    {key === "phone" && l.private?.phone ? (
                      <a href={`tel:${l.private.phone}`} className="text-accent underline">
                        {l.private.phone}
                      </a>
                    ) : (
                      (l.private?.[key] ?? "—")
                    )}
                  </dd>
                </div>
              ))}
              {l.private.notes && (
                <div className="border-t border-line pt-2">
                  <dt className="text-muted">Ghi chú</dt>
                  <dd className="whitespace-pre-wrap text-ink">{l.private.notes}</dd>
                </div>
              )}
            </dl>
          </Card>
          <p className="text-xs text-muted">Lần xem này đã được ghi lại.</p>
        </Section>
      )}

      {l.canEdit && (
        <Section title="Mảnh">
          {/* key: reset the select to the saved value after a save or a rejected one */}
          <ActionForm
            key={l.lessons.length}
            action={setLessonsAction}
            hidden={{ listenerId: l.id }}
            className="flex flex-wrap gap-2"
          >
            <>
              <select
                name="lesson"
                defaultValue={l.lessons.length}
                className="h-11 flex-1 rounded-lg border border-line bg-surface px-3"
              >
                <option value={0}>Chưa nghe mảnh nào</option>
                {LESSONS.map((n) => (
                  <option key={n} value={n}>
                    Đã đến mảnh {n}
                  </option>
                ))}
              </select>
              <PendingButton className="h-11 rounded-lg border border-line px-4 text-sm">Lưu</PendingButton>
            </>
          </ActionForm>
          <p className="text-xs text-muted">Chọn mảnh chiên đã đến; các mảnh trước đó tự tính là đã xong.</p>
        </Section>
      )}

      {l.canEdit && (
        <Section title="Trạng thái">
          <ActionForm action={setStatusAction} hidden={{ listenerId: l.id }} className="flex gap-2">
            <>
              <select
                name="status"
                defaultValue={l.manualStatus}
                className="h-11 flex-1 rounded-lg border border-line bg-surface px-3"
              >
                {MANUAL.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <PendingButton className="h-11 rounded-lg border border-line px-4 text-sm">Lưu</PendingButton>
            </>
          </ActionForm>
          <p className="text-xs text-muted">
            “Đang học” tự hiện khi đã có mảnh. Báptem và Từ chối không bao giờ tự đổi.
          </p>
        </Section>
      )}

      <Section title="Người đồng hành">
        <ul className="flex flex-col gap-1.5">
          {l.links.map((link) => (
            <li
              key={link.userId}
              className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2"
            >
              <span className="text-ink">{link.userId === user.id ? `${link.name} (bạn)` : link.name}</span>
              {user.role === "area_leader" && l.links.length > 1 && (
                <ActionForm
                  action={removeLinkAction}
                  hidden={{ listenerId: l.id, userId: link.userId }}
                  confirm={`Bỏ ${link.name} khỏi người đồng hành?`}
                >
                  <PendingButton className="text-sm text-danger">Bỏ</PendingButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
        {l.canManageLinks && linkable.length > 0 && (
          <ActionForm action={addLinkAction} hidden={{ listenerId: l.id }} className="flex gap-2">
            <>
              <select
                name="userId"
                defaultValue=""
                className="h-11 flex-1 rounded-lg border border-line bg-surface px-3"
              >
                <option value="" disabled>
                  Thêm người đồng hành…
                </option>
                {linkable.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === user.id ? `${m.name} (bạn)` : m.name}
                  </option>
                ))}
              </select>
              <PendingButton className="h-11 rounded-lg border border-line px-4 text-sm">Thêm</PendingButton>
            </>
          </ActionForm>
        )}
      </Section>

      <History history={l.history} />
    </>
  );
}

function History({ history }: { history: ListenerDetail["history"] }) {
  if (history === null) {
    return (
      <Section title="Lịch sử hẹn ca">
        <Notice>Lịch sử hẹn ca chỉ hiện với người đồng hành, người đã đi ca cùng chiên này và khu vực trưởng.</Notice>
      </Section>
    );
  }
  // Saved automatically: every session with this chiên shows here, and turns "Hoàn thành" 2 hours after it starts
  // unless it was cancelled.
  const now = new Date();
  const items = history.map((h) => ({ ...h, phase: sessionPhase(h.state, h.startsAt, now) }));
  const done = items.filter((h) => h.phase === "done");
  return (
    <Section
      title="Lịch sử hẹn ca"
      aside={
        done.length > 0 && (
          <span className="text-xs text-muted">
            {done.length} ca hoàn thành · gần nhất {formatDate(done[0].startsAt)}
          </span>
        )
      }
    >
      {items.length === 0 ? (
        <Empty>Chưa có ca nào.</Empty>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-line pl-4">
          {items.map((h) => (
            <li key={h.sessionId} className="relative">
              <span
                className={`absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-bg ${PHASE_TONE[h.phase].bg}`}
                aria-hidden
              />
              <Card href={`/ca/${h.sessionId}`} className={h.phase === "cancelled" ? "opacity-60" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <span className={`font-semibold text-ink ${h.phase === "cancelled" ? "line-through" : ""}`}>
                    {formatDateTime(h.startsAt)}
                  </span>
                  <PhaseBadge phase={h.phase} />
                </div>
                {h.locationLabel && <p className="mt-1 text-sm text-muted">{h.locationLabel}</p>}
                <p className="mt-1.5 text-sm text-muted">
                  <span className="text-ink">Người trudo:</span> {h.members.join(", ")}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
