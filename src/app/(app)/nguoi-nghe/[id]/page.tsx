import { Suspense } from "react";
import type { Metadata } from "next";
import { removeLinkAction } from "@/app/actions/listeners";
import { requireUser } from "@/lib/access/current-user";
import { getListenerDetail } from "@/lib/access/listeners";
import { listAreaMembers } from "@/lib/access/members";
import { noteKey } from "@/lib/domain";
import { ActionForm, PendingButton } from "@/app/ui/action-form";
import { ContactList } from "@/app/ui/contact";
import { ButtonLink, Card, Empty, HeaderAction, Loading, PageHeader, Section } from "@/app/ui/kit";
import { CompanionPicker, ListenerEditor, ListenerMainCard } from "@/app/ui/listener-editor";
import { ListenerHistory } from "@/app/ui/listener-history";
import { NoteComposer, NoteItem, type Note } from "@/app/ui/listener-notes";
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

  const saved = { route: l.route, manualStatus: l.manualStatus, lessons: l.lessons.length };

  return (
    // key: start a fresh draft from the saved values after each save
    <ListenerEditor
      key={`${saved.route}-${saved.manualStatus}-${saved.lessons}-${l.links.length}`}
      listenerId={l.id}
      initial={saved}
    >
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
      <ListenerMainCard name={l.name} age={l.age} canEdit={l.canEdit} />

      {l.notes && <Notes listenerId={l.id} notes={l.notes} canAdd={l.canEdit} />}

      {/* Planning is for direct companions (người đồng hành) only, the area leader included. */}
      {l.canEdit && <ButtonLink href={`/ca/hen?nguoi-nghe=${l.id}`}>Đặt lịch trudo</ButtonLink>}

      {l.private && (
        <Section title="Liên lạc">
          <Card>
            <ContactList p={l.private} />
          </Card>
        </Section>
      )}

      {/* Rarely needed on a visit: folded, with the names in the summary line. */}
      <details className="group rounded-2xl border border-line bg-surface" open={l.links.length === 0}>
        <summary className="flex min-h-12 list-none items-center justify-between gap-3 px-3.5 py-2 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Người đồng hành ({l.links.length})
            </span>
            <span className="block truncate text-sm text-ink">{l.links.map((x) => x.name).join(", ")}</span>
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className="shrink-0 text-muted transition-transform group-open:rotate-180"
          >
            <path
              d="m5 7.5 5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="flex flex-col gap-2 border-t border-line p-3">
          <ul className="flex flex-col gap-1.5">
            {l.links.map((link) => (
              <li
                key={link.userId}
                className="flex min-h-12 items-center justify-between rounded-lg bg-sunken px-3 py-1.5"
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
        </div>
      </details>

      <ListenerHistory history={l.history} notes={l.notes} anchorId="ghi-chu" />
    </ListenerEditor>
  );
}

// The latest note, in full, right under the mảnh; the others are in the history's "Ghi chú" tab.
function Notes({ listenerId, notes, canAdd }: { listenerId: string; notes: Note[]; canAdd: boolean }) {
  const [latest] = notes;
  return (
    <Section
      title="Ghi chú"
      aside={
        notes.length > 1 && (
          <a href="#ghi-chu" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">
            Xem tất cả ({notes.length})
          </a>
        )
      }
    >
      {latest ? <NoteItem key={noteKey(latest)} note={latest} featured /> : <Empty>Chưa có ghi chú.</Empty>}
      {canAdd && <NoteComposer listenerId={listenerId} />}
    </Section>
  );
}
