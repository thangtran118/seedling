import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { updateListenerAction } from "@/app/actions/listeners";
import { requireUser } from "@/lib/access/current-user";
import { getListenerDetail } from "@/lib/access/listeners";
import { Loading, PageHeader } from "@/app/ui/kit";
import { ListenerForm } from "@/app/ui/listener-form";
import { loadOr404 } from "@/app/ui/load";

export const metadata: Metadata = { title: "Sửa chiên · Seedling" };

export default function EditListenerPage(props: PageProps<"/nguoi-nghe/[id]/sua">) {
  return (
    <Suspense fallback={<Loading />}>
      <Edit params={props.params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/nguoi-nghe/[id]/sua">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const l = await loadOr404(getListenerDetail(user, id));
  if (!l.canEdit || !l.private) notFound();
  const p = l.private;
  return (
    <>
      <PageHeader title={`Sửa: ${l.name}`} back={`/nguoi-nghe/${l.id}`} />
      <ListenerForm
        mode="edit"
        submit={updateListenerAction.bind(null, l.id)}
        initial={{
          name: l.name,
          birthYear: l.birthYear ? String(l.birthYear) : "",
          stage: "moi_quen",
          phone: p.phone ?? "",
          hometown: p.hometown ?? "",
          facebook: p.facebook ?? "",
          zalo: p.zalo ?? "",
          telegram: p.telegram ?? "",
          notes: p.notes ?? "",
        }}
      />
    </>
  );
}
