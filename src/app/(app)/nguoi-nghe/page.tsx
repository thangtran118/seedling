import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { listListeners, type ListenerSummary } from "@/lib/access/listeners";
import { isClosedStage } from "@/lib/domain";
import { Empty, Fab, FabStack, HeaderAction, Loading, PageHeader, TextLink } from "@/app/ui/kit";
import { ListenerCard } from "@/app/ui/listener-card";
import { firstParam } from "@/app/ui/load";
import { SearchBox } from "@/app/ui/search-box";

export const metadata: Metadata = { title: "Chiên · Seedling" };

export default function ListenersPage(props: PageProps<"/nguoi-nghe">) {
  return (
    <>
      <PageHeader
        title="Chiên"
        actionDesktopOnly
        action={<HeaderAction href="/nguoi-nghe/moi">+ Thêm chiên</HeaderAction>}
      />
      <Suspense fallback={<Loading />}>
        <List searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

// Filter chips by where the listener stands; ?tt= in the URL so a filtered list can be shared or reloaded.
const FILTERS = [
  { key: "", label: "Tất cả", match: () => true },
  {
    key: "chua-manh",
    label: "Mới quen\nGợi mở",
    match: (l: ListenerSummary) => l.stage === "moi_quen" || l.stage === "goi_mo",
  },
  {
    key: "manh",
    label: "Đang nghe", // any route; the key stays "manh" so saved links keep working
    match: (l: ListenerSummary) => !isClosedStage(l.stage) && l.lessons.length > 0,
  },
  { key: "baptem", label: "Báptem", match: (l: ListenerSummary) => l.stage === "baptem" },
  { key: "tu-choi", label: "Từ chối", match: (l: ListenerSummary) => l.stage === "tu_choi" },
] as const;

async function List({ searchParams }: { searchParams: PageProps<"/nguoi-nghe">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = firstParam(sp.q) ?? "";
  const filter = FILTERS.find((f) => f.key === firstParam(sp.tt)) ?? FILTERS[0];
  const all = await listListeners(user, { query: q });
  const list = all.filter(filter.match);
  const mine = list.filter((l) => l.linked);
  const rest = list.filter((l) => !l.linked);
  const chipHref = (key: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (key) p.set("tt", key);
    const s = p.toString();
    return s ? `/nguoi-nghe?${s}` : "/nguoi-nghe";
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <SearchBox placeholder="Tìm theo tên…" />
        {/* Five equal cells in one row: no sideways scrolling on a phone, and the counts read as an overview. */}
        <nav aria-label="Lọc theo trạng thái" className="md:max-w-xl">
          <ul className="grid grid-cols-5 overflow-hidden rounded-2xl border border-line bg-surface">
            {FILTERS.map((f) => {
              const on = f === filter;
              const n = all.filter(f.match).length;
              return (
                <li key={f.key} className="border-l border-line first:border-l-0">
                  <Link
                    href={chipHref(f.key)}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={`flex h-full min-h-16 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-center transition-colors ${
                      on ? "bg-accent text-on-accent" : "text-ink hover:bg-sunken"
                    }`}
                  >
                    <span className="text-lg font-bold leading-none tabular-nums">{n}</span>
                    <span
                      className={`whitespace-pre-line text-[11px] leading-tight ${on ? "font-semibold" : "text-muted"}`}
                    >
                      {f.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      {list.length === 0 &&
        (q || filter.key ? (
          <Empty
            action={
              q ? (
                <TextLink href={`/nguoi-nghe/moi?ten=${encodeURIComponent(q)}`}>+ Thêm “{q}” làm chiên mới</TextLink>
              ) : undefined
            }
          >
            Không tìm thấy chiên nào.
          </Empty>
        ) : (
          <Empty action={<TextLink href="/nguoi-nghe/moi">+ Thêm chiên đầu tiên</TextLink>}>
            {user.role === "area_leader" ? "Khu vực chưa có chiên nào." : "Bạn chưa đồng hành với chiên nào."}
          </Empty>
        ))}
      {mine.length > 0 && <Group title={`Bạn đồng hành (${mine.length})`} items={mine} />}
      {rest.length > 0 && <Group title={`Người khác đồng hành (${rest.length})`} items={rest} />}
      <FabStack>
        <Fab href={q ? `/nguoi-nghe/moi?ten=${encodeURIComponent(q)}` : "/nguoi-nghe/moi"}>Thêm chiên</Fab>
      </FabStack>
    </>
  );
}

function Group({ title, items }: { title: string; items: ListenerSummary[] }) {
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
