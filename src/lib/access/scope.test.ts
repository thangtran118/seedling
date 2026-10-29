// Permission matrix for scope.ts: five roles in one region plus someone from another region, against a listener of
// area 1. Run with `pnpm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAddLinks,
  canAddNote,
  canManageMember,
  canRemoveLinks,
  canSeeContact,
  inRegion,
  leadsArea,
  requireAreaInRegion,
  requireCanManageMember,
  requireRegionLeader,
  type Viewer,
} from "./scope";
import { AccessError } from "./errors";

const REGION = 1;
const viewers: Record<string, Viewer> = {
  memberSame: { id: 1, role: "member", areaId: 1, regionId: REGION },
  memberOther: { id: 2, role: "member", areaId: 2, regionId: REGION },
  leaderSame: { id: 3, role: "area_leader", areaId: 1, regionId: REGION },
  leaderOther: { id: 4, role: "area_leader", areaId: 2, regionId: REGION },
  regionLeader: { id: 5, role: "region_leader", areaId: 2, regionId: REGION }, // home area 2, not the listener's
  otherRegion: { id: 6, role: "region_leader", areaId: 9, regionId: 2 },
};
const listener = { areaId: 1, regionId: REGION };

type Row = Record<keyof typeof viewers, boolean>;
const all = (b: boolean): Row => Object.fromEntries(Object.keys(viewers).map((k) => [k, b])) as Row;
const only = (...keys: (keyof typeof viewers)[]): Row =>
  Object.fromEntries(Object.keys(viewers).map((k) => [k, keys.includes(k)])) as Row;

function check(name: string, f: (v: Viewer) => boolean, expected: Row) {
  it(name, () => {
    for (const [k, v] of Object.entries(viewers)) assert.equal(f(v), expected[k], `${name}: ${k}`);
  });
}

describe("listener in area 1", () => {
  // Summaries, history, notes and session notes: the whole region, linked or not.
  check("sees summary, history and notes", (v) => inRegion(v, listener), { ...all(true), otherRegion: false });

  check("sees contact, not linked", (v) => canSeeContact(v, listener, false), only("leaderSame", "regionLeader"));
  check("sees contact, linked", (v) => canSeeContact(v, listener, true), { ...all(true), otherRegion: false });

  check("adds a note, not linked", (v) => canAddNote(v, listener, false), all(false));
  check("adds a note, linked (any area)", (v) => canAddNote(v, listener, true), { ...all(true), otherRegion: false });

  check("adds người đồng hành, not linked", (v) => canAddLinks(v, listener, false), only("leaderSame", "regionLeader"));
  check("adds người đồng hành, linked", (v) => canAddLinks(v, listener, true), { ...all(true), otherRegion: false });
  check("removes người đồng hành", (v) => canRemoveLinks(v, listener), only("leaderSame", "regionLeader"));
});

describe("accounts and stats of area 1", () => {
  const member = { areaId: 1, regionId: REGION, role: "member" as const };
  const leader = { areaId: 1, regionId: REGION, role: "area_leader" as const };
  check("manages a member", (v) => canManageMember(v, member), only("leaderSame", "regionLeader"));
  check("manages the area leader", (v) => canManageMember(v, leader), only("regionLeader"));
  check("sees one member's stats", (v) => leadsArea(v, member), only("leaderSame", "regionLeader"));
  check("leads the region leader's home area 2", (v) => leadsArea(v, { areaId: 2, regionId: REGION }), {
    ...only("leaderOther", "regionLeader"),
  });

  it("refuses managing someone from another region as not found", () => {
    assert.throws(
      () => requireCanManageMember(viewers.otherRegion, member),
      (e: unknown) => e instanceof AccessError && e.code === "not_found",
    );
  });
});

describe("region management", () => {
  check(
    "requireRegionLeader",
    (v) => {
      try {
        requireRegionLeader(v);
        return true;
      } catch {
        return false;
      }
    },
    only("regionLeader", "otherRegion"),
  );

  it("an area of another region is not found", () => {
    assert.throws(
      () => requireAreaInRegion(viewers.regionLeader, { regionId: 2 }),
      (e: unknown) => e instanceof AccessError && e.code === "not_found",
    );
    assert.throws(() => requireAreaInRegion(viewers.memberSame, null), AccessError);
    assert.doesNotThrow(() => requireAreaInRegion(viewers.memberOther, { regionId: REGION }));
  });
});
