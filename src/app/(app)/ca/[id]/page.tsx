import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { cancelSessionAction, joinSessionAction, leaveSessionAction } from "@/app/actions/sessions";
import { requireUser } from "@/lib/access/current-user";
import { listenersForSession, type SessionListener } from "@/lib/access/listeners";
import { getSessionDetail } from "@/lib/access/sessions";
import { dayKey, formatDayLong, formatTime, isOpenPhase, sessionPhase } from "@/lib/domain";
import { ActionForm, PendingButton } from "@/app/ui/action-form";
import {
  ButtonLink,
  Card,
  LessonDots,
  Loading,
  Notice,
  PageHeader,
  PhaseBadge,
  Section,
  StatusBadge,
} from "@/app/ui/kit";
import { LessonBlock, ProgressNote } from "@/app/ui/listener-card";
import { firstParam, loadOr404 } from "@/app/ui/load";

export const metadata: Metadata = { title: "Ca trudo · Seedling" };

export default function SessionPage(props: PageProps<"/ca/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Detail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Detail({
  params,
  searchParams,
}: {
  params: PageProps<"/ca/[id]">["params"];
  searchParams: PageProps<"/ca/[id]">["searchParams"];
}) {
  const { id } = await params;
  const saved = firstParam((await searchParams)["da-luu"]) === "1";
  const user = await requireUser();
  const s = await loadOr404(getSessionDetail(user, id));

  const people = await listenersForSession(
    user,
    s.listeners.map((l) => l.id),
  );
  const phase = sessionPhase(s.state, s.startsAt);
  const day = dayKey(s.startsAt);

  return (
    <>
      <PageHeader title="Ca trudo" back="/" />
      {saved && <Notice tone="success">Đã lưu.</Notice>}
      {phase === "cancelled" && <Notice tone="warn">Ca này đã bị hủy. Dữ liệu vẫn được lưu trong lịch sử.</Notice>}
      {phase === "done" && <Notice tone="success">Ca đã hoàn thành và được lưu vào lịch sử của chiên.</Notice>}

      <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className={`text-xl font-bold capitalize text-ink ${s.state === "cancelled" ? "line-through" : ""}`}>
          {formatDayLong(day)} · {formatTime(s.startsAt)}
        </p>
        <PhaseBadge phase={phase} />
      </div>

      <Section title={s.listeners.length > 1 ? `Chiên (${s.listeners.length})` : "Chiên"}>
        <div className={`grid grid-cols-1 gap-3 ${people.length > 1 ? "md:grid-cols-2" : ""}`}>
          {people.map((l) => (
            <ListenerPanel key={l.id} l={l} />
          ))}
        </div>
      </Section>

      <Section title="Địa điểm chia sẻ">
        <div className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
          <span className="mt-0.5 shrink-0 text-accent" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-lg font-bold text-ink">{s.locationLabel ?? "Chưa ghi khu vực gặp"}</p>
            {s.private ? (
              s.private.locationDetail ? (
                <p className="break-words text-base text-ink">
                  <Linkified text={s.private.locationDetail} />
                </p>
              ) : (
                <p className="text-sm text-muted">Chưa ghi địa chỉ chi tiết.</p>
              )
            ) : (
              <p className="text-sm text-muted">
                Địa chỉ chi tiết chỉ hiện với người trong ca, người đồng hành và khu vực trưởng
                {s.canJoin ? ". Tham gia ca để xem." : "."}
              </p>
            )}
          </div>
        </div>
      </Section>

      {s.private?.summary && (
        <Section title="Tóm tắt ca">
          <Card>
            <p className="whitespace-pre-wrap text-sm text-ink">{s.private.summary}</p>
          </Card>
        </Section>
      )}

      <Section title={`Người trudo (${s.members.length})`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {s.members.map((m) => (
            <span key={m.id} className="rounded-full bg-sunken px-2.5 py-1 text-sm text-ink">
              {m.id === user.id ? `${m.name} (bạn)` : m.name}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted">Người tạo ca: {s.createdBy.name}</p>
      </Section>

      <div className="flex flex-col gap-3">
        {s.canJoin && (
          <ActionForm action={joinSessionAction} hidden={{ sessionId: s.id }}>
            <PendingButton className="h-12 w-full rounded-lg bg-accent font-semibold text-on-accent">
              Tham gia ca này
            </PendingButton>
          </ActionForm>
        )}
        {isOpenPhase(phase) && s.isMember && s.members.length > 1 && (
          <ActionForm action={leaveSessionAction} hidden={{ sessionId: s.id }}>
            <PendingButton className="h-11 w-full rounded-lg border border-line text-ink">Rời ca</PendingButton>
          </ActionForm>
        )}
        {(s.canEdit || s.canCancel) && (
          <div className={`grid gap-3 ${s.canEdit && s.canCancel ? "grid-cols-2" : "grid-cols-1"}`}>
            {s.canEdit && (
              <ButtonLink href={`/ca/${s.id}/sua`} variant="secondary">
                Sửa
              </ButtonLink>
            )}
            {s.canCancel && (
              <ActionForm
                action={cancelSessionAction}
                hidden={{ sessionId: s.id }}
                confirm="Hủy ca này? Ca vẫn được lưu trong lịch sử với trạng thái “Đã hủy”."
              >
                <PendingButton className="h-12 w-full rounded-lg border border-line text-danger">Hủy ca</PendingButton>
              </ActionForm>
            )}
          </div>
        )}
        {isOpenPhase(phase) && (
          <p className="text-xs text-muted">
            Ca tự hoàn thành sau 2 tiếng kể từ giờ bắt đầu nếu không bị hủy. Chỉ người tạo ca mới hủy được
            {s.canEdit ? "" : "; người đồng hành với chiên trong ca mới sửa được"}.
          </p>
        )}
      </div>
    </>
  );
}

const CONTACTS = [
  ["phone", "SĐT"],
  ["zalo", "Zalo"],
  ["facebook", "Facebook"],
  ["telegram", "Telegram"],
  ["hometown", "Quê quán"],
] as const;

function ListenerPanel({ l }: { l: SessionListener }) {
  const p = l.private;
  const contacts = p ? CONTACTS.filter(([k]) => p[k]) : [];
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex gap-3.5">
        <LessonBlock lessons={l.lessons} status={l.status} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href={`/nguoi-nghe/${l.id}`} className="text-xl font-bold leading-tight text-ink hover:underline">
            {l.name}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-base leading-tight ${l.age === null ? "text-muted" : "font-semibold text-ink"}`}>
              {l.age === null ? "Chưa rõ tuổi" : `${l.age} tuổi`}
            </span>
            <StatusBadge status={l.status} />
          </div>
          <ProgressNote lessons={l.lessons} status={l.status} />
        </div>
      </div>

      <LessonDots heard={l.lessons} />

      {p ? (
        <dl className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
          {contacts.length === 0 && <p className="text-muted">Chưa có thông tin liên hệ.</p>}
          {contacts.map(([k, label]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="break-all text-right font-medium text-ink">
                {k === "phone" ? (
                  <a href={`tel:${p.phone}`} className="text-accent underline">
                    {p.phone}
                  </a>
                ) : (
                  <Linkified text={p[k]!} />
                )}
              </dd>
            </div>
          ))}
          {p.notes && (
            <div className="mt-1">
              <dt className="text-muted">Ghi chú</dt>
              <dd className="whitespace-pre-wrap text-ink">{p.notes}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="border-t border-line pt-3 text-xs text-muted">
          Thông tin liên hệ chỉ hiện với người đồng hành và khu vực trưởng.
        </p>
      )}
    </article>
  );
}

// Plain text with http(s) links made clickable (people paste map links into the address).
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
