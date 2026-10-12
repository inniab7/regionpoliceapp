// lib/schedule/teams.ts 시험 — 다른 팀 근무 계산, "다음에 들어오는 팀", 등록 검사
import { describe, expect, it } from "vitest";
import type { OtherTeam, PatternId, Profile } from "../types";
import { MAX_OTHER_TEAMS, addOtherTeam, handoverGroups, otherTeamKinds, removeOtherTeam, supportsOtherTeams } from "./teams";

const NO_HOLIDAYS = new Set<string>();

function profile(pattern: PatternId, start: string | undefined = "2026-10-01"): Profile {
  return {
    effectiveFrom: "2000-01-01",
    agency: "서울청",
    department: "지구대·파출소",
    team: "1팀",
    pattern,
    patternStartDate: start,
    shiftTimes: { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } },
  };
}

// 패턴 2: 주간 → 야간 → 비번 → 휴무 (4일 순환)
// 내 시작일 10/1 → 10/1 주, 10/2 야, 10/3 비, 10/4 휴, 10/5 주 …
const teams: OtherTeam[] = [
  { teamNo: "2팀", patternStartDate: "2026-09-30" }, // 10/1 야간, 10/2 비번
  { teamNo: "3팀", patternStartDate: "2026-09-29" }, // 10/1 비번(29주 30야 10/1비), 10/2 휴무
  { teamNo: "4팀", patternStartDate: "2026-09-28" }, // 10/1 휴무, 10/2 주간
];

describe("팀별 오늘 근무", () => {
  it("내 패턴을 쓰고 시작일만 팀 것으로 센다", () => {
    expect(otherTeamKinds([profile(2)], teams, "2026-10-01", NO_HOLIDAYS)).toEqual([
      { teamNo: "2팀", kind: "야간" },
      { teamNo: "3팀", kind: "비번" },
      { teamNo: "4팀", kind: "휴무" },
    ]);
    expect(otherTeamKinds([profile(2)], teams, "2026-10-02", NO_HOLIDAYS).map((t) => t.kind)).toEqual(["비번", "휴무", "주간"]);
  });
  it("팀 시작일이 내 시작일보다 뒤여도(거꾸로 이어서) 계산한다", () => {
    expect(otherTeamKinds([profile(2)], [{ teamNo: "9팀", patternStartDate: "2026-10-10" }], "2026-10-09", NO_HOLIDAYS)[0].kind).toBe("휴무");
  });
  it("일근(패턴 5)은 팀 교대가 없어 비어 있다", () => {
    expect(supportsOtherTeams(profile(5, undefined))).toBe(false);
    expect(otherTeamKinds([profile(5, undefined)], teams, "2026-10-01", NO_HOLIDAYS)).toEqual([]);
  });
});

describe("다음에 들어오는 팀 (handoverGroups)", () => {
  it("내가 주간이면 오늘 야간에 들어오는 팀", () => {
    // 10/1 나=주간
    expect(handoverGroups([profile(2)], teams, "2026-10-01", NO_HOLIDAYS)).toEqual([{ label: "오늘 야간에 들어오는 팀", teamNos: ["2팀"] }]);
  });
  it("내가 야간이면 내일 주간에 들어오는 팀", () => {
    // 10/2 나=야간, 내일(10/3)에 주간인 팀: 2팀=10/3 휴무(…) 계산: 2팀 시작 9/30 → 10/3은 offset 3 → 휴무 / 4팀 시작 9/28 → 10/3 offset 5 → 야간 / 3팀 9/29 → offset 4 → 주간
    expect(handoverGroups([profile(2)], teams, "2026-10-02", NO_HOLIDAYS)).toEqual([{ label: "내일 주간에 들어오는 팀", teamNos: ["3팀"] }]);
  });
  it("해당하는 팀이 없어도 묶음은 남고 팀 목록이 비어 있다", () => {
    const one: OtherTeam[] = [{ teamNo: "5팀", patternStartDate: "2026-10-01" }]; // 나와 같은 날 주간
    expect(handoverGroups([profile(2)], one, "2026-10-01", NO_HOLIDAYS)).toEqual([{ label: "오늘 야간에 들어오는 팀", teamNos: [] }]);
  });
  it("쉬는 날은 오늘 근무하는 팀을 종류별로, 근무 팀이 없으면 빈 목록", () => {
    // 10/3 나=비번. 오늘 근무: 2팀=휴무(offset3), 3팀=주간(offset4), 4팀=야간(offset5)
    expect(handoverGroups([profile(2)], teams, "2026-10-03", NO_HOLIDAYS)).toEqual([
      { label: "오늘 주간 근무 팀", teamNos: ["3팀"] },
      { label: "오늘 야간 근무 팀", teamNos: ["4팀"] },
    ]);
  });
  it("패턴 1 주간이면 심야 묶음도 보인다", () => {
    const g = handoverGroups([profile(1)], [{ teamNo: "2팀", patternStartDate: "2026-09-29" }], "2026-10-01", NO_HOLIDAYS);
    expect(g.map((x) => x.label)).toEqual(["오늘 야간에 들어오는 팀", "오늘 심야에 들어오는 팀"]);
  });
  it("패턴 4(당직)는 내일 당직에 들어오는 팀", () => {
    // 패턴 4: 당직 휴무 비번. 나 10/1 당직. 팀 시작일 9/30 → 10/1 휴무, 10/2 비번... 팀 9/29: 10/1 비번 / 10/2 당직
    const g = handoverGroups([profile(4)], [{ teamNo: "2팀", patternStartDate: "2026-09-29" }], "2026-10-01", NO_HOLIDAYS);
    expect(g).toEqual([{ label: "내일 당직에 들어오는 팀", teamNos: ["2팀"] }]);
  });
  it("팀이 없거나 일근이면 아무것도 없다", () => {
    expect(handoverGroups([profile(2)], [], "2026-10-01", NO_HOLIDAYS)).toEqual([]);
    expect(handoverGroups([profile(5, undefined)], teams, "2026-10-01", NO_HOLIDAYS)).toEqual([]);
  });
});

describe("다른 팀 등록 검사 (addOtherTeam)", () => {
  const ok = { teamNo: "3팀", patternStartDate: "2026-10-01" };
  it("추가한다 (공백 정리)", () => {
    const r = addOtherTeam([], "1팀", { ...ok, teamNo: "  3 팀 " });
    expect(r.ok && r.teams).toEqual([{ teamNo: "3 팀", patternStartDate: "2026-10-01" }]);
  });
  it.each([
    ["빈 팀 번호", { ...ok, teamNo: "  " }, "팀 번호"],
    ["너무 긴 번호", { ...ok, teamNo: "가".repeat(11) }, "10글자"],
    ["내 팀과 같음", { ...ok, teamNo: "1팀" }, "내 팀"],
    ["날짜 없음", { ...ok, patternStartDate: "" }, "시작일"],
    ["없는 날짜", { ...ok, patternStartDate: "2026-02-30" }, "시작일"],
  ])("%s → 안내", (_, input, word) => {
    const r = addOtherTeam([], "1팀", input);
    expect(!r.ok && r.message).toContain(word);
  });
  it("같은 번호는 두 번 등록하지 못한다 (띄어쓰기 달라도)", () => {
    const r = addOtherTeam([{ teamNo: "3팀", patternStartDate: "2026-10-01" }], "1팀", { ...ok, teamNo: "3 팀" });
    expect(!r.ok && r.message).toContain("이미");
  });
  it("6팀까지만", () => {
    const six = Array.from({ length: MAX_OTHER_TEAMS }, (_, i) => ({ teamNo: `${i + 2}팀`, patternStartDate: "2026-10-01" }));
    const r = addOtherTeam(six, "1팀", { teamNo: "9팀", patternStartDate: "2026-10-01" });
    expect(!r.ok && r.message).toContain("6팀");
  });
  it("지우기", () => {
    expect(removeOtherTeam(teams, "3팀").map((t) => t.teamNo)).toEqual(["2팀", "4팀"]);
  });
});
