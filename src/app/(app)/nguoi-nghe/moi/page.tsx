import { Suspense } from "react";
import type { Metadata } from "next";
import { createListenerAction } from "@/app/actions/listeners";
import { requireUser } from "@/lib/access/current-user";
import { Loading, PageHeader } from "@/app/ui/kit";
import { ListenerForm } from "@/app/ui/listener-form";

export const metadata: Metadata = { title: "Thêm chiên · Seedling" };

export default function NewListenerPage() {
  return (
    <>
      <PageHeader title="Thêm chiên" back="/nguoi-nghe" />
      <Suspense fallback={<Loading />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await requireUser();
  return (
    <ListenerForm
      mode="create"
      submit={createListenerAction}
      initial={{
        name: "",
        birthYear: "",
        manualStatus: "moi_quen",
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
