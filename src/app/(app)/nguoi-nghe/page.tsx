import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { listListeners } from "@/lib/access/listeners";
import { Empty, Loading, PageHeader } from "@/app/ui/kit";
import { ListenerCard } from "@/app/ui/listener-card";
import { firstParam } from "@/app/ui/load";
import Link from "next/link";

export const metadata: Metadata = { title: "Chiên · Seedling" };

export default function ListenersPage(props: PageProps<"/nguoi-nghe">) {
  return (
    <>
      <PageHeader
        title="Chiên"
        action={
          <Link href="/nguoi-nghe/moi" className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-on-accent">
            + Thêm
          </Link>
        }
      />
      <Suspense fallback={<Loading />}>
        <List searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/nguoi-nghe">["searchParams"] }) {
  const user = await requireUser();
  const q = firstParam((await searchParams).q) ?? "";
  const list = await listListeners(user, { query: q });
  const mine = list.filter((l) => l.linked);
  const rest = list.filter((l) => !l.linked);

  return (
    <>
      <form className="flex gap-2 md:max-w-xl">
        <input
          name="q"
          defaultValue={q}
          placeholder="Tìm theo tên…"
          className="h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-base"
        />
        <button className="h-11 rounded-lg border border-line px-4 text-sm">Tìm</button>
      </form>
      {list.length === 0 && (
        <Empty>
          {q
            ? "Không tìm thấy."
            : user.role === "area_leader"
              ? "Khu vực chưa có chiên nào."
              : "Bạn chưa đồng hành với chiên nào."}
        </Empty>
      )}
      {mine.length > 0 && <Group title="Bạn đồng hành" items={mine} />}
      {rest.length > 0 && <Group title="Người khác đồng hành" items={rest} />}
    </>
  );
}

function Group({ title, items }: { title: string; items: Awaited<ReturnType<typeof listListeners>> }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {items.map((l) => (
          <ListenerCard key={l.id} l={l} />
        ))}
      </div>
    </section>
  );
}
