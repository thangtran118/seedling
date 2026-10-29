import { Suspense } from "react";
import type { Metadata } from "next";
import { removeLinkAction } from "@/app/actions/listeners";
import { requireUser } from "@/lib/access/current-user";
import { getListenerDetail, type ListenerDetail } from "@/lib/access/listeners";
import { listAreaMembers } from "@/lib/access/members";
import { formatDate, formatDateTime, sessionPhase } from "@/lib/domain";
import { ActionForm, PendingButton } from "@/app/ui/action-form";
import { ContactList } from "@/app/ui/contact";
import {
  ButtonLink,
  Card,
  Empty,
  HeaderAction,
  Loading,
  PageHeader,
  PHASE_TONE,
  PhaseBadge,
  Section,
} from "@/app/ui/kit";
import { CompanionPicker, ListenerEditor, ListenerMainCard } from "@/app/ui/listener-editor";
import { loadOr404 } from "@/app/ui/load";

export const metadata: Metadata = { title: "Chiên · Seedling" };

export default function ListenerPage(props: PageProps<"/nguoi-nghe/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Detail params={props.params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/nguoi-nghe/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const l = await loadOr404(getListenerDetail(user, id));
  const members = l.canManageLinks ? await listAreaMembers(user) : [];
  const linkable = members.filter((m) => !l.links.some((x) => x.userId === m.id));

  const saved = { manualStatus: l.manualStatus, lessons: l.lessons.length };

  return (
    // key: start a fresh draft from the saved values after each save
    <ListenerEditor key={`${saved.manualStatus}-${saved.lessons}-${l.links.length}`} listenerId={l.id} initial={saved}>
      <PageHeader
        title="Chiên"
        back="/nguoi-nghe"
        action={
          l.canEdit ? (
            <HeaderAction href={`/nguoi-nghe/${l.id}/sua`} variant="secondary">
              Sửa thông tin
            </HeaderAction>
          ) : undefined
        }
      />
      <ListenerMainCard name={l.name} age={l.age} notes={l.private?.notes ?? null} canEdit={l.canEdit} />

      {/* Planning is for direct companions (người đồng hành) only, the area leader included. */}
      {l.canEdit && <ButtonLink href={`/ca/hen?nguoi-nghe=${l.id}`}>Đặt lịch trudo</ButtonLink>}

      {l.private && (
        <Section title="Thông tin riêng tư">
          <Card>
            <ContactList p={l.private} />
          </Card>
        </Section>
      )}

      <Section title="Người đồng hành">
        <ul className="flex flex-col gap-1.5">
          {l.links.map((link) => (
            <li
              key={link.userId}
              className="flex min-h-12 items-center justify-between rounded-lg border border-line bg-surface px-3 py-1.5"
            >
              <span className="text-ink">
                {link.userId === user.id ? `${link.name} (bạn)` : link.name}
                {link.primary && <span className="ml-2 text-xs text-muted">Đồng hành chính</span>}
              </span>
              {user.role === "area_leader" && !link.primary && l.links.length > 1 && (
                <ActionForm
                  action={removeLinkAction}
                  hidden={{ listenerId: l.id, userId: link.userId }}
                  confirm={`Bỏ ${link.name} khỏi người đồng hành?`}
                >
                  <PendingButton className="h-9 rounded-lg px-3 text-sm text-danger hover:bg-danger/10">
                    Bỏ
                  </PendingButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
        {l.canManageLinks && linkable.length > 0 && (
          <CompanionPicker
            choices={linkable.map((m) => ({ id: m.id, label: m.id === user.id ? `${m.name} (bạn)` : m.name }))}
          />
        )}
      </Section>

      <History history={l.history} />
    </ListenerEditor>
  );
}

function History({ history }: { history: ListenerDetail["history"] }) {
  if (history === null) return null;
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
