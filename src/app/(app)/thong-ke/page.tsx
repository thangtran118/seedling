import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { listRegionAreas } from "@/lib/access/areas";
import { leadsArea } from "@/lib/access/scope";
import { areaStats, memberMonthTable, myStats, regionStats } from "@/lib/access/stats";
import { Loading, PageHeader, Section } from "@/app/ui/kit";
import { resolveView, viewQuery, ViewTabs } from "@/app/ui/area-scope";
import { firstParam } from "@/app/ui/load";
import { MemberMonthTable, OverviewTiles } from "@/app/ui/listener-stats";

export const metadata: Metadata = { title: "Thống kê · Seedling" };

export default function StatsPage(props: PageProps<"/thong-ke">) {
  return (
    <>
      <PageHeader title="Thống kê" />
      <Suspense fallback={<Loading />}>
        <Stats searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

// Everyone: their own numbers, their area's and the whole region's (area-scope.tsx tabs), one set at a time so a
// phone screen shows one block of tiles; and an area's member table for this month (their own area; the region
// leader's pick on the Địa vực tab). Counts only, no private fields.
async function Stats({ searchParams }: { searchParams: PageProps<"/thong-ke">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const areas = await listRegionAreas(user);
  const scope = resolveView(user, areas, { xem: firstParam(sp.xem), kv: firstParam(sp.kv) }, "cua-toi");
  const tableArea = scope.areaId ?? user.areaId;
  const areaName = (id: number) => areas.find((a) => a.id === id)?.name ?? "Khu vực";
  const [overview, table] = await Promise.all([
    scope.view === "cua-toi"
      ? myStats(user, now)
      : scope.areaId !== undefined
        ? areaStats(user, now, scope.areaId).then((a) => a.overview)
        : regionStats(user, now).then((a) => a.overview),
    memberMonthTable(user, now, tableArea),
  ]);
  const title =
    scope.view === "cua-toi" ? "Của tôi" : scope.areaId !== undefined ? areaName(scope.areaId) : "Cả địa vực";
  return (
    <>
      <ViewTabs user={user} areas={areas} scope={scope} href={(n) => `/thong-ke${viewQuery(scope, n)}`} />
      <Section title={title}>
        <OverviewTiles st={overview} />
      </Section>

      <Section title={`Thành viên ${areaName(tableArea)} · tháng này`}>
        <MemberMonthTable
          rows={table}
          viewerId={user.id}
          linkRows={leadsArea(user, { areaId: tableArea, regionId: user.regionId })}
        />
      </Section>
    </>
  );
}
