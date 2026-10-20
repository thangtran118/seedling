import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { stalledListeners } from "@/lib/access/stalled";
import { STALLED_AFTER_DAYS } from "@/lib/domain";
import { Empty, Loading, PageHeader } from "@/app/ui/kit";
import { ListenerCard } from "@/app/ui/listener-card";
import { firstParam } from "@/app/ui/load";

export const metadata: Metadata = { title: "Chiên chững lại · Seedling" };

export default function StalledPage(props: PageProps<"/chung-lai">) {
  return (
    <>
      <PageHeader title="Chiên chững lại" back="/thong-ke" />
      <p className="text-sm text-muted">
        Sắp theo số ngày kể từ ca đã đi gần nhất. Người chưa có ca nào lên đầu. Gắn cờ khi quá {STALLED_AFTER_DAYS}{" "}
        ngày.
      </p>
      <Suspense fallback={<Loading />}>
        <List searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/chung-lai">["searchParams"] }) {
  const user = await requireUser();
  if (user.role !== "area_leader") notFound();
  const includeClosed = firstParam((await searchParams)["tat-ca"]) === "1";
  const list = await stalledListeners(user, { includeClosed });
  const flagged = list.filter((l) => l.flagged).length;

  return (
    <>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink">
          <b>{flagged}</b> / {list.length} người cần quan tâm
        </span>
        <Link href={includeClosed ? "/chung-lai" : "/chung-lai?tat-ca=1"} className="text-accent underline">
          {includeClosed ? "Ẩn báptem / từ chối" : "Hiện cả báptem / từ chối"}
        </Link>
      </div>
      {list.length === 0 && <Empty>Không có chiên nào.</Empty>}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {list.map((l) => (
          <ListenerCard
            key={l.id}
            l={l}
            flagged={l.flagged}
            footer={
              <p className={`text-sm ${l.flagged ? "font-medium text-late" : "text-muted"}`}>
                {l.flagged && "▲ "}
                {l.daysSince === null
                  ? "Chưa có ca nào"
                  : l.daysSince === 0
                    ? "Ca gần nhất: hôm nay"
                    : `${l.daysSince} ngày từ ca gần nhất`}
              </p>
            }
          />
        ))}
      </div>
    </>
  );
}
