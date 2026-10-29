import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { areaStats, memberMonthTable, myStats } from "@/lib/access/stats";
import Link from "next/link";
import { Loading, PageHeader, Section } from "@/app/ui/kit";
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

// Everyone: their own numbers and the area's member table for this month. The area leader also gets the same
// numbers for the whole area, one set at a time behind a switch so a phone screen shows one block of tiles.
// Counts only, no private fields.
async function Stats({ searchParams }: { searchParams: PageProps<"/thong-ke">["searchParams"] }) {
  const user = await requireUser();
  const now = new Date();
  const isLeader = user.role === "area_leader";
  const showArea = isLeader && firstParam((await searchParams).xem) === "khu-vuc";
  const [mine, table, area] = await Promise.all([
    showArea ? null : myStats(user, now),
    memberMonthTable(user, now),
    showArea ? areaStats(user, now) : null,
  ]);
  return (
    <>
      {isLeader && (
        <nav aria-label="Xem thống kê của" className="flex gap-2">
          <Chip href="/thong-ke" on={!showArea}>
            Của tôi
          </Chip>
          <Chip href="/thong-ke?xem=khu-vuc" on={showArea}>
            Cả khu vực
          </Chip>
        </nav>
      )}
      <Section title={showArea ? "Cả khu vực" : "Của tôi"}>
        <OverviewTiles st={area ? area.overview : mine!} />
      </Section>

      <Section title="Thành viên khu vực · tháng này">
        <MemberMonthTable rows={table} viewerId={user.id} linkRows={isLeader} />
      </Section>
    </>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={`inline-flex h-10 items-center rounded-full px-4 text-sm transition-colors ${
        on ? "bg-accent font-semibold text-on-accent" : "border border-line bg-surface text-ink hover:bg-sunken"
      }`}
    >
      {children}
    </Link>
  );
}
