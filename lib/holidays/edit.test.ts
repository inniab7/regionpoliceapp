// lib/holidays/edit.ts 시험 — 공휴일 추가·삭제·되돌리기 (규칙 15)
import { describe, expect, it } from "vitest";
import { createEmptyData } from "../storage/store";
import { effectiveHolidays } from "./kr";
import { addHoliday, countHolidaysForYear, holidayRowsForYear, isHoliday, removeHoliday, restoreHoliday } from "./edit";

const NOW = "2026-10-12T00:00:00.000Z";
const empty = () => createEmptyData(NOW);

describe("공휴일 목록 (해마다)", () => {
  it("2026년 내장 공휴일 22개, 모두 '기본', 뺀 날 없음", () => {
    const rows = holidayRowsForYear(empty(), 2026);
    expect(rows).toHaveLength(22);
    expect(rows.every((r) => r.source === "기본" && !r.removed)).toBe(true);
    expect(rows[0]).toMatchObject({ date: "2026-01-01", name: "신정" });
  });

  it("날짜 순으로 정렬되고, 직접 추가한 날도 끼워 넣는다", () => {
    const { data } = addHoliday(empty(), "2026-10-20");
    const dates = holidayRowsForYear(data, 2026).map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
    expect(holidayRowsForYear(data, 2026).find((r) => r.date === "2026-10-20")).toMatchObject({
      name: "직접 추가",
      source: "추가",
      removed: false,
    });
  });

  it("내장 목록이 없는 해는 직접 추가한 날만 보인다", () => {
    expect(holidayRowsForYear(empty(), 2049)).toEqual([]);
    const { data } = addHoliday(empty(), "2049-03-15");
    expect(holidayRowsForYear(data, 2049).map((r) => r.date)).toEqual(["2049-03-15"]);
  });
});

describe("추가 (addHoliday)", () => {
  it("평일 날짜를 추가하면 공휴일이 된다", () => {
    const r = addHoliday(empty(), "2026-10-20"); // 화요일
    expect(r.result).toBe("added");
    expect(isHoliday(r.data, "2026-10-20")).toBe(true);
  });

  it("이미 공휴일이면 추가하지 않는다 (내장 공휴일 포함)", () => {
    expect(addHoliday(empty(), "2026-10-09").result).toBe("already"); // 한글날
    const once = addHoliday(empty(), "2026-10-20").data;
    expect(addHoliday(once, "2026-10-20").result).toBe("already");
  });

  it("토·일요일은 지정하지 않아도 휴일이라 추가하지 않는다", () => {
    expect(addHoliday(empty(), "2026-10-17").result).toBe("weekend"); // 토
    expect(addHoliday(empty(), "2026-10-18").result).toBe("weekend"); // 일
  });

  it("없는 날짜는 거부한다", () => {
    expect(addHoliday(empty(), "2026-02-30").result).toBe("invalid");
    expect(addHoliday(empty(), "").result).toBe("invalid");
  });

  it("뺀 내장 공휴일을 다시 추가하면 되돌린다 (추가 목록에는 넣지 않음)", () => {
    const removed = removeHoliday(empty(), "2026-10-09");
    const r = addHoliday(removed, "2026-10-09");
    expect(r.result).toBe("restored");
    expect(r.data.holidaysRemoved).toEqual([]);
    expect(r.data.holidaysAdded).toEqual([]);
  });

  it("원래 데이터는 바꾸지 않는다", () => {
    const before = empty();
    addHoliday(before, "2026-10-20");
    expect(before.holidaysAdded).toEqual([]);
  });
});

describe("삭제와 되돌리기", () => {
  it("직접 추가한 날을 삭제하면 목록에서 사라진다", () => {
    const added = addHoliday(empty(), "2026-10-20").data;
    const after = removeHoliday(added, "2026-10-20");
    expect(after.holidaysAdded).toEqual([]);
    expect(isHoliday(after, "2026-10-20")).toBe(false);
  });

  it("내장 공휴일을 삭제하면 '뺀 날'이 되어 공휴일이 아니게 된다", () => {
    const after = removeHoliday(empty(), "2026-10-09");
    expect(after.holidaysRemoved).toEqual(["2026-10-09"]);
    expect(isHoliday(after, "2026-10-09")).toBe(false);
    expect(effectiveHolidays(after.holidaysAdded, after.holidaysRemoved).has("2026-10-09")).toBe(false);
    // 목록에는 남아 있고 '뺀 날' 표시
    expect(holidayRowsForYear(after, 2026).find((r) => r.date === "2026-10-09")?.removed).toBe(true);
  });

  it("뺀 공휴일을 되돌리면 다시 공휴일", () => {
    const back = restoreHoliday(removeHoliday(empty(), "2026-10-09"), "2026-10-09");
    expect(back.holidaysRemoved).toEqual([]);
    expect(isHoliday(back, "2026-10-09")).toBe(true);
  });

  it("공휴일이 아닌 날을 삭제하거나, 뺀 적 없는 날을 되돌려도 아무 일 없다", () => {
    const data = empty();
    expect(removeHoliday(data, "2026-10-08")).toBe(data);
    expect(restoreHoliday(data, "2026-10-09")).toBe(data);
  });

  it("같은 공휴일을 두 번 삭제해도 한 번만 기록된다", () => {
    const twice = removeHoliday(removeHoliday(empty(), "2026-10-09"), "2026-10-09");
    expect(twice.holidaysRemoved).toEqual(["2026-10-09"]);
  });
});

describe("그 해 공휴일 일수 (countHolidaysForYear)", () => {
  it("2026년은 22일, 2027년은 24일", () => {
    expect(countHolidaysForYear(empty(), 2026)).toBe(22);
    expect(countHolidaysForYear(empty(), 2027)).toBe(24);
  });
  it("직접 추가하면 늘고, 뺀 날은 줄고, 되돌리면 다시 는다", () => {
    const added = addHoliday(empty(), "2026-10-20").data;
    expect(countHolidaysForYear(added, 2026)).toBe(23);
    const removed = removeHoliday(added, "2026-10-09");
    expect(countHolidaysForYear(removed, 2026)).toBe(22);
    expect(countHolidaysForYear(restoreHoliday(removed, "2026-10-09"), 2026)).toBe(23);
  });
  it("다른 해에는 영향이 없고, 내장 데이터가 없는 해는 0일", () => {
    const added = addHoliday(empty(), "2026-10-20").data;
    expect(countHolidaysForYear(added, 2027)).toBe(24);
    expect(countHolidaysForYear(empty(), 2049)).toBe(0);
  });
  it("2028~2048년도 센다 (예: 2028년 18일)", () => {
    expect(countHolidaysForYear(empty(), 2028)).toBe(18);
    expect(countHolidaysForYear(empty(), 2048)).toBe(20);
  });
});
