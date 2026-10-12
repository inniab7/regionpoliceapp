// lib/overtime/calendar.ts 시험 — 달력 칸 배치와 달 이동
import { describe, expect, it } from "vitest";
import { isSameMonth, monthGrid, monthLabel, shiftMonth, yearMonthOf } from "./calendar";

describe("달력 칸 배치 (일~토 7칸씩)", () => {
  it("2026년 10월: 1일이 목요일이라 앞에 4칸이 비고, 5줄", () => {
    const rows = monthGrid(2026, 10);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(rows[4]).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
  });

  it("모든 줄이 7칸이고 그 달 날짜만 들어 있다 (다른 달 날짜 없음)", () => {
    for (const [y, m] of [[2026, 2], [2026, 11], [2028, 2], [2026, 8], [2027, 5]] as const) {
      const rows = monthGrid(y, m);
      for (const row of rows) expect(row).toHaveLength(7);
      const dates = rows.flat().filter((d): d is string => d !== null);
      expect(dates).toHaveLength(new Date(Date.UTC(y, m, 0)).getUTCDate());
      expect(dates.every((d) => d.startsWith(`${y}-${String(m).padStart(2, "0")}-`))).toBe(true);
    }
  });

  it("2026년 2월: 1일이 일요일, 28일이라 딱 4줄(빈 칸 없음)", () => {
    const rows = monthGrid(2026, 2);
    expect(rows).toHaveLength(4);
    expect(rows.flat().includes(null)).toBe(false);
  });

  it("2026년 11월: 1일이 일요일, 30일이라 마지막 줄 뒤에 빈 칸 5개", () => {
    const rows = monthGrid(2026, 11);
    expect(rows).toHaveLength(5);
    expect(rows[4]).toEqual(["2026-11-29", "2026-11-30", null, null, null, null, null]);
  });

  it("2026년 8월: 31일이 월요일이라 6줄 (31일만 있는 마지막 줄)", () => {
    const rows = monthGrid(2026, 8);
    expect(rows).toHaveLength(6);
    expect(rows[5]).toEqual(["2026-08-30", "2026-08-31", null, null, null, null, null]);
  });

  it("요일 칸이 맞다: 어느 날짜든 그 칸의 요일(일=0)과 일치", () => {
    // 2026-10-06은 화요일 → 둘째 줄의 3번째(인덱스 2)
    expect(monthGrid(2026, 10)[1][2]).toBe("2026-10-06");
  });
});

describe("달 이동", () => {
  it("다음·이전 달", () => {
    expect(shiftMonth({ year: 2026, month: 10 }, 1)).toEqual({ year: 2026, month: 11 });
    expect(shiftMonth({ year: 2026, month: 10 }, -1)).toEqual({ year: 2026, month: 9 });
  });

  it("해가 바뀐다: 12월 → 1월, 1월 ← 12월", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("여러 달을 한 번에 옮길 수 있다", () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 14)).toEqual({ year: 2028, month: 1 });
    expect(shiftMonth({ year: 2026, month: 3 }, -15)).toEqual({ year: 2024, month: 12 });
  });
});

describe("표시용 도우미", () => {
  it("연·월 라벨과 비교", () => {
    expect(monthLabel({ year: 2026, month: 10 })).toBe("2026년 10월");
    expect(yearMonthOf("2026-10-12")).toEqual({ year: 2026, month: 10 });
    expect(isSameMonth({ year: 2026, month: 10 }, yearMonthOf("2026-10-31"))).toBe(true);
    expect(isSameMonth({ year: 2026, month: 10 }, yearMonthOf("2026-11-01"))).toBe(false);
  });
});
