import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { areaStats, memberMonthTable, myStats } from "@/lib/access/stats";
import { Loading, PageHeader, Section } from "@/app/ui/kit";
import { MemberMonthTable, OverviewTiles } from "@/app/ui/listener-stats";

export const metadata: Metadata = { title: "Thống kê · Seedling" };

export default function StatsPage() {
  return (
    <>
      <PageHeader title="Thống kê" />
      <Suspense fallback={<Loading />}>
        <Stats />
      </Suspense>
    </>
  );
}

// Everyone: their own numbers and the area's member table for this month. The area leader also gets the same
// numbers for the whole area. Counts only, no private fields.
async function Stats() {
  const user = await requireUser();
  const now = new Date();
  const isLeader = user.role === "area_leader";
  const [mine, table, area] = await Promise.all([
    myStats(user, now),
    memberMonthTable(user, now),
    isLeader ? areaStats(user, now) : null,
  ]);
  return (
    <>
      <Section title="Của tôi">
        <OverviewTiles st={mine} />
      </Section>

      {area && (
        <Section title="Cả khu vực">
          <OverviewTiles st={area.overview} />
        </Section>
      )}

      <Section title="Thành viên khu vực · tháng này">
        <MemberMonthTable rows={table} viewerId={user.id} linkRows={isLeader} />
      </Section>
    </>
  );
}
