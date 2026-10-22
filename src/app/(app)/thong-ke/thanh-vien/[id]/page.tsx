import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requireUser } from "@/lib/access/current-user";
import { memberStats } from "@/lib/access/stats";
import { Loading, PageHeader } from "@/app/ui/kit";
import { loadOr404 } from "@/app/ui/load";
import { PersonalStatsView } from "@/app/ui/personal-stats";

export const metadata: Metadata = { title: "Thống kê thành viên · Seedling" };

export default function MemberStatsPage(props: PageProps<"/thong-ke/thanh-vien/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Detail params={props.params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/thong-ke/thanh-vien/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) notFound();
  const now = new Date();
  const st = await loadOr404(memberStats(user, id, now));
  return (
    <>
      <PageHeader title={st.member.name} back="/thong-ke" />
      <p className="-mt-3 text-sm text-muted">
        {st.member.role === "area_leader" ? "Khu vực trưởng" : "Thánh đồ"} · chỉ đếm ca đã đi
      </p>
      <PersonalStatsView
        st={st}
        listeners={st.listeners}
        now={now}
        emptyListeners="Người này chưa đồng hành với chiên nào."
      />
    </>
  );
}
