import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requireUser } from "@/lib/access/current-user";
import { memberStats } from "@/lib/access/stats";
import { Empty, Loading, PageHeader, Section } from "@/app/ui/kit";
import { ListenerRows } from "@/app/ui/listener-card";
import { StatsHistory, StatsTiles } from "@/app/ui/listener-stats";
import { loadOr404 } from "@/app/ui/load";

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
        {st.member.role === "area_leader" ? "Khu vực trưởng" : "Thánh đồ"} · chiên người này đồng hành
      </p>
      <StatsTiles st={st} />
      <Section title="Lịch sử theo tháng">
        <StatsHistory history={st.history} />
      </Section>
      <Section title={`Chiên đồng hành (${st.listeners.length})`}>
        {st.listeners.length ? (
          <ListenerRows items={st.listeners} now={now} />
        ) : (
          <Empty>Người này chưa đồng hành với chiên nào.</Empty>
        )}
      </Section>
    </>
  );
}
