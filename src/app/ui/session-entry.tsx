import { planSessionAction } from "@/app/actions/sessions";
import { requireUser } from "@/lib/access/current-user";
import { listListeners } from "@/lib/access/listeners";
import { listAreaMembers } from "@/lib/access/members";
import { floorToQuarterHour, toLocalInputValue } from "@/lib/domain";
import { firstParam } from "./load";
import { Empty } from "./kit";
import { SessionForm } from "./session-form";

const DAY_MS = 24 * 60 * 60 * 1000;

// Planning defaults to the same time tomorrow. Kept outside the component (render must be pure).
function defaultStartsAt(now = new Date()) {
  return toLocalInputValue(floorToQuarterHour(new Date(now.getTime() + DAY_MS)));
}

// /ca/hen: plan a session ("Đặt lịch trudo").
export async function SessionEntry({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const preselect = firstParam((await searchParams)["nguoi-nghe"]);
  const [all, members] = await Promise.all([listListeners(user), listAreaMembers(user)]);
  // Planning is for direct companions only: only the viewer's own listeners can be picked.
  const listeners = all.filter((l) => l.linked);
  const selected = listeners.find((l) => l.id === preselect);
  if (listeners.length === 0) {
    return (
      <Empty>
        Bạn chưa đồng hành với chiên nào nên chưa đặt lịch được. Người đồng hành hoặc khu vực trưởng có thể thêm bạn vào
        phần “Người đồng hành” của chiên đó.
      </Empty>
    );
  }

  return (
    <SessionForm
      mode="plan"
      currentUserId={user.id}
      listeners={listeners.map(({ id, name, status, lessons, linked }) => ({ id, name, status, lessons, linked }))}
      members={members.map(({ id, name }) => ({ id, name }))}
      submit={planSessionAction}
      initial={{
        listenerIds: selected ? [selected.id] : [],
        memberIds: [],
        startsAt: defaultStartsAt(),
        locationLabel: "",
        mapUrl: "",
        summary: "",
      }}
    />
  );
}
