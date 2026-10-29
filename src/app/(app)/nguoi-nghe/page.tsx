import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import { listRegionAreas } from "@/lib/access/areas";
import { listListeners, type ListenerListItem } from "@/lib/access/listeners";
import { isClosedStage } from "@/lib/domain";
import { Empty, Fab, FabStack, HeaderAction, Loading, PageHeader, TextLink } from "@/app/ui/kit";
import { listenerInView, resolveView, viewCounts, viewQuery, ViewTabs } from "@/app/ui/area-scope";
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
    match: (l: ListenerListItem) => l.stage === "moi_quen" || l.stage === "goi_mo",
  },
  {
    key: "manh",
    label: "Đang nghe", // any route; the key stays "manh" so saved links keep working
    match: (l: ListenerListItem) => !isClosedStage(l.stage) && l.lessons.length > 0,
  },
  { key: "baptem", label: "Báptem", match: (l: ListenerListItem) => l.stage === "baptem" },
  { key: "tu-choi", label: "Từ chối", match: (l: ListenerListItem) => l.stage === "tu_choi" },
] as const;

async function List({ searchParams }: { searchParams: PageProps<"/nguoi-nghe">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = firstParam(sp.q) ?? "";
  const filter = FILTERS.find((f) => f.key === firstParam(sp.tt)) ?? FILTERS[0];
  const [everyone, areas] = await Promise.all([listListeners(user, { query: q }), listRegionAreas(user)]);
  // Của tôi (default): linked or gone on a session with, in any area; Khu vực; Địa vực (area-scope.tsx). Old links
  // used ?tab=khu-vuc.
  const xem = firstParam(sp.xem) ?? (firstParam(sp.tab) === "khu-vuc" ? "khu-vuc" : undefined);
  const scope = resolveView(user, areas, { xem, kv: firstParam(sp.kv) }, "cua-toi");
  const all = everyone.filter((l) => listenerInView(scope, l));
  const list = all.filter(filter.match);
  const counts = viewCounts(user, areas, scope, everyone, listenerInView);
  const href = (next: Parameters<typeof viewQuery>[1] & { tt?: string }) =>
    `/nguoi-nghe${viewQuery(scope, next, { q, tt: next.tt ?? filter.key })}`;

  return (
    <>
      <div className="flex flex-col gap-3">
        <ViewTabs user={user} areas={areas} scope={scope} counts={counts} href={href} />
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
                    href={href({ tt: f.key })}
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
            {scope.view === "cua-toi"
              ? "Bạn chưa đồng hành hay đi ca với chiên nào."
              : `${scope.view === "dia-vuc" && scope.areaId === undefined ? "Địa vực" : "Khu vực"} chưa có chiên nào.`}
          </Empty>
        ))}
      {list.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {list.map((l) => (
            <ListenerCard key={l.id} l={l} />
          ))}
        </div>
      )}
      <FabStack>
        <Fab href={q ? `/nguoi-nghe/moi?ten=${encodeURIComponent(q)}` : "/nguoi-nghe/moi"}>Thêm chiên</Fab>
      </FabStack>
    </>
  );
}
