import { Suspense } from "react";
import type { Metadata } from "next";
import { createListenerAction } from "@/app/actions/listeners";
import { listRegionAreas } from "@/lib/access/areas";
import { requireUser } from "@/lib/access/current-user";
import { isRegionLeader } from "@/lib/access/scope";
import { Loading, PageHeader } from "@/app/ui/kit";
import { ListenerForm } from "@/app/ui/listener-form";
import { firstParam } from "@/app/ui/load";
import { DEFAULT_ROUTE } from "@/lib/domain";

export const metadata: Metadata = { title: "Thêm chiên · Seedling" };

export default function NewListenerPage(props: PageProps<"/nguoi-nghe/moi">) {
  return (
    <>
      <PageHeader title="Thêm chiên" back="/nguoi-nghe" />
      <Suspense fallback={<Loading />}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

// ?ten= carries the name typed into the list's search box when nobody matched. The region leader, who belongs to no
// area, picks the listener's area.
async function Form({ searchParams }: { searchParams: PageProps<"/nguoi-nghe/moi">["searchParams"] }) {
  const user = await requireUser();
  const areas = isRegionLeader(user) ? await listRegionAreas(user) : undefined;
  const name = (firstParam((await searchParams).ten) ?? "").trim().slice(0, 100);
  return (
    <ListenerForm
      mode="create"
      submit={createListenerAction}
      areas={areas}
      initial={{
        name,
        birthYear: "",
        route: DEFAULT_ROUTE,
        stage: "moi_quen",
        phone: "",
        hometown: "",
        facebook: "",
        zalo: "",
        telegram: "",
        notes: "",
      }}
    />
  );
}
