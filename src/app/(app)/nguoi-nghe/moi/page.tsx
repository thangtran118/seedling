import { Suspense } from "react";
import type { Metadata } from "next";
import { createListenerAction } from "@/app/actions/listeners";
import { requireUser } from "@/lib/access/current-user";
import { Loading, PageHeader } from "@/app/ui/kit";
import { ListenerForm } from "@/app/ui/listener-form";
import { firstParam } from "@/app/ui/load";

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

// ?ten= carries the name typed into the list's search box when nobody matched.
async function Form({ searchParams }: { searchParams: PageProps<"/nguoi-nghe/moi">["searchParams"] }) {
  await requireUser();
  const name = (firstParam((await searchParams).ten) ?? "").trim().slice(0, 100);
  return (
    <ListenerForm
      mode="create"
      submit={createListenerAction}
      initial={{
        name,
        birthYear: "",
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
