// lib/overtime/result.ts 시험 — 결과 3줄(휴일은 일수 병기)과 고정 안내 문구 (규칙 1·17)
import { describe, expect, it } from "vitest";
import { effectiveHolidays } from "../holidays/kr";
import type { Profile } from "../types";
import { calculateMonth } from "./monthly";
import { HOLIDAY_DAY_MINUTES, RESULT_DISCLAIMER, formatHolidayDays, resultRows } from "./result";

describe("결과 3줄", () => {
  it("항상 기본 초과·야간·휴일 3줄, 이 순서이고 합계 줄은 없다", () => {
    const rows = resultRows({ basic: 0, night: 0, holiday: 0 });
    expect(rows.map((r) => r.label)).toEqual(["기본 초과", "야간", "휴일"]);
    expect(rows.map((r) => r.key)).toEqual(["basic", "night", "holiday"]);
  });

  it("0이어도 줄이 빠지지 않고 '0시간 00분'으로 보인다", () => {
    expect(resultRows({ basic: 0, night: 0, holiday: 0 }).map((r) => r.text)).toEqual(["0시간 00분", "0시간 00분", "0시간 00분"]);
  });

  it("분을 ○시간 ○○분으로 바꿔 보여 준다 (예: 12시간 30분, 40시간 00분)", () => {
    const rows = resultRows({ basic: 750, night: 2400, holiday: 960 });
    expect(rows.map((r) => r.text)).toEqual(["12시간 30분", "40시간 00분", "16시간 00분"]);
  });

  it("10분 단위 값도 그대로 보인다", () => {
    expect(resultRows({ basic: 10, night: 0, holiday: 0 })[0].text).toBe("0시간 10분");
  });
});

describe("휴일 일수 병기 (8시간 = 1일)", () => {
  it("8시간을 1일로 계산한다", () => {
    expect(HOLIDAY_DAY_MINUTES).toBe(480);
    expect(formatHolidayDays(480)).toBe("(1일)");
    expect(formatHolidayDays(48 * 60)).toBe("(6일)");
    expect(formatHolidayDays(0)).toBe("(0일)");
  });
  it("8시간으로 나누어떨어지지 않으면 소수로 보인다 (소수 둘째 자리까지, 끝의 0은 뺌)", () => {
    expect(formatHolidayDays(12 * 60)).toBe("(1.5일)");
    expect(formatHolidayDays(4 * 60)).toBe("(0.5일)");
    expect(formatHolidayDays(10 * 60)).toBe("(1.25일)");
    expect(formatHolidayDays(10)).toBe("(0.02일)");
  });
  it("휴일 줄에만 일수가 붙는다", () => {
    const rows = resultRows({ basic: 180, night: 3240, holiday: 2880 });
    expect(rows.map((r) => r.note)).toEqual([undefined, undefined, "(6일)"]);
  });
});

describe("고정 안내 문구", () => {
  it("PRD 규칙 17의 문장 그대로다", () => {
    expect(RESULT_DISCLAIMER).toBe("참고용 계산이며, 최종 확정은 소속 관서 집계 기준을 따릅니다");
  });
});

describe("실제 월간 계산 결과와 이어 보기", () => {
  const patrol: Profile = {
    effectiveFrom: "2000-01-01",
    agency: "서울청",
    department: "지구대·파출소",
    team: "1팀",
    pattern: 2,
    patternStartDate: "2026-10-01",
    shiftTimes: { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } },
  };

  it("시험 사례 1(패턴 2, 2026년 10월)은 3 / 54 / 48시간(휴일 6일)으로 보인다", () => {
    const r = calculateMonth({ year: 2026, month: 10, profiles: [patrol], overrides: {}, holidays: effectiveHolidays() });
    expect(resultRows(r.total).map((x) => x.text)).toEqual(["3시간 00분", "54시간 00분", "48시간 00분"]);
    expect(resultRows(r.total)[2].note).toBe("(6일)");
    expect(r.total.sum).toBe(105 * 60); // 합계는 계산·시험에만 남아 있고 화면에는 보이지 않는다
  });
});
