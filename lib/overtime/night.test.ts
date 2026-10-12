// lib/overtime/night.ts 시험 — 야간 시간 분리 (실제 시각 22:00~06:00, 규칙 5)
import { describe, expect, it } from "vitest";
import { applyMealDeduction } from "./meal";
import { nightMinutes, splitByNight } from "./night";
import { buildShift } from "./shift";

/** 근무 → 식사 공제 → 야간·평시 분(分) */
function split(start: string, end: string, mealDeduct?: boolean) {
  const r = buildShift("2026-10-06", { start, end, mealDeduct });
  if (!r.ok) throw new Error("근무를 만들지 못함");
  const { worked } = applyMealDeduction(r.shift);
  const { night, regular } = splitByNight(worked);
  return { night: night.length * 10, regular: regular.length * 10 };
}

describe("야간 시간 분리 (규칙 5)", () => {
  it("주간 09:00~18:00: 야간 0", () => {
    expect(split("09:00", "18:00")).toEqual({ night: 0, regular: 480 });
  });

  it("야간 18:00~09:00: 야간 8시간(22~06시), 평시 7시간 - 식사 1시간", () => {
    // 평시 18~22시(4h) + 06~09시(3h) = 7h, 식사 1h는 평시(21~22시)에서 → 평시 6h
    expect(split("18:00", "09:00")).toEqual({ night: 480, regular: 360 });
  });

  it("심야 22:00~06:00 공제 체크 켬: 식사 1시간이 야간에서 빠져 야간 7시간", () => {
    expect(split("22:00", "06:00")).toEqual({ night: 420, regular: 0 });
  });

  it("심야 22:00~06:00 공제 체크 끔: 야간 8시간", () => {
    expect(split("22:00", "06:00", false)).toEqual({ night: 480, regular: 0 });
  });

  it("24시간 09:00~09:00: 야간 8시간, 평시 16시간 - 식사 1시간", () => {
    expect(split("09:00", "09:00")).toEqual({ night: 480, regular: 900 });
  });

  it("경계: 21:00~23:00 → 평시 1시간·야간 1시간 (식사 1시간은 평시에서)", () => {
    expect(split("21:00", "23:00")).toEqual({ night: 60, regular: 0 });
  });

  it("경계: 05:00~07:00 → 야간 1시간(05~06시)·평시 1시간 (식사는 평시에서)", () => {
    expect(split("05:00", "07:00")).toEqual({ night: 60, regular: 0 });
  });

  it("10분 단위 경계: 21:50~22:10 → 평시 10분·야간 10분 (평시 1시간 미만·체크 끔)", () => {
    expect(split("21:50", "22:10", false)).toEqual({ night: 10, regular: 10 });
  });

  it("nightMinutes는 야간 분만 센다", () => {
    const r = buildShift("2026-10-06", { start: "18:00", end: "09:00" });
    if (!r.ok) throw new Error();
    expect(nightMinutes(r.shift.slots)).toBe(480);
  });
});
