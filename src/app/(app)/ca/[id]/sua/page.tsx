import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { completeSessionAction, updateSessionAction } from "@/app/actions/sessions";
import { requireUser } from "@/lib/access/current-user";
import { lessonsHeardFor } from "@/lib/access/listeners";
import { listAreaMembers } from "@/lib/access/members";
import { getSessionDetail } from "@/lib/access/sessions";
import { displayStatus, nextLesson, toLocalInputValue } from "@/lib/domain";
import { Loading, PageHeader } from "@/app/ui/kit";
import { firstParam, loadOr404 } from "@/app/ui/load";
import { SessionForm } from "@/app/ui/session-form";

export const metadata: Metadata = { title: "Sửa ca · Seedling" };

export default function EditSessionPage(props: PageProps<"/ca/[id]/sua">) {
  return (
    <Suspense fallback={<Loading />}>
      <Edit params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Edit({
  params,
  searchParams,
}: {
  params: PageProps<"/ca/[id]/sua">["params"];
  searchParams: PageProps<"/ca/[id]/sua">["searchParams"];
}) {
  const { id } = await params;
  const wantsComplete = firstParam((await searchParams)["hoan-thanh"]) === "1";
  const user = await requireUser();
  const s = await loadOr404(getSessionDetail(user, id));
  if (!s.canEdit) notFound();
  const completing = wantsComplete && s.state === "planned";
  if (completing && !s.canComplete) notFound();

  // Prior progress excluding this session's own recorded lesson, so the dots and the picker's floor reflect
  // what was true before this session, not a tautology.
  const heard = await lessonsHeardFor(
    s.listeners.map((l) => l.id),
    { excludeSessionId: s.id },
  );
  const members = await listAreaMembers(user);
  const memberChoices = [...members, ...s.members.filter((m) => !members.some((x) => x.id === m.id))];

  const initialLessons: Record<string, number[]> = completing
    ? Object.fromEntries(
        s.listeners.flatMap((l) => {
          const n = nextLesson(heard.get(l.id) ?? []);
          return n ? [[l.id, [n]]] : [];
        }),
      )
    : s.lessons;

  return (
    <>
      <PageHeader title={completing ? "Ghi kết quả ca" : "Sửa ca"} back={`/ca/${s.id}`} />
      <SessionForm
        mode={completing ? "complete" : "edit"}
        editingPlanned={!completing && s.state === "planned"}
        currentUserId={user.id}
        listeners={s.listeners.map((l) => {
          const ls = heard.get(l.id) ?? [];
          return { id: l.id, name: l.name, lessons: ls, linked: true, status: displayStatus("moi_quen", ls) };
        })}
        members={memberChoices.map(({ id: mid, name }) => ({ id: mid, name }))}
        submit={(completing ? completeSessionAction : updateSessionAction).bind(null, s.id)}
        initial={{
          listenerIds: s.listeners.map((l) => l.id),
          memberIds: s.members.map((m) => m.id),
          lessons: initialLessons,
          meetOnly: s.state === "done" && Object.keys(s.lessons).length === 0,
          startsAt: toLocalInputValue(s.startsAt),
          locationLabel: s.locationLabel ?? "",
          locationDetail: s.private?.locationDetail ?? "",
          summary: s.private?.summary ?? "",
        }}
      />
    </>
  );
}
