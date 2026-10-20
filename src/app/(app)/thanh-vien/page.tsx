import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { listMembersForAdmin } from "@/lib/access/members";
import { Loading, PageHeader, Section } from "@/app/ui/kit";
import { CreateMemberForm, MemberRow } from "@/app/ui/members-admin";

export const metadata: Metadata = { title: "Thành viên · Seedling" };

export default function MembersPage() {
  return (
    <>
      <PageHeader title="Thành viên" />
      <Suspense fallback={<Loading />}>
        <Members />
      </Suspense>
    </>
  );
}

async function Members() {
  const user = await requireUser();
  if (user.role !== "area_leader") notFound();
  const members = await listMembersForAdmin(user);
  return (
    <>
      <Section title="Tạo tài khoản">
        <CreateMemberForm />
      </Section>
      <Section title={`Khu vực (${members.filter((m) => m.active).length})`}>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} isSelf={m.id === user.id} />
          ))}
        </ul>
      </Section>
    </>
  );
}
