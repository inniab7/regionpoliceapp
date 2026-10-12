// lib/overtime/monthly.ts 시험 — 근무표 + 근무 변경 + 공휴일 → 그 달 결과 4줄과 문제 안내
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
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: 0, sum: 0 });
    expect(r.issues).toEqual([]);
    expect(r.days.find((d) => d.date === "2026-10-09")).toMatchObject({ plannedKind: "휴무", holidayName: "한글날" });
  });

  it("합계 = 기본 초과 + 야간 + 휴일", () => {
    const { total } = october([patrol]);
    expect(total.sum).toBe(total.basic + total.night + total.holiday);
  });
});

describe("일근 초과근무 (추가 근무, 규칙 13·14)", () => {
  it("10/12~16(월~금) 40시간 + 금요일 18~21시 초과근무 → 기본 초과 2시간", () => {
    const r = october([office], { "2026-10-16": { extra: { start: "18:00", end: "21:00" } } });
    expect(r.total).toEqual({ basic: h(2), night: 0, holiday: 0, sum: h(2) });
    expect(r.days.find((d) => d.date === "2026-10-16")!.hasExtra).toBe(true);
  });

  it("공휴일 낀 주(10/5·10/9)는 기준 24시간 → 평일 24시간 + 초과근무 2시간 = 기본 초과 2시간 (규칙 4)", () => {
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
  it("근무일 휴가는 근무 대신 주 누적 8시간", () => {
    const r = october([office], { "2026-10-12": { replace: { type: "휴가" } } });
    const d = r.days.find((x) => x.date === "2026-10-12")!;
    expect(d).toMatchObject({ replacedBy: "휴가", workedMinutes: 0 });
    expect(r.issues).toEqual([]);
  });

  it("쉬는 날에 넣은 휴가는 안내하고 계산하지 않는다", () => {
    const r = october([office], { "2026-10-10": { replace: { type: "휴가" } } }); // 토요일
    expect(r.issues).toEqual([expect.objectContaining({ code: "LEAVE_ON_OFF_DAY" })]);
  });

  it("교육·출장은 입력한 실제 시간으로 계산: 금요일 09~21시 → 40시간 넘은 3시간이 기본 초과", () => {
    // 10/12~15 32시간 + 10/16 교육 09~21시(공제 후 11시간) = 43시간
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
  it("패턴 4(당직·휴무·비번)만 한 달: 결과 0 (당직은 시간외 아님, 규칙 12)", () => {
    const duty: Profile = { ...patrol, pattern: 4, shiftTimes: {} };
    const r = october([duty]);
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: 0, sum: 0 });
    expect(r.issues).toEqual([]);
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
    expect(r.total.sum).toBe(0);
    expect(r.issues.map((i) => i.code)).toEqual(["NO_PROFILE"]);
  });

  it("달 중간에 [변경]: 10/15부터 일근이면 그 전은 패턴 2, 그 뒤는 일근", () => {
    const r = october([patrol, { ...office, effectiveFrom: "2026-10-15" }]);
    expect(r.days.find((d) => d.date === "2026-10-14")!.plannedKind).not.toBe("일근");
    expect(r.days.find((d) => d.date === "2026-10-15")!.plannedKind).toBe("일근");
  });
});
