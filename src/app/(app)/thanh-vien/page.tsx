import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listRegionAreas } from "@/lib/access/areas";
import { requireUser } from "@/lib/access/current-user";
import { listMembersForAdmin } from "@/lib/access/members";
import { isLeader, isRegionLeader } from "@/lib/access/scope";
import { AreaChips } from "@/app/ui/area-scope";
import { Loading, PageHeader, Section } from "@/app/ui/kit";
import { firstParam } from "@/app/ui/load";
import { CreateMemberForm, MemberRow } from "@/app/ui/members-admin";

export const metadata: Metadata = { title: "Thành viên · Seedling" };

export default function MembersPage(props: PageProps<"/thanh-vien">) {
  return (
    <>
      <PageHeader title="Thành viên" />
      <Suspense fallback={<Loading />}>
        <Members searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

// An area leader manages their own area; the region leader picks any area of the region (?kv=) and may move members
// between areas.
async function Members({ searchParams }: { searchParams: PageProps<"/thanh-vien">["searchParams"] }) {
  const user = await requireUser();
  if (!isLeader(user)) notFound();
  const regionLeader = isRegionLeader(user);
  const areas = await listRegionAreas(user);
  const kv = regionLeader ? firstParam((await searchParams).kv) : undefined;
  // The region leader belongs to no area: their list opens on the first area.
  const areaId = areas.find((a) => String(a.id) === kv)?.id ?? user.areaId ?? areas[0]?.id;
  if (areaId === undefined) return <p className="text-sm text-muted">Địa vực chưa có khu vực nào.</p>;
  const members = await listMembersForAdmin(user, areaId);
  const moveTo = regionLeader ? areas.filter((a) => a.id !== areaId) : [];
  const areaName = areas.find((a) => a.id === areaId)?.name ?? "Khu vực";
  return (
    <>
      {regionLeader && <AreaChips areas={areas} current={areaId} href={(id) => `/thanh-vien?kv=${id}`} />}
      <Section title={`Tạo tài khoản · ${areaName}`}>
        <CreateMemberForm key={areaId} areaId={areaId} />
      </Section>
      <Section title={`${areaName} (${members.filter((m) => m.active).length})`}>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} isSelf={m.id === user.id} moveTo={moveTo} />
          ))}
        </ul>
      </Section>
    </>
  );
}
