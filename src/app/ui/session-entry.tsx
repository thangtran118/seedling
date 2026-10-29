import { planSessionAction } from "@/app/actions/sessions";
import { requireUser } from "@/lib/access/current-user";
import { listListeners } from "@/lib/access/listeners";
import { listAreaMembers } from "@/lib/access/members";
import { dayKey, floorToQuarterHour, parseDayKey, toLocalInputValue } from "@/lib/domain";
import { firstParam } from "./load";
import { SessionForm } from "./session-form";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Planning defaults to the same time tomorrow. A day picked on the calendar (?ngay=) keeps that clock time on
// that day; today means an hour from now. Kept outside the component (render must be pure).
function defaultStartsAt(day: string | null, now = new Date()) {
  const today = dayKey(now);
  if (day === today) return toLocalInputValue(floorToQuarterHour(new Date(now.getTime() + HOUR_MS)));
  if (day && day > today) return `${day}T${toLocalInputValue(floorToQuarterHour(now)).slice(11)}`;
  return toLocalInputValue(floorToQuarterHour(new Date(now.getTime() + DAY_MS)));
}

// /ca/hen: plan a session ("Đặt lịch trudo").
export async function SessionEntry({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const preselect = Number(firstParam(sp["nguoi-nghe"]));
  const day = parseDayKey(firstParam(sp.ngay)) ?? null;
  const [all, members] = await Promise.all([listListeners(user), listAreaMembers(user)]);
  // Planning is for direct companions only: only the viewer's own listeners can be picked.
  const listeners = all.filter((l) => l.linked);
  const selected = listeners.find((l) => l.id === preselect);
  // ?loai=tiep-xuc opens on outreach; so does having no listener to visit (the form explains why).
  const kind = listeners.length === 0 || firstParam(sp.loai) === "tiep-xuc" ? "outreach" : "visit";

  return (
    <SessionForm
      mode="plan"
      currentUserId={user.id}
      listeners={listeners.map(({ id, name, stage, route, linked }) => ({ id, name, stage, route, linked }))}
      members={members.map(({ id, name }) => ({ id, name }))}
      submit={planSessionAction}
      initial={{
        kind,
        listenerIds: selected ? [selected.id] : [],
        memberIds: [],
        startsAt: defaultStartsAt(day),
        locationLabel: "",
        mapUrl: "",
        summary: "",
      }}
    />
  );
}
