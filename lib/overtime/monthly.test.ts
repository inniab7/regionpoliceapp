// lib/overtime/monthly.ts 시험 — 근무표 + 근무 변경 + 공휴일 → 그 달 결과 3줄과 문제 안내
import { describe, expect, it } from "vitest";
import { effectiveHolidays } from "../holidays/kr";
import type { DayEntry, Profile } from "../types";
import { calculateMonth } from "./monthly";

const HOLIDAYS = effectiveHolidays();
const h = (hours: number) => hours * 60;

const office: Profile = {
  effectiveFrom: "2026-01-01",
  agency: "서울청",
  department: "형사",
  team: "1팀",
  pattern: 5,
  shiftTimes: {},
};

const patrol: Profile = {
  effectiveFrom: "2026-01-01",
  agency: "서울청",
  department: "지구대·파출소",
  team: "1팀",
  pattern: 2, // 주간 → 야간 → 비번 → 휴무
  patternStartDate: "2026-10-01",
  shiftTimes: { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } },
};

function october(profiles: Profile[], overrides: Record<string, DayEntry> = {}) {
  return calculateMonth({ year: 2026, month: 10, profiles, overrides, holidays: HOLIDAYS });
}

describe("월간 집계 기본", () => {
  it("1일~말일 날짜를 모두 돌려준다 (2026년 10월 = 31일)", () => {
    const r = october([office]);
    expect(r.days).toHaveLength(31);
    expect(r.days[0].date).toBe("2026-10-01");
    expect(r.days.at(-1)!.date).toBe("2026-10-31");
  });

  it("일근만 한 달: 결과 0, 문제 없음 (공휴일 10/5·10/9는 휴무)", () => {
    const r = october([office]);
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: 0 });
    expect(r.baseMinutes).toBe(h(160)); // 평일 22일 − 공휴일 2일(10/5·10/9) = 20일 × 8시간
    expect(r.countedMinutes).toBe(h(160)); // 일근 20일 × 8시간 = 기준과 같다
    expect(r.issues).toEqual([]);
    expect(r.days.find((d) => d.date === "2026-10-09")).toMatchObject({ plannedKind: "휴무", holidayName: "한글날" });
  });

  it("기본 초과 = 그 달 근무시간 − 월 기준시간 (0보다 클 때만)", () => {
    for (const profiles of [[patrol], [office]]) {
      const r = october(profiles);
      expect(r.total.basic).toBe(Math.max(0, r.countedMinutes - r.baseMinutes));
    }
  });

  it("합계는 계산 결과에 없다 (야간은 기본 초과와 겹쳐서 세므로 더하면 이중으로 들어간다)", () => {
    expect(october([patrol]).total).not.toHaveProperty("sum");
  });
});

describe("일근 초과근무 (추가 근무, 규칙 13·14)", () => {
  it("일근 20일(월 기준 160시간) + 금요일 18~21시 초과근무(공제 후 2시간) → 기본 초과 2시간", () => {
    const r = october([office], { "2026-10-16": { extra: { start: "18:00", end: "21:00" } } });
    expect(r.total).toEqual({ basic: h(2), night: 0, holiday: 0 });
    expect(r.days.find((d) => d.date === "2026-10-16")!.hasExtra).toBe(true);
  });

  it("평일 공휴일(10/5·10/9)이 낀 달도 기준은 160시간이라 일근 20일 + 초과근무 2시간 = 기본 초과 2시간 (규칙 4)", () => {
    const r = october([office], { "2026-10-08": { extra: { start: "18:00", end: "21:00" } } });
    expect(r.total.basic).toBe(h(2));
  });

  it("정해진 근무시간과 겹치는 추가 근무는 계산에서 빼고 안내", () => {
    const r = october([office], { "2026-10-16": { extra: { start: "17:00", end: "21:00" } } });
    expect(r.total.basic).toBe(0);
    expect(r.issues).toEqual([expect.objectContaining({ date: "2026-10-16", code: "EXTRA_OVERLAP" })]);
    expect(r.days.find((d) => d.date === "2026-10-16")!.hasIssue).toBe(true);
  });

  it("전날 야간이 끝나기 전의 추가 근무도 겹침으로 잡는다 (10/2 야간 18:00~10/3 09:00)", () => {
    const r = october([patrol], { "2026-10-03": { extra: { start: "07:00", end: "10:00" } } });
    expect(r.issues.map((i) => i.code)).toEqual(["EXTRA_OVERLAP"]);
  });

  it("비번일 동원(정해진 근무시간 밖)은 정상 계산", () => {
    const r = october([patrol], { "2026-10-03": { extra: { start: "13:00", end: "17:00" } } });
    expect(r.issues).toEqual([]);
    expect(r.days.find((d) => d.date === "2026-10-03")!.workedMinutes).toBe(h(3)); // 4시간 - 식사 1시간
  });
});

describe("휴가·교육출장 (규칙 4)", () => {
  it("근무일 휴가는 근무 대신 그 달 근무시간 8시간", () => {
    const r = october([office], { "2026-10-12": { replace: { type: "휴가" } } });
    const d = r.days.find((x) => x.date === "2026-10-12")!;
    expect(d).toMatchObject({ replacedBy: "휴가", workedMinutes: 0 });
    expect(r.issues).toEqual([]);
  });

  it("쉬는 날에 넣은 휴가는 안내하고 계산하지 않는다", () => {
    const r = october([office], { "2026-10-10": { replace: { type: "휴가" } } }); // 토요일
    expect(r.issues).toEqual([expect.objectContaining({ code: "LEAVE_ON_OFF_DAY" })]);
  });

  it("교육·출장은 입력한 실제 시간으로 계산: 금요일 09~21시 → 정해진 8시간보다 3시간 많아 기본 초과 3시간", () => {
    // 일근 20일 160시간에서 10/16을 교육 09~21시(공제 후 11시간)로 바꿈 → 163시간
    const r = october([office], { "2026-10-16": { replace: { type: "교육출장", start: "09:00", end: "21:00" } } });
    expect(r.total.basic).toBe(h(3));
    expect(r.days.find((d) => d.date === "2026-10-16")!.replacedBy).toBe("교육출장");
  });

  it("교육·출장 시간이 잘못되면 안내", () => {
    const r = october([office], { "2026-10-16": { replace: { type: "교육출장", start: "09:05", end: "18:00" } } });
    expect(r.issues.map((i) => i.code)).toEqual(["INVALID_TIME"]);
  });
});

describe("당직·휴일·등록 정보", () => {
  it("패턴 4(당직·휴무·비번): 당직은 24시간 근무로 계산 (규칙 12)", () => {
    // 당직 11번(10/1·4·7·…·31), 매번 09:00~다음 날 09:00, 식사 공제 후 23시간(야간 8시간)
    // 손계산: 근무 11번 × 23시간 = 253시간 − 휴일 인정 32시간(10/4·10·25·31 각 8) = 221시간 → 기준 160시간을 넘은 기본 초과 61
    //        야간 88(8×11), 휴일 32
    const duty: Profile = { ...patrol, pattern: 4, shiftTimes: {} };
    const r = october([duty]);
    expect(r.total).toEqual({ basic: h(61), night: h(88), holiday: h(32) });
    expect(r.issues).toEqual([]);
    const oct1 = r.days.find((d) => d.date === "2026-10-01")!;
    expect(oct1).toMatchObject({ plannedKind: "당직", workedMinutes: h(23), night: h(8) });
    // 일요일(휴일) 당직: 처음 8시간은 휴일
    expect(r.days.find((d) => d.date === "2026-10-04")!.holiday).toBe(h(8));
  });

  it("당직 시작 시각을 등록하면 그 시각부터 24시간 (08:30 시작도 23시간 근무)", () => {
    const duty: Profile = { ...patrol, pattern: 4, shiftTimes: { 당직: { start: "08:30", end: "08:30" } } };
    const r = october([duty]);
    expect(r.days.find((d) => d.date === "2026-10-13")).toMatchObject({ workedMinutes: h(23), night: h(8) });
    expect(r.issues).toEqual([]);
  });

  it("당직일에 휴가를 넣으면 근무 대신 그 달 근무시간 8시간", () => {
    const duty: Profile = { ...patrol, pattern: 4, shiftTimes: {} };
    const r = october([duty], { "2026-10-13": { replace: { type: "휴가" } } });
    expect(r.days.find((d) => d.date === "2026-10-13")).toMatchObject({ replacedBy: "휴가", workedMinutes: 0 });
  });

  it("토요일 주간 근무는 휴일 8시간", () => {
    // 패턴 2를 10/3(토)에 주간으로 시작 → 10/3 주간
    const r = october([{ ...patrol, patternStartDate: "2026-10-03" }]);
    expect(r.days.find((d) => d.date === "2026-10-03")).toMatchObject({ plannedKind: "주간", holiday: h(8) });
  });

  it("근무일인데 근무시간이 등록되지 않았으면 안내", () => {
    const r = october([{ ...patrol, shiftTimes: { 주간: { start: "09:00", end: "18:00" } } }]); // 야간 시간 없음
    expect(r.issues.some((i) => i.code === "MISSING_SHIFT_TIME")).toBe(true);
  });

  it("등록 정보가 없으면 안내하고 결과 0", () => {
    const r = october([]);
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: 0 });
    expect(r.issues.map((i) => i.code)).toEqual(["NO_PROFILE"]);
  });

  it("달 중간에 [변경]: 10/15부터 일근이면 그 전은 패턴 2, 그 뒤는 일근", () => {
    const r = october([patrol, { ...office, effectiveFrom: "2026-10-15" }]);
    expect(r.days.find((d) => d.date === "2026-10-14")!.plannedKind).not.toBe("일근");
    expect(r.days.find((d) => d.date === "2026-10-15")!.plannedKind).toBe("일근");
  });
});
