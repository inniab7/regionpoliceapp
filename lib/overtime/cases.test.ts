// 계산 검증 — 시험 사례 10건 (PLAN 작업 14, 성공 기준 2)
// 정답은 docs/overtime-test-cases.md에서 손으로 계산한 값이다 (Claude 초안 → Yuni 검토). 2026-10-13: 월 기준시간(규칙 4) 방식으로 다시 계산했다.
// 성공 기준: 10건 중 9건 이상이 정답과 0.5시간(30분) 이내로 일치.
import { describe, expect, it } from "vitest";
import { effectiveHolidays } from "../holidays/kr";
import type { DayEntry, Profile } from "../types";
import { calculateMonth } from "./monthly";

const HOLIDAYS = effectiveHolidays();
const TOLERANCE_MINUTES = 30;

const patrol2: Profile = {
  effectiveFrom: "2026-01-01",
  agency: "서울청",
  department: "지구대·파출소",
  team: "1팀",
  pattern: 2,
  patternStartDate: "2026-10-01",
  shiftTimes: { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } },
};

const office: Profile = {
  effectiveFrom: "2026-01-01",
  agency: "서울청",
  department: "형사",
  team: "1팀",
  pattern: 5,
  shiftTimes: {},
};

function patrol1(mealDeduct: boolean): Profile {
  return {
    ...patrol2,
    pattern: 1,
    shiftTimes: {
      주간: { start: "09:00", end: "18:00" },
      야간: { start: "18:00", end: "22:00" },
      심야: { start: "22:00", end: "06:00", mealDeduct },
    },
  };
}

interface Case {
  no: number;
  title: string;
  profiles: Profile[];
  overrides?: Record<string, DayEntry>;
  /** 정답 (시간) */
  expected: { basic: number; night: number; holiday: number };
}

const CASES: Case[] = [
  { no: 1, title: "패턴 2, 변경 없음", profiles: [patrol2], expected: { basic: 0, night: 54, holiday: 48 } },
  {
    no: 2,
    title: "패턴 2 + 10/14 야간일 연가",
    profiles: [patrol2],
    overrides: { "2026-10-14": { replace: { type: "휴가" } } },
    expected: { basic: 0, night: 46, holiday: 48 },
  },
  {
    no: 3,
    title: "패턴 2 + 10/31(토) 비번 동원 09~18시",
    profiles: [patrol2],
    overrides: { "2026-10-31": { extra: { start: "09:00", end: "18:00" } } },
    expected: { basic: 0, night: 54, holiday: 56 },
  },
  {
    no: 4,
    title: "패턴 2 + 10/27(화) 비번 동원 13~23시",
    profiles: [patrol2],
    overrides: { "2026-10-27": { extra: { start: "13:00", end: "23:00" } } },
    expected: { basic: 0, night: 55, holiday: 48 },
  },
  {
    no: 5,
    title: "일근 + 10/16·10/23(금) 초과근무",
    profiles: [office],
    overrides: {
      "2026-10-16": { extra: { start: "18:00", end: "21:00" } },
      "2026-10-23": { extra: { start: "18:00", end: "23:00" } },
    },
    expected: { basic: 6, night: 1, holiday: 0 },
  },
  {
    no: 6,
    title: "일근 + 10/10(토) 출근 09~19시",
    profiles: [office],
    overrides: { "2026-10-10": { extra: { start: "09:00", end: "19:00" } } },
    expected: { basic: 1, night: 0, holiday: 8 },
  },
  { no: 7, title: "패턴 1 (심야 공제 체크 켬)", profiles: [patrol1(true)], expected: { basic: 0, night: 14, holiday: 26 } },
  { no: 8, title: "패턴 1 (심야 공제 체크 끔)", profiles: [patrol1(false)], expected: { basic: 0, night: 16, holiday: 27 } },
  {
    no: 9,
    title: "10/15부터 [변경]: 패턴 2 → 일근",
    profiles: [patrol2, { ...office, effectiveFrom: "2026-10-15" }],
    expected: { basic: 0, night: 27, holiday: 24 },
  },
  {
    no: 10,
    title: "일근 + 10/12 연가 + 10/13 교육 08~20시",
    profiles: [office],
    overrides: {
      "2026-10-12": { replace: { type: "휴가" } },
      "2026-10-13": { replace: { type: "교육출장", start: "08:00", end: "20:00" } },
    },
    expected: { basic: 3, night: 0, holiday: 0 },
  },
];

/** 사례 하나가 정답과 0.5시간 이내로 맞는지 */
function check(c: Case) {
  const r = calculateMonth({ year: 2026, month: 10, profiles: c.profiles, overrides: c.overrides ?? {}, holidays: HOLIDAYS });
  const got = { basic: r.total.basic, night: r.total.night, holiday: r.total.holiday };
  const want = {
    basic: c.expected.basic * 60,
    night: c.expected.night * 60,
    holiday: c.expected.holiday * 60,
  };
  const pass = (Object.keys(want) as (keyof typeof want)[]).every((k) => Math.abs(got[k] - want[k]) <= TOLERANCE_MINUTES);
  return { got, want, pass, issues: r.issues };
}

describe("계산 검증 — 시험 사례 10건 (2026년 10월)", () => {
  it.each(CASES)("사례 $no: $title", (c) => {
    const { got, want, issues } = check(c);
    expect(issues).toEqual([]);
    expect(got).toEqual(want);
  });

  // 추가 사례 11 (2026-10-12): 패턴 4 당직은 24시간 근무 (10건 성공 기준과는 별개)
  it("추가 사례 11: 패턴 4 당직 24시간 근무 → 기본 초과 61 / 야간 88 / 휴일 32", () => {
    const duty: Profile = { ...patrol2, pattern: 4, shiftTimes: {} };
    const r = calculateMonth({ year: 2026, month: 10, profiles: [duty], overrides: {}, holidays: HOLIDAYS });
    expect(r.issues).toEqual([]);
    expect(r.total).toEqual({ basic: 61 * 60, night: 88 * 60, holiday: 32 * 60 });
    expect(r.baseMinutes).toBe(160 * 60); // 평일 20일 × 8시간
    expect(r.countedMinutes).toBe(221 * 60); // 당직 11번 × 23시간 = 253시간에서 휴일 32시간을 뺀 값
  });

  it("성공 기준: 10건 중 9건 이상이 오차 0.5시간 이내", () => {
    const passed = CASES.filter((c) => check(c).pass).length;
    expect(CASES).toHaveLength(10);
    expect(passed).toBeGreaterThanOrEqual(9);
  });
});
