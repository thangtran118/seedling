import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { addLinkAction, removeLinkAction, setStatusAction } from "@/app/actions/listeners";
import { requireUser } from "@/lib/access/current-user";
import { getListenerDetail, type ListenerDetail } from "@/lib/access/listeners";
import { listAreaMembers } from "@/lib/access/members";
import { formatDate, formatDateTime, SESSION_STATE_LABEL, STATUS_LABEL, type ManualStatus } from "@/lib/domain";
import { ActionForm, PendingButton } from "@/app/ui/action-form";
import { ButtonLink, Card, Empty, LessonDots, Loading, Notice, PageHeader, Section, StatusBadge } from "@/app/ui/kit";
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

      {/* Recording and planning are for direct companions (người đồng hành) only, the area leader included. */}
      {l.canEdit && (
        <div className="grid grid-cols-2 gap-3">
          <ButtonLink href={`/ca/ghi?nguoi-nghe=${l.id}`}>Ghi ca</ButtonLink>
          <ButtonLink href={`/ca/hen?nguoi-nghe=${l.id}`} variant="secondary">
            Hẹn ca
          </ButtonLink>
        </div>
      )}

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
      <Section title="Lịch sử nghe">
        <Notice>Lịch sử nghe chỉ hiện với người đồng hành, người đã đi ca cùng chiên này và khu vực trưởng.</Notice>
      </Section>
    );
  }
  const done = history.filter((h) => h.state === "done");
  return (
    <Section
      title="Lịch sử nghe"
      aside={
        done.length > 0 && (
          <span className="text-xs text-muted">
            {done.length} ca đã đi · gần nhất {formatDate(done[0].startsAt)}
          </span>
        )
      }
    >
      {history.length === 0 ? (
        <Empty>Chưa có ca nào.</Empty>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-line pl-4">
          {history.map((h) => (
            <li key={h.sessionId} className="relative">
              <span
                className={`absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-bg ${
                  h.state === "done" ? "bg-done" : h.state === "planned" ? "bg-plan" : "bg-muted"
                }`}
                aria-hidden
              />
              <Card href={`/ca/${h.sessionId}`} className={h.state === "cancelled" ? "opacity-60" : ""}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-semibold text-ink ${h.state === "cancelled" ? "line-through" : ""}`}>
                    {formatDateTime(h.startsAt)}
                  </span>
                  {h.state !== "done" && <span className="text-xs text-muted">{SESSION_STATE_LABEL[h.state]}</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {h.lessons.length ? (
                    h.lessons.map((n) => (
                      <span key={n} className="rounded-md bg-done/15 px-2 py-0.5 text-xs font-semibold text-done">
                        Mảnh {n}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted">{h.state === "done" ? "Chỉ gặp gỡ" : "Chưa có kết quả"}</span>
                  )}
                  {h.locationLabel && <span className="text-xs text-muted">· {h.locationLabel}</span>}
                </div>
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
