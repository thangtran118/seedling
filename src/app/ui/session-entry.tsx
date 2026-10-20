import { planSessionAction, recordSessionAction } from "@/app/actions/sessions";
import { requireUser } from "@/lib/access/current-user";
import { listListeners } from "@/lib/access/listeners";
import { listAreaMembers } from "@/lib/access/members";
import { recordPrefill } from "@/lib/access/sessions";
import { nextLesson, floorToQuarterHour, toLocalInputValue } from "@/lib/domain";
import { firstParam } from "./load";
import { Empty } from "./kit";
import { SessionForm, type Prefill } from "./session-form";

const DAY_MS = 24 * 60 * 60 * 1000;

// Recording defaults to now; planning to the same time tomorrow. Kept outside the component (render must be pure).
function defaultStartsAt(mode: "record" | "plan", now = new Date()) {
  return toLocalInputValue(floorToQuarterHour(mode === "record" ? now : new Date(now.getTime() + DAY_MS)));
}

// Shared by /ca/ghi (record a finished session) and /ca/hen (plan one).
export async function SessionEntry({
  mode,
  searchParams,
}: {
  mode: "record" | "plan";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const preselect = firstParam((await searchParams)["nguoi-nghe"]);
  const [all, members] = await Promise.all([listListeners(user), listAreaMembers(user)]);
  // Recording writes into a listener's history, so only the viewer's own listeners can be picked.
  const listeners = mode === "record" ? all.filter((l) => l.linked) : all;
  const selected = listeners.find((l) => l.id === preselect);
  if (mode === "record" && listeners.length === 0) {
    return (
      <Empty>
        Bạn chưa đồng hành với chiên nào nên chưa ghi ca được. Người đồng hành hoặc khu vực trưởng có thể thêm bạn vào
        phần “Người đồng hành” của chiên đó.
      </Empty>
    );
  }

  // Prefill companions and place for each of the viewer's listeners: one small query each.
  const prefill: Prefill = {};
  if (mode === "record") {
    const targets = listeners;
    const results = await Promise.all(targets.map((l) => recordPrefill(user, l.id)));
    targets.forEach((l, i) => (prefill[l.id] = results[i]));
  }

  const p = selected ? prefill[selected.id] : undefined;
  const next = selected ? nextLesson(selected.lessons) : null;

  return (
    <SessionForm
      mode={mode}
      currentUserId={user.id}
      listeners={listeners.map(({ id, name, status, lessons, linked }) => ({ id, name, status, lessons, linked }))}
      members={members.map(({ id, name }) => ({ id, name }))}
      prefill={prefill}
      submit={mode === "record" ? recordSessionAction : planSessionAction}
      initial={{
        listenerIds: selected ? [selected.id] : [],
        memberIds: p?.memberIds ?? [],
        lessons: selected && next && mode === "record" ? { [selected.id]: [next] } : {},
        meetOnly: false,
        startsAt: defaultStartsAt(mode),
        locationLabel: p?.locationLabel ?? "",
        locationDetail: "",
        summary: "",
      }}
    />
  );
}
