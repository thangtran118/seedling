import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { cancelSessionAction, joinSessionAction, leaveSessionAction } from "@/app/actions/sessions";
import { requireUser } from "@/lib/access/current-user";
import { listenersForSession, type SessionListener } from "@/lib/access/listeners";
import { getSessionDetail } from "@/lib/access/sessions";
import { dayKey, formatDayLong, formatTime, isClosedStage, isOpenPhase, sessionPhase } from "@/lib/domain";
import { ActionForm, PendingButton } from "@/app/ui/action-form";
import { ContactList } from "@/app/ui/contact";
import {
  Card,
  HeaderAction,
  KindIcon,
  LessonDots,
  Loading,
  Notice,
  PageHeader,
  PhaseBadge,
  Section,
  StageBadge,
} from "@/app/ui/kit";
import { ProgressNote } from "@/app/ui/listener-card";
import { ListenerHistory } from "@/app/ui/listener-history";
import { NoteComposer } from "@/app/ui/listener-notes";
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
  const outreach = s.kind === "outreach";

  return (
    <>
      <PageHeader
        title={outreach ? "Đi tiếp xúc" : "Ca trudo"}
        back="/lich"
        action={
          s.canEdit ? (
            <HeaderAction href={`/ca/${s.id}/sua`} variant="secondary">
              Sửa ca
            </HeaderAction>
          ) : undefined
        }
      />
      {saved && <Notice tone="success">Đã lưu.</Notice>}
      {phase === "cancelled" && <Notice tone="warn">Ca này đã bị hủy. Dữ liệu vẫn được lưu trong lịch sử.</Notice>}
      {phase === "done" && (
        <Notice tone="success">
          {outreach ? "Ca đã hoàn thành." : "Ca đã hoàn thành và được lưu vào lịch sử của chiên."}
        </Notice>
      )}

      <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className={`text-xl font-bold capitalize text-ink ${s.state === "cancelled" ? "line-through" : ""}`}>
          {formatDayLong(day)} · {formatTime(s.startsAt)}
        </p>
        <PhaseBadge phase={phase} />
      </div>

      {/* The one thing most visitors of someone else's session came to do: keep it above the fold. */}
      {s.canJoin && (
        <ActionForm action={joinSessionAction} hidden={{ sessionId: s.id }}>
          <PendingButton className="h-12 w-full rounded-xl bg-accent font-semibold text-on-accent">
            Tham gia ca này
          </PendingButton>
        </ActionForm>
      )}

      {outreach ? (
        <OutreachNote showAdd={s.isMember && phase !== "upcoming" && phase !== "cancelled"} />
      ) : (
        <Section title={s.listeners.length > 1 ? `Chiên (${s.listeners.length})` : "Chiên"}>
          <div className={`grid grid-cols-1 gap-3 ${people.length > 1 ? "md:grid-cols-2" : ""}`}>
            {people.map((l) => (
              <ListenerPanel key={l.id} l={l} />
            ))}
          </div>
        </Section>
      )}

      <Section title={outreach ? "Khu vực tiếp xúc" : "Địa điểm chia sẻ"}>
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
            <p className="break-words text-lg font-bold text-ink">{s.locationLabel ?? "Chưa ghi nơi gặp"}</p>
            {(s.mapUrl || s.locationLabel) && (
              <a
                href={
                  s.mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.locationLabel!)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent underline underline-offset-2"
              >
                {s.mapUrl ? "Mở Google Maps ↗" : "Tìm trên Google Maps ↗"}
              </a>
            )}
          </div>
        </div>
      </Section>

      {s.private?.summary && (
        <Section title="Ghi chú">
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

      {/* Leaving and cancelling are rarer and harder to undo: at the end, outlined, never next to "Tham gia". */}
      {((isOpenPhase(phase) && s.isMember && s.members.length > 1) || s.canCancel) && (
        <div className="mt-2 flex flex-col gap-3 border-t border-line pt-5">
          {isOpenPhase(phase) && s.isMember && s.members.length > 1 && (
            <ActionForm action={leaveSessionAction} hidden={{ sessionId: s.id }} confirm="Rời ca này?">
              <PendingButton className="h-12 w-full rounded-xl border border-line bg-surface text-ink hover:bg-sunken">
                Rời ca
              </PendingButton>
            </ActionForm>
          )}
          {s.canCancel && (
            <ActionForm
              action={cancelSessionAction}
              hidden={{ sessionId: s.id }}
              confirm="Hủy ca này? Ca vẫn được lưu trong lịch sử với trạng thái “Đã hủy”."
            >
              <PendingButton className="h-12 w-full rounded-xl border border-danger/40 bg-surface text-danger hover:bg-danger/10">
                Hủy ca
              </PendingButton>
            </ActionForm>
          )}
        </div>
      )}

      {/* Everyone on the session reads each listener's whole history and notes, at the very end. */}
      {people.map(
        (l) =>
          l.history && (
            <ListenerHistory
              key={l.id}
              title={people.length > 1 ? `Lịch sử · ${l.name}` : "Lịch sử"}
              history={l.history}
              notes={l.notes}
              currentSessionId={s.id}
            />
          ),
      )}
    </>
  );
}

// Outreach has no listener yet: say what the session is, and once it is under way point the people in it at
// recording whoever they met.
function OutreachNote({ showAdd }: { showAdd: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="mt-0.5 text-accent">
        <KindIcon kind="outreach" size={22} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold text-ink">Đi tiếp xúc, làm quen người mới</p>
        <p className="text-sm text-muted">Gõ cửa, phát tờ rơi, trò chuyện ở khu vực bên dưới. Ca này không có chiên.</p>
        {showAdd && (
          <Link
            href="/nguoi-nghe/moi"
            className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent underline underline-offset-2"
          >
            Gặp được ai? + Thêm chiên
          </Link>
        )}
      </div>
    </div>
  );
}

function ListenerPanel({ l }: { l: SessionListener }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/nguoi-nghe/${l.id}`} className="text-xl font-bold leading-tight text-ink hover:underline">
            {l.name}
          </Link>
          <p className="text-sm text-muted">{l.age === null ? "Chưa rõ tuổi" : `${l.age} tuổi`}</p>
        </div>
        <StageBadge stage={l.stage} route={l.route} size="md" />
      </div>

      <div className="flex flex-col gap-1">
        <LessonDots heard={l.lessons} route={l.route} closed={isClosedStage(l.stage)} />
        <ProgressNote lessons={l.lessons} stage={l.stage} route={l.route} />
      </div>

      {l.private && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <ContactList p={l.private} />
        </div>
      )}

      {l.linked && (
        <div className="flex flex-col border-t border-line pt-3">
          <NoteComposer listenerId={l.id} />
        </div>
      )}
    </article>
  );
}
