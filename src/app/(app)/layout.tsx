import { Suspense } from "react";
import { getCurrentUser } from "@/lib/access/current-user";
import { BottomNav, SideNav } from "@/app/ui/nav";

// Authenticated screens. The session is read inside a Suspense boundary (Cache Components), and every page
// still calls requireUser() itself: a layout does not re-run on navigation, so it is not an auth check.
// Bottom padding on phones clears the tab bar and the floating "Đặt lịch trudo" button.
// Width: dashboards (home, calendar, stats, lists) use the full column; form screens narrow it in their own layout.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="flex w-full flex-1 flex-col px-4 pb-40 pt-4 md:pb-10 md:pl-68 md:pr-8 md:pt-8">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 md:max-w-6xl">{children}</div>
      </main>
      <Suspense fallback={null}>
        <Nav />
      </Suspense>
    </>
  );
}

async function Nav() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return null;
  const isLeader = user.role === "area_leader";
  return (
    <>
      <SideNav isLeader={isLeader} name={user.name} areaRole={isLeader ? "Khu vực trưởng" : "Thánh đồ"} />
      <BottomNav isLeader={isLeader} />
    </>
  );
}
