// lib/overtime/meal.ts 시험 — 식사 1시간 공제 (규칙 2·3)
import { describe, expect, it } from "vitest";
import { formatTime } from "../time";
import { applyMealDeduction } from "./meal";
import { isNightSlot } from "./night";
import { buildShift } from "./shift";

/** 근무를 만들고 식사 공제한 결과를 "HH:MM~HH:MM"과 남은 분으로 돌려준다 */
function meal(start: string, end: string, mealDeduct?: boolean) {
  const r = buildShift("2026-10-06", { start, end, mealDeduct });
  if (!r.ok) throw new Error("근무를 만들지 못함");
  const { worked, deducted } = applyMealDeduction(r.shift);
  const range = deducted.length ? `${formatTime(deducted[0])}~${formatTime(deducted.at(-1)! + 10)}` : "없음";
  return { range, workedMinutes: worked.length * 10, deductedMinutes: deducted.length * 10 };
}

describe("야간 판단 (22:00~06:00)", () => {
  it("21:50은 평시, 22:00은 야간, 05:50은 야간, 06:00은 평시", () => {
    expect(isNightSlot(21 * 60 + 50)).toBe(false);
    expect(isNightSlot(22 * 60)).toBe(true);
    expect(isNightSlot(1440 + 5 * 60 + 50)).toBe(true); // 다음 날 05:50
    expect(isNightSlot(1440 + 6 * 60)).toBe(false); // 다음 날 06:00
  });
});

describe("평시가 1시간 이상 → 평시 가운데 1시간 (규칙 2)", () => {
  it("18:00~09:00: 평시 18~22시·06~09시(7시간)의 가운데 → 21:00~22:00", () => {
    expect(meal("18:00", "09:00")).toEqual({ range: "21:00~22:00", workedMinutes: 840, deductedMinutes: 60 });
  });

  it("09:00~18:00 일근: 13:00~14:00 → 8시간 (규칙 13)", () => {
    expect(meal("09:00", "18:00")).toEqual({ range: "13:00~14:00", workedMinutes: 480, deductedMinutes: 60 });
  });

  it("09:00~09:00 24시간: 평시 16시간의 가운데 → 16:30~17:30", () => {
    expect(meal("09:00", "09:00")).toEqual({ range: "16:30~17:30", workedMinutes: 1380, deductedMinutes: 60 });
  });

  it("야간 시간에서는 빼지 않는다: 20:00~08:00 → 평시 20~22시·06~08시 4시간의 가운데", () => {
    // 평시 칸: 20:00~21:50(12칸) + 06:00~07:50(12칸) = 24칸 → 가운데 6칸 = 21:30~22:00 + 06:00~06:30
    const r = buildShift("2026-10-06", { start: "20:00", end: "08:00" });
    if (!r.ok) throw new Error();
    const { deducted } = applyMealDeduction(r.shift);
    expect(deducted.map(formatTime)).toEqual(["21:30", "21:40", "21:50", "06:00", "06:10", "06:20"]);
    expect(deducted.some(isNightSlot)).toBe(false);
  });

  it("가운데가 10분 칸에 안 맞으면 앞쪽으로: 평시 70분 → 처음 1시간", () => {
    // 20:50~06:00: 평시 20:50~22:00(70분) → 정확한 가운데는 20:55~21:55 → 앞쪽 칸 20:50~21:50
    expect(meal("20:50", "06:00").range).toBe("20:50~21:50");
  });

  it("평시가 1시간 이상이면 체크를 꺼도 공제한다 (체크는 평시 1시간 미만일 때만 쓰임)", () => {
    expect(meal("09:00", "18:00", false).deductedMinutes).toBe(60);
  });
});

describe("평시가 1시간 미만 → [식사시간 공제] 체크 (규칙 3)", () => {
  it("22:00~06:00 체크 켬(기본): 근무 전체 가운데 1시간 01:30~02:30", () => {
    expect(meal("22:00", "06:00")).toEqual({ range: "01:30~02:30", workedMinutes: 420, deductedMinutes: 60 });
  });

  it("22:00~06:00 체크 끔: 공제 없음", () => {
    expect(meal("22:00", "06:00", false)).toEqual({ range: "없음", workedMinutes: 480, deductedMinutes: 0 });
  });

  it("21:30~06:00 (평시 30분) 체크 켬: 근무 전체 가운데 1시간", () => {
    // 근무 510분 = 51칸 → (51-6)/2 = 22.5 → 앞쪽 22번째 칸 = 21:30 + 220분 = 01:10
    expect(meal("21:30", "06:00").range).toBe("01:10~02:10");
  });

  it("근무 전체가 1시간이 안 되면 체크 시 근무 전체를 뺀다", () => {
    expect(meal("23:00", "23:30")).toEqual({ range: "23:00~23:30", workedMinutes: 0, deductedMinutes: 30 });
    expect(meal("23:00", "23:30", false).deductedMinutes).toBe(0);
  });
});

describe("근무 1회당 1번만", () => {
  it("자정을 넘는 근무도 1시간만 뺀다", () => {
    expect(meal("18:00", "09:00").deductedMinutes).toBe(60);
    expect(meal("09:00", "09:00").deductedMinutes).toBe(60);
  });
});
