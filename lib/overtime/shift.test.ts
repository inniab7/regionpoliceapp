// lib/overtime/shift.ts 시험 — 근무 1회를 10분 칸으로, 자정 넘김·24시간·잘못된 입력·겹침
import { describe, expect, it } from "vitest";
import { buildShift, shiftsOverlap, slotDayOffset, slotMinuteOfDay, type Shift } from "./shift";

function ok(date: string, start: string, end: string, mealDeduct?: boolean): Shift {
  const r = buildShift(date, { start, end, mealDeduct });
  if (!r.ok) throw new Error(`근무를 만들지 못함: ${start}~${end}`);
  return r.shift;
}

describe("근무 1회 → 10분 칸", () => {
  it("같은 날 끝나는 근무: 09:00~18:00 = 54칸", () => {
    const s = ok("2026-10-06", "09:00", "18:00");
    expect(s.durationMinutes).toBe(540);
    expect(s.slots).toHaveLength(54);
    expect(s.slots[0]).toBe(540); // 09:00
    expect(s.slots.at(-1)).toBe(1070); // 17:50 칸이 마지막
  });

  it("자정을 넘는 근무는 시작한 날의 근무 1회 (규칙 8·11)", () => {
    const s = ok("2026-10-09", "18:00", "09:00"); // 금요일 시작
    expect(s.date).toBe("2026-10-09");
    expect(s.durationMinutes).toBe(900);
    expect(s.slots).toHaveLength(90);
    // 다음 날 칸은 1440 이상
    expect(slotDayOffset(s.slots[0])).toBe(0);
    expect(slotDayOffset(s.slots.at(-1)!)).toBe(1);
    expect(slotMinuteOfDay(s.slots.at(-1)!)).toBe(530); // 다음 날 08:50
  });

  it("종료 = 시작이면 24시간 근무 = 144칸", () => {
    const s = ok("2026-10-01", "09:00", "09:00");
    expect(s.durationMinutes).toBe(1440);
    expect(s.slots).toHaveLength(144);
  });

  it("10분 단위 근무: 18:10~18:20 = 1칸", () => {
    expect(ok("2026-10-01", "18:10", "18:20").slots).toEqual([1090]);
  });

  it("[식사시간 공제] 체크 값이 없으면 체크된 것으로 본다 (규칙 3)", () => {
    expect(ok("2026-10-01", "22:00", "06:00").mealDeduct).toBe(true);
    expect(ok("2026-10-01", "22:00", "06:00", false).mealDeduct).toBe(false);
  });
});

describe("잘못된 입력은 계산하지 않는다 (재입력 안내, 규칙 11)", () => {
  it.each([
    ["빈 시작", "", "18:00"],
    ["빈 종료", "09:00", ""],
    ["10분 단위 아님", "09:05", "18:00"],
    ["없는 시각", "25:00", "09:00"],
  ])("%s", (_, start, end) => {
    expect(buildShift("2026-10-01", { start, end })).toEqual({ ok: false, error: "INVALID_TIME" });
  });
});

describe("겹침 검사 (추가 근무는 정해진 근무시간 밖만, 규칙 14)", () => {
  const night = ok("2026-10-06", "18:00", "09:00"); // 10/6 18:00 ~ 10/7 09:00

  it("근무 중간에 넣은 추가 근무는 겹침", () => {
    expect(shiftsOverlap(night, ok("2026-10-06", "20:00", "22:00"))).toBe(true);
  });

  it("다음 날 새벽 추가 근무도 날짜를 넘겨 겹침으로 잡는다", () => {
    expect(shiftsOverlap(night, ok("2026-10-07", "07:00", "10:00"))).toBe(true);
  });

  it("근무가 끝난 뒤 바로 이어지는 추가 근무는 겹치지 않음", () => {
    expect(shiftsOverlap(night, ok("2026-10-07", "09:00", "12:00"))).toBe(false);
  });

  it("근무 시작 전 추가 근무는 겹치지 않음", () => {
    expect(shiftsOverlap(night, ok("2026-10-06", "15:00", "18:00"))).toBe(false);
  });

  it("일근 09:00~18:00 뒤 18:00~21:00 초과근무는 겹치지 않음", () => {
    const day = ok("2026-10-08", "09:00", "18:00");
    expect(shiftsOverlap(day, ok("2026-10-08", "18:00", "21:00"))).toBe(false);
    expect(shiftsOverlap(day, ok("2026-10-08", "17:00", "21:00"))).toBe(true);
  });
});
