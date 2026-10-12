// lib/schedule 시험 — 패턴 순환, 거꾸로 순환, 일근, 등록 이력(적용일), 한 달 계산 범위
import { describe, expect, it } from "vitest";
import type { Profile } from "../types";
import { monthCalcRange, plannedDay, plannedDays, profileOnDate } from "./generate";
import { timedKindsInPattern } from "./patterns";

const NO_HOLIDAYS = new Set<string>();

const DAY = { start: "09:00", end: "18:00" };
const NIGHT = { start: "18:00", end: "09:00" };
const LATE = { start: "22:00", end: "06:00", mealDeduct: false };

function profile(patch: Partial<Profile>): Profile {
  return {
    effectiveFrom: "2026-01-01",
    agency: "서울청",
    department: "지구대·파출소",
    team: "1팀",
    pattern: 2,
    patternStartDate: "2026-10-01",
    shiftTimes: { 주간: DAY, 야간: NIGHT, 심야: LATE },
    ...patch,
  };
}

const kinds = (profiles: Profile[], from: string, to: string, holidays = NO_HOLIDAYS) =>
  plannedDays(profiles, from, to, holidays).map((d) => d.kind);

describe("패턴 순환", () => {
  it("패턴 2: 주간 → 야간 → 비번 → 휴무 반복", () => {
    expect(kinds([profile({ pattern: 2 })], "2026-10-01", "2026-10-06")).toEqual([
      "주간", "야간", "비번", "휴무", "주간", "야간",
    ]);
  });

  it("패턴 1: 10일 순환 후 처음으로 돌아간다", () => {
    expect(kinds([profile({ pattern: 1 })], "2026-10-01", "2026-10-11")).toEqual([
      "주간", "야간", "심야", "비번", "휴무", "주간", "야간", "비번", "비번", "휴무", "주간",
    ]);
  });

  it("패턴 3: 9일 순환", () => {
    expect(kinds([profile({ pattern: 3 })], "2026-10-01", "2026-10-10")).toEqual([
      "주간", "주간", "주간", "야간", "비번", "야간", "비번", "야간", "비번", "주간",
    ]);
  });

  it("패턴 4: 당직 → 휴무 → 비번", () => {
    expect(kinds([profile({ pattern: 4 })], "2026-10-01", "2026-10-04")).toEqual(["당직", "휴무", "비번", "당직"]);
  });

  it("시작일 이전은 거꾸로 이어서 센다 (규칙 16)", () => {
    // 패턴 2, 10/1이 주간 → 9/30 휴무, 9/29 비번, 9/28 야간, 9/27 주간
    expect(kinds([profile({ pattern: 2 })], "2026-09-27", "2026-09-30")).toEqual(["주간", "야간", "비번", "휴무"]);
  });
});

describe("패턴 5 (일근, 규칙 13)", () => {
  const office = [profile({ pattern: 5, patternStartDate: undefined, shiftTimes: {} })];

  it("평일은 일근 09:00~18:00, 토·일은 휴무", () => {
    // 2026-10-09(금) ~ 2026-10-12(월)
    const days = plannedDays(office, "2026-10-09", "2026-10-12", NO_HOLIDAYS);
    expect(days.map((d) => d.kind)).toEqual(["일근", "휴무", "휴무", "일근"]);
    expect(days[0].time).toEqual({ start: "09:00", end: "18:00" });
    expect(days[1].time).toBeNull();
  });

  it("평일이어도 공휴일은 휴무", () => {
    expect(plannedDay(office, "2026-10-09", new Set(["2026-10-09"])).kind).toBe("휴무");
  });
});

describe("근무시간", () => {
  it("등록된 근무 종류별 시간을 쓴다", () => {
    const days = plannedDays([profile({ pattern: 1 })], "2026-10-01", "2026-10-03", NO_HOLIDAYS);
    expect(days.map((d) => d.time)).toEqual([DAY, NIGHT, LATE]);
  });

  it("당직은 시간이 없다 (시간외 계산 없음, 규칙 12)", () => {
    expect(plannedDay([profile({ pattern: 4 })], "2026-10-01", NO_HOLIDAYS).time).toBeNull();
  });

  it("쉬는 날은 시간이 없다", () => {
    expect(plannedDay([profile({ pattern: 2 })], "2026-10-03", NO_HOLIDAYS).time).toBeNull();
  });

  it("근무하는 날인데 등록된 시간이 없으면 null (계산 단계에서 재입력 안내)", () => {
    expect(plannedDay([profile({ pattern: 2, shiftTimes: {} })], "2026-10-01", NO_HOLIDAYS).time).toBeNull();
  });
});

describe("등록 이력 (규칙 16 — 적용일)", () => {
  const before = profile({ effectiveFrom: "2026-10-01", pattern: 2, patternStartDate: "2026-10-01" });
  const after = profile({ effectiveFrom: "2026-10-15", pattern: 4, patternStartDate: "2026-10-15" });

  it("적용일 전날까지는 이전 패턴, 적용일부터 새 패턴", () => {
    expect(kinds([before, after], "2026-10-13", "2026-10-16")).toEqual(["주간", "야간", "당직", "휴무"]);
  });

  it("이력 순서가 섞여 있어도 적용일로 고른다", () => {
    expect(profileOnDate([after, before], "2026-10-20")?.pattern).toBe(4);
    expect(profileOnDate([after, before], "2026-10-10")?.pattern).toBe(2);
  });

  it("첫 적용일 이전은 등록 정보가 없다", () => {
    expect(plannedDay([before], "2026-09-30", NO_HOLIDAYS)).toEqual({
      date: "2026-09-30",
      profile: null,
      kind: null,
      time: null,
    });
  });
});

describe("한 달 계산 범위 (앞뒤 주 포함, 규칙 8)", () => {
  it("2026년 10월: 9/27(일) ~ 10/31(토)", () => {
    expect(monthCalcRange(2026, 10)).toEqual({ from: "2026-09-27", to: "2026-10-31" });
  });

  it("2026년 11월: 11/1(일) ~ 12/5(토)", () => {
    expect(monthCalcRange(2026, 11)).toEqual({ from: "2026-11-01", to: "2026-12-05" });
  });

  it("범위 안의 날짜를 하나도 빠짐없이 만든다", () => {
    const { from, to } = monthCalcRange(2026, 10);
    expect(plannedDays([profile({})], from, to, NO_HOLIDAYS)).toHaveLength(35);
  });
});

describe("등록 3단계에서 시간을 묻는 근무 종류", () => {
  it("패턴에 들어 있는 주간·야간·심야만, 당직·일근은 묻지 않는다", () => {
    expect(timedKindsInPattern(1)).toEqual(["주간", "야간", "심야"]);
    expect(timedKindsInPattern(2)).toEqual(["주간", "야간"]);
    expect(timedKindsInPattern(4)).toEqual([]);
    expect(timedKindsInPattern(5)).toEqual([]);
  });
});
