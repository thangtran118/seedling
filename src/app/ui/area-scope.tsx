import "server-only";
import Link from "next/link";
import type { AreaOption } from "@/lib/access/areas";
import type { SessionUser } from "@/lib/access/auth";
import { isRegionLeader } from "@/lib/access/scope";

// The "Của tôi / Khu vực / Địa vực" tabs of the Hôm nay, Lịch, Chiên and Thống kê pages, in the URL as ?xem=.
// - cua-toi: the viewer's own (sessions they are in, listeners they walk with), in any area of the region;
// - khu-vuc: the viewer's own area;
// - dia-vuc: the whole region. Only there, the region leader may narrow it to one area (?kv=<area id>).
export type View = "cua-toi" | "khu-vuc" | "dia-vuc";

export const VIEWS: { key: View; label: string }[] = [
  { key: "cua-toi", label: "Của tôi" },
  { key: "khu-vuc", label: "Khu vực" },
  { key: "dia-vuc", label: "Địa vực" },
];

export type ViewScope = {
  view: View;
  fallback: View; // the page's default tab, left out of the URL
  areaId: number | undefined; // the one area shown (khu-vuc, or dia-vuc narrowed by the region leader)
  kv: string; // ?kv= value, "" unless the region leader narrowed the region to one area
};

export function resolveView(
  user: SessionUser,
  areas: AreaOption[],
  params: { xem?: string; kv?: string },
  fallback: View,
): ViewScope {
  const view = VIEWS.find((v) => v.key === params.xem)?.key ?? fallback;
  if (view === "khu-vuc") return { view, fallback, areaId: user.areaId, kv: "" };
  if (view === "dia-vuc" && isRegionLeader(user)) {
    const picked = areas.find((a) => String(a.id) === params.kv);
    if (picked) return { view, fallback, areaId: picked.id, kv: String(picked.id) };
  }
  return { view, fallback, areaId: undefined, kv: "" };
}

// Query string for a tab (the area pick is kept only on the Địa vực tab), plus the page's own parameters.
export function viewQuery(scope: ViewScope, next: { view?: View; kv?: string }, extra: Record<string, string> = {}) {
  const view = next.view ?? scope.view;
  const p = new URLSearchParams();
  if (view !== scope.fallback) p.set("xem", view);
  const kv = view === "dia-vuc" ? (next.kv ?? (next.view ? "" : scope.kv)) : "";
  if (kv) p.set("kv", kv);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

// Three equal tabs; counts optional. Under them, for the region leader on the Địa vực tab only, one chip per area.
export function ViewTabs({
  user,
  areas,
  scope,
  href,
  counts,
}: {
  user: SessionUser;
  areas: AreaOption[];
  scope: ViewScope;
  href: (next: { view?: View; kv?: string }) => string;
  counts?: Record<View, number>;
}) {
  const pickArea = scope.view === "dia-vuc" && isRegionLeader(user) && areas.length > 1;
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Xem" className="md:max-w-xl">
        <ul className="grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1">
          {VIEWS.map((v) => {
            const on = v.key === scope.view;
            return (
              <li key={v.key}>
                <Link
                  href={href({ view: v.key })}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm transition-colors ${
                    on ? "bg-surface font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {v.label}
                  {counts && <span className="tabular-nums text-xs text-muted">{counts[v.key]}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {pickArea && (
        <nav aria-label="Khu vực trong địa vực" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-2">
            {[{ id: 0, name: "Cả địa vực" }, ...areas].map((a) => {
              const key = a.id ? String(a.id) : "";
              const on = key === scope.kv;
              return (
                <li key={a.id}>
                  <Link
                    href={href({ view: "dia-vuc", kv: key })}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={`inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm transition-colors ${
                      on
                        ? "bg-accent font-semibold text-on-accent"
                        : "border border-line bg-surface text-ink hover:bg-sunken"
                    }`}
                  >
                    {a.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export const sessionInView = (scope: ViewScope, s: { isMember: boolean; areaIds: number[] }) =>
  scope.view === "cua-toi" ? s.isMember : scope.areaId === undefined || s.areaIds.includes(scope.areaId);

export const listenerInView = (scope: ViewScope, l: { mine: boolean; area: { id: number } }) =>
  scope.view === "cua-toi" ? l.mine : scope.areaId === undefined || l.area.id === scope.areaId;

// Each tab's count: the same kv pick applies to the Địa vực tab.
export function viewCounts<T>(
  user: SessionUser,
  areas: AreaOption[],
  scope: ViewScope,
  items: T[],
  inView: (scope: ViewScope, item: T) => boolean,
): Record<View, number> {
  const of = (view: View) => {
    const sc = resolveView(user, areas, { xem: view, kv: scope.kv }, scope.fallback);
    return items.filter((i) => inView(sc, i)).length;
  };
  return { "cua-toi": of("cua-toi"), "khu-vuc": of("khu-vuc"), "dia-vuc": of("dia-vuc") };
}

// One chip per area of the region (the viewer's own first), for the region leader's Thành viên screen.
export function AreaChips({
  areas,
  current,
  href,
}: {
  areas: AreaOption[];
  current: number;
  href: (areaId: number) => string;
}) {
  if (areas.length < 2) return null;
  return (
    <nav aria-label="Khu vực" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2">
        {areas.map((a) => {
          const on = a.id === current;
          return (
            <li key={a.id}>
              <Link
                href={href(a.id)}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={`inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm transition-colors ${
                  on
                    ? "bg-accent font-semibold text-on-accent"
                    : "border border-line bg-surface text-ink hover:bg-sunken"
                }`}
              >
                {a.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
