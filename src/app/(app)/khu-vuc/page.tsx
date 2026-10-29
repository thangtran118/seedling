import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { listRegionMembers } from "@/lib/access/members";
import { listAreas } from "@/lib/access/regions";
import { isRegionLeader } from "@/lib/access/scope";
import { Loading, PageHeader, Section } from "@/app/ui/kit";
import { AreaRow, CreateAreaForm } from "@/app/ui/regions-admin";

export const metadata: Metadata = { title: "Khu vực · Seedling" };

export default function AreasPage() {
  return (
    <>
      <PageHeader title="Khu vực" />
      <Suspense fallback={<Loading />}>
        <Areas />
      </Suspense>
    </>
  );
}

// The region leader's screen: the areas of the region, who leads each, and adding / renaming / deleting areas.
async function Areas() {
  const user = await requireUser();
  if (!isRegionLeader(user)) notFound();
  const [areas, people] = await Promise.all([listAreas(user), listRegionMembers(user)]);
  // Only plain members can be made leader; a leader elsewhere must be replaced there first.
  const candidatesFor = (areaId: number) =>
    people
      .filter((p) => p.role === "member")
      .sort((a, b) => Number(b.area?.id === areaId) - Number(a.area?.id === areaId))
      .map((p) => ({ id: p.id, label: p.area?.id === areaId ? p.name : `${p.name} · ${p.area?.name}` }));
  return (
    <>
      <Section title="Thêm khu vực">
        <CreateAreaForm />
      </Section>
      <Section title={`Địa vực (${areas.length} khu vực)`}>
        <ul className="flex flex-col gap-2">
          {areas.map((a) => (
            <AreaRow key={a.id} area={a} candidates={candidatesFor(a.id)} />
          ))}
        </ul>
      </Section>
    </>
  );
}
