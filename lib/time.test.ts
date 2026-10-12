// lib/time.ts 시험 — 시각·근무 길이·날짜·요일·한국 시간
import { describe, expect, it } from "vitest";
import {
  addDays,
  datesInMonth,
  daysInMonth,
  diffDays,
  formatDuration,
  formatShortDate,
  formatTime,
  isValidDate,
  isValidShiftTime,
  isWeekend,
  monthOf,
  parseTime,
  shiftDurationMinutes,
  todayInKst,
  weekdayLabel,
  weekStart,
} from "./time";

describe("시각 ↔ 분", () => {
  it("HH:MM을 분으로 바꾼다", () => {
    expect(parseTime("18:30")).toBe(1110);
    expect(parseTime("00:00")).toBe(0);
  });

  it("잘못된 형식은 null", () => {
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("9:00")).toBeNull();
    expect(parseTime("")).toBeNull();
  });

  it("분을 HH:MM으로 바꾸고 하루 안으로 접는다", () => {
    expect(formatTime(1500)).toBe("01:00");
    expect(formatTime(-60)).toBe("23:00");
  });

  it("10분 단위만 근무 시각으로 인정한다 (규칙 9)", () => {
    expect(isValidShiftTime("18:10")).toBe(true);
    expect(isValidShiftTime("18:15")).toBe(false);
  });
});

describe("근무 1회 길이 (규칙 11)", () => {
  it("같은 날 끝나는 근무", () => {
    expect(shiftDurationMinutes("09:00", "18:00")).toBe(540);
  });

  it("종료 < 시작이면 다음 날 끝난다", () => {
    expect(shiftDurationMinutes("18:00", "09:00")).toBe(900);
    expect(shiftDurationMinutes("22:00", "06:00")).toBe(480);
  });

  it("종료 = 시작이면 24시간 근무", () => {
    expect(shiftDurationMinutes("09:00", "09:00")).toBe(1440);
  });

  it("잘못된 시각은 null (재입력 안내용)", () => {
    expect(shiftDurationMinutes("18:15", "09:00")).toBeNull();
    expect(shiftDurationMinutes("", "09:00")).toBeNull();
  });
});

describe("결과 표시 형식", () => {
  it("분을 ○시간 ○○분으로 보여 준다", () => {
    expect(formatDuration(750)).toBe("12시간 30분");
    expect(formatDuration(2400)).toBe("40시간 00분");
    expect(formatDuration(0)).toBe("0시간 00분");
  });
});

describe("날짜", () => {
  it("실제로 있는 날짜만 인정한다", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2028-02-29")).toBe(true); // 윤년
    expect(isValidDate("2026-13-01")).toBe(false);
  });

  it("월말·연말을 넘겨 더하고 뺀다", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("날짜 차이를 센다", () => {
    expect(diffDays("2026-10-01", "2026-10-06")).toBe(5);
  });

  it("달의 일수와 날짜 목록", () => {
    expect(daysInMonth(2026, 10)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    const october = datesInMonth(2026, 10);
    expect(october[0]).toBe("2026-10-01");
    expect(october.at(-1)).toBe("2026-10-31");
    expect(monthOf("2026-10-31")).toBe("2026-10");
  });
});

describe("요일과 주 (한 주 = 일~토, 규칙 4)", () => {
  it("요일 한 글자", () => {
    expect(weekdayLabel("2026-10-06")).toBe("화");
    expect(weekdayLabel("2026-10-12")).toBe("월");
  });

  it("토·일은 주말", () => {
    expect(isWeekend("2026-10-10")).toBe(true);
    expect(isWeekend("2026-10-12")).toBe(false);
  });

  it("그 주의 일요일을 찾는다 (달을 걸친 주 포함)", () => {
    expect(weekStart("2026-10-07")).toBe("2026-10-04");
    expect(weekStart("2026-11-01")).toBe("2026-11-01");
    expect(weekStart("2026-10-01")).toBe("2026-09-27");
  });
});

describe("한국 시간 오늘", () => {
  it("기기 시간대와 관계없이 한국 날짜를 쓴다", () => {
    // 한국 시간 2026-10-07 00:30 = UTC 2026-10-06 15:30
    expect(todayInKst(new Date("2026-10-06T15:30:00Z"))).toBe("2026-10-07");
    expect(todayInKst(new Date("2026-10-06T14:59:00Z"))).toBe("2026-10-06");
  });

  it("화면용 짧은 날짜", () => {
    expect(formatShortDate("2026-10-06")).toBe("10/6(화)");
  });
});
