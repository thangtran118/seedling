import { Suspense } from "react";
import type { Metadata } from "next";
import { Loading, PageHeader } from "@/app/ui/kit";
import { SessionEntry } from "@/app/ui/session-entry";

export const metadata: Metadata = { title: "Đặt lịch trudo · Seedling" };

export default function PlanPage(props: PageProps<"/ca/hen">) {
  return (
    <>
      <PageHeader title="Đặt lịch trudo" back="/" />
      <p className="text-sm text-muted">Ca hẹn hiện trên lịch khu vực để mọi người tham gia.</p>
      <Suspense fallback={<Loading />}>
        <SessionEntry searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
