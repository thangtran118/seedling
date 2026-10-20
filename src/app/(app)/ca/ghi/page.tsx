import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading, PageHeader } from "@/app/ui/kit";
import { SessionEntry } from "@/app/ui/session-entry";

export const metadata: Metadata = { title: "Ghi ca · Seedling" };

export default function RecordPage(props: PageProps<"/ca/ghi">) {
  return (
    <>
      <PageHeader title="Ghi ca vừa xong" back="/" />
      <Suspense fallback={<Loading />}>
        <SessionEntry mode="record" searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
