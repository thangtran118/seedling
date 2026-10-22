import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/access/current-user";
import type { SessionUser } from "@/lib/access/auth";
import { areaStats, myStats, type MemberStatsRow } from "@/lib/access/stats";
import { Empty, Loading, PageHeader, Section } from "@/app/ui/kit";
import { pct, rate, StatsHistory, StatsTiles } from "@/app/ui/listener-stats";

export const metadata: Metadata = { title: "Thống kê · Seedling" };

export default function StatsPage() {
  return (
    <>
      <PageHeader title="Thống kê" />
      <Suspense fallback={<Loading />}>
        <Stats />
      </Suspense>
    </>
  );
}

// Members see the listeners they walk with; the area leader also sees the whole area and each member.
// Every number is compared with last month only; the tables hold the full monthly history.
async function Stats() {
  const user = await requireUser();
  const now = new Date();
  return user.role === "area_leader" ? <AreaStatsView user={user} now={now} /> : <MyStats user={user} now={now} />;
}

async function MyStats({ user, now }: { user: SessionUser; now: Date }) {
  const st = await myStats(user, now);
  return (
    <>
      <p className="-mt-3 text-sm text-muted">Chiên bạn đồng hành, so với tháng trước.</p>
      <StatsTiles st={st} />
      <Section title="Lịch sử theo tháng">
        <StatsHistory history={st.history} />
      </Section>
    </>
  );
}

async function AreaStatsView({ user, now }: { user: SessionUser; now: Date }) {
  const [{ area, members }, mine] = await Promise.all([areaStats(user, now), myStats(user, now)]);
  return (
    <>
      <p className="-mt-3 text-sm text-muted">So với tháng trước. Không chứa thông tin riêng tư.</p>

      <Section title="Cả khu vực">
        <StatsTiles st={area} />
      </Section>

      <Section title="Chiên tôi đồng hành">
        <StatsTiles st={mine} size="sm" />
      </Section>

      <Section title={`Thánh đồ trong khu vực (${members.length})`}>
        <MemberList members={members} />
      </Section>

      <Section title="Lịch sử khu vực theo tháng">
        <StatsHistory history={area.history} />
      </Section>
    </>
  );
}

function MemberList({ members }: { members: MemberStatsRow[] }) {
  if (members.length === 0) return <Empty>Khu vực chưa có thành viên.</Empty>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface md:grid md:grid-cols-2 md:divide-y-0">
      {members.map((m) => {
        const c = m.current;
        return (
          <li key={m.id} className="md:border-b md:border-line md:odd:border-r">
            <Link
              href={`/thong-ke/thanh-vien/${m.id}`}
              className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-sunken/60 active:bg-line/30"
            >
              <span className="w-9 shrink-0 text-center text-2xl font-bold tabular-nums text-ink">{c.total}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold text-ink">
                  {m.name}
                  {m.role === "area_leader" && <span className="font-normal text-muted"> · khu vực trưởng</span>}
                </span>
                <span className="truncate text-xs text-muted tabular-nums">
                  chiên · {c.added} mới tháng này · nghe lẽ thật {pct(rate(c.heard, c.total))} · báptem{" "}
                  {pct(rate(c.baptized, c.total))}
                </span>
              </span>
              <span className="text-muted" aria-hidden>
                ›
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
