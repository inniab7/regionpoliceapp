// 휴일 판정 시험 — 공휴일 목록(2026~2027), 시작한 날 기준, 휴일 하루 8시간 한도 (규칙 6·15)
import { describe, expect, it } from "vitest";
import { BUILT_IN_HOLIDAYS, effectiveHolidays, holidayName } from "../holidays/kr";
import { formatTime, isValidDate, isWeekend } from "../time";
import { capHolidaySlots, isRestDay } from "./holiday";
import { applyMealDeduction } from "./meal";
import { splitByNight } from "./night";
import { buildShift } from "./shift";

const HOLIDAYS = effectiveHolidays();

/** 근무 → 식사 공제 후 남은 칸 */
function worked(date: string, start: string, end: string) {
  const r = buildShift(date, { start, end });
  if (!r.ok) throw new Error("근무를 만들지 못함");
  return applyMealDeduction(r.shift).worked;
}

describe("내장 공휴일 목록", () => {
  it("모든 날짜가 실제로 있는 날짜다", () => {
    for (const d of Object.keys(BUILT_IN_HOLIDAYS)) expect(isValidDate(d), d).toBe(true);
  });

  it.each([
    ["2026-02-17", "설날"],
    ["2026-03-02", "대체공휴일(삼일절)"],
    ["2026-05-01", "노동절"],
    ["2026-06-03", "전국동시지방선거"],
    ["2026-07-17", "제헌절"],
    ["2026-09-25", "추석"],
    ["2026-10-05", "대체공휴일(개천절)"],
    ["2027-02-09", "대체공휴일(설날)"],
    ["2027-05-03", "대체공휴일(노동절)"],
    ["2027-07-19", "대체공휴일(제헌절)"],
    ["2027-12-27", "대체공휴일(성탄절)"],
  ])("%s = %s", (date, name) => {
    expect(holidayName(date, HOLIDAYS)).toBe(name);
  });

  it("대체공휴일은 모두 평일(월~금)이다", () => {
    for (const [d, name] of Object.entries(BUILT_IN_HOLIDAYS)) {
      if (name.startsWith("대체공휴일")) expect(isWeekend(d), d).toBe(false);
    }
  });

  it("2026년 22일, 2027년 24일 (토·일과 겹친 공휴일 포함)", () => {
    const count = (y: string) => Object.keys(BUILT_IN_HOLIDAYS).filter((d) => d.startsWith(y)).length;
    expect(count("2026")).toBe(22);
    expect(count("2027")).toBe(24);
  });
});

describe("사용자 공휴일 추가·삭제 (규칙 15)", () => {
  it("추가한 날은 공휴일, 뺀 날은 공휴일 아님", () => {
    const set = effectiveHolidays(["2026-10-20"], ["2026-05-01"]);
    expect(set.has("2026-10-20")).toBe(true);
    expect(holidayName("2026-10-20", set)).toBe("공휴일");
    expect(set.has("2026-05-01")).toBe(false);
  });
});

describe("휴일 판정 — 시작한 날 기준 (규칙 6)", () => {
  it("토·일은 휴일", () => {
    expect(isRestDay("2026-10-10", HOLIDAYS)).toBe(true); // 토
    expect(isRestDay("2026-10-11", HOLIDAYS)).toBe(true); // 일
  });

  it("평일 공휴일은 휴일, 그냥 평일은 아님", () => {
    expect(isRestDay("2026-10-09", HOLIDAYS)).toBe(true); // 한글날(금)
    expect(isRestDay("2026-10-08", HOLIDAYS)).toBe(false); // 목
  });

  it("금요일 시작 야간은 평일, 토요일 시작 야간은 휴일 (근무의 시작 날짜로 판단)", () => {
    expect(isRestDay("2026-10-16", HOLIDAYS)).toBe(false); // 금요일 18:00~토요일 09:00
    expect(isRestDay("2026-10-17", HOLIDAYS)).toBe(true); // 토요일 18:00~일요일 09:00
  });
});

describe("휴일 하루 8시간 한도 (규칙 6)", () => {
  it("토요일 야간 18:00~09:00: 처음 8시간(18~21시·22~03시) 휴일, 03~09시 6시간은 넘는 시간", () => {
    const { holiday, overflow } = capHolidaySlots(worked("2026-10-17", "18:00", "09:00"));
    expect(holiday.length * 10).toBe(480);
    expect(overflow.length * 10).toBe(360);
    expect(formatTime(holiday.at(-1)! + 10)).toBe("03:00");
    expect(formatTime(overflow[0])).toBe("03:00");
    // 넘는 시간 중 03~06시는 야간, 06~09시는 평시 → 평일처럼 계산
    const { night, regular } = splitByNight(overflow);
    expect(night.length * 10).toBe(180);
    expect(regular.length * 10).toBe(180);
  });

  it("토요일 주간 09~18시 + 추가 근무 19~21시: 하루 합산 10시간 중 8시간 휴일, 2시간 넘음", () => {
    const day = [...worked("2026-10-17", "09:00", "18:00"), ...worked("2026-10-17", "19:00", "21:00")];
    const { holiday, overflow } = capHolidaySlots(day);
    expect(holiday.length * 10).toBe(480);
    expect(overflow.length * 10).toBe(60); // 추가 근무 2시간에서도 식사 1시간이 빠져 1시간
  });

  it("휴일 주간 09~18시(공제 후 8시간)는 전부 휴일, 넘는 시간 없음", () => {
    const { holiday, overflow } = capHolidaySlots(worked("2026-10-17", "09:00", "18:00"));
    expect(holiday.length * 10).toBe(480);
    expect(overflow).toEqual([]);
  });

  it("근무 순서가 섞여 들어와도 시간 순서로 나눈다", () => {
    const later = worked("2026-10-17", "19:00", "21:00");
    const earlier = worked("2026-10-17", "09:00", "18:00");
    const { overflow } = capHolidaySlots([...later, ...earlier]);
    expect(overflow.every((s) => s >= 19 * 60)).toBe(true);
  });
});
