import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { updateSessionAction } from "@/app/actions/sessions";
import { requireUser } from "@/lib/access/current-user";
import { listAreaMembers } from "@/lib/access/members";
import { getSessionDetail } from "@/lib/access/sessions";
import { toLocalInputValue } from "@/lib/domain";
import { Loading, PageHeader } from "@/app/ui/kit";
import { loadOr404 } from "@/app/ui/load";
import { SessionForm } from "@/app/ui/session-form";

export const metadata: Metadata = { title: "Sửa ca · Seedling" };

export default function EditSessionPage(props: PageProps<"/ca/[id]/sua">) {
  return (
    <Suspense fallback={<Loading />}>
      <Edit params={props.params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/ca/[id]/sua">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const s = await loadOr404(getSessionDetail(user, id));
  // Completed and cancelled sessions are history: canEdit is false for them.
  if (!s.canEdit) notFound();

  const members = await listAreaMembers(user);
  const memberChoices = [...members, ...s.members.filter((m) => !members.some((x) => x.id === m.id))];

  return (
    <>
      <PageHeader title="Sửa ca" back={`/ca/${s.id}`} />
      <SessionForm
        mode="edit"
        currentUserId={user.id}
        // Listeners are fixed when editing and only their names show, so the stage is not needed.
        listeners={s.listeners.map((l) => ({ id: l.id, name: l.name, linked: true, stage: "moi_quen", route: "manh" }))}
        members={memberChoices.map(({ id: mid, name }) => ({ id: mid, name }))}
        submit={updateSessionAction.bind(null, s.id)}
        initial={{
          kind: s.kind,
          listenerIds: s.listeners.map((l) => l.id),
          memberIds: s.members.map((m) => m.id),
          startsAt: toLocalInputValue(s.startsAt),
          locationLabel: s.locationLabel ?? "",
          mapUrl: s.mapUrl ?? "",
          summary: s.private?.summary ?? "",
        }}
      />
    </>
  );
}
