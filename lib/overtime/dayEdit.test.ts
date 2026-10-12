// lib/overtime/dayEdit.ts 시험 — 근무 변경 창: 입력 → 변경 기록, 입력 검사, 처음 값
import { describe, expect, it } from "vitest";
import { effectiveHolidays } from "../holidays/kr";
import { plannedDay } from "../schedule/generate";
import type { Profile } from "../types";
import {
  buildDayEntry,
  canTakeLeave,
  checkDayEntry,
  defaultExtraRange,
  describePlanned,
  initialDayForm,
  type DayEditForm,
} from "./dayEdit";

const HOLIDAYS = effectiveHolidays();

const patrol: Profile = {
  effectiveFrom: "2000-01-01",
  agency: "서울청",
  department: "지구대·파출소",
  team: "1팀",
  pattern: 2, // 10/1 주간, 10/2 야간, 10/3 비번, 10/4 휴무 …
  patternStartDate: "2026-10-01",
  shiftTimes: { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } },
};
const office: Profile = { ...patrol, pattern: 5, patternStartDate: undefined, shiftTimes: {} };

const input = (profiles: Profile[], overrides = {}) => ({ profiles, overrides, holidays: HOLIDAYS });
const planned = (profiles: Profile[], date: string) => plannedDay(profiles, date, HOLIDAYS);

const blank = (p: ReturnType<typeof planned>): DayEditForm => initialDayForm(undefined, p);

describe("근무를 바꿀 수 있는 날", () => {
  it("근무일만 휴가를 고를 수 있다 (주간·야간·일근), 쉬는 날은 안 된다 (규칙 4)", () => {
    expect(canTakeLeave(planned([patrol], "2026-10-01"))).toBe(true); // 주간
    expect(canTakeLeave(planned([patrol], "2026-10-02"))).toBe(true); // 야간
    expect(canTakeLeave(planned([patrol], "2026-10-03"))).toBe(false); // 비번
    expect(canTakeLeave(planned([patrol], "2026-10-04"))).toBe(false); // 휴무
    expect(canTakeLeave(planned([office], "2026-10-13"))).toBe(true); // 일근
    expect(canTakeLeave(planned([office], "2026-10-17"))).toBe(false); // 토요일 휴무
  });

  it("등록 정보가 적용되지 않는 날은 휴가를 고를 수 없다", () => {
    const later = { ...patrol, effectiveFrom: "2026-11-01" };
    expect(canTakeLeave(planned([later], "2026-10-05"))).toBe(false);
  });
});

describe("처음 입력 상태", () => {
  it("변경이 없던 날: 바꾸지 않음, 추가 근무 꺼짐", () => {
    const f = blank(planned([patrol], "2026-10-01"));
    expect(f.replace).toBe("none");
    expect(f.extraOn).toBe(false);
  });

  it("추가 근무 기본 시간: 정해진 근무가 끝나는 시각부터 3시간", () => {
    expect(defaultExtraRange(planned([office], "2026-10-13"))).toEqual({ start: "18:00", end: "21:00" });
  });

  it("쉬는 날 추가 근무 기본 시간은 09:00~18:00", () => {
    expect(defaultExtraRange(planned([patrol], "2026-10-03"))).toEqual({ start: "09:00", end: "18:00" });
  });

  it("저장된 변경이 있으면 그대로 불러온다", () => {
    const f = initialDayForm(
      { replace: { type: "교육출장", start: "08:00", end: "20:00" }, extra: { start: "21:00", end: "23:00" } },
      planned([office], "2026-10-13"),
    );
    expect(f).toMatchObject({ replace: "교육출장", training: { start: "08:00", end: "20:00" }, extraOn: true, extra: { start: "21:00", end: "23:00" } });
  });
});

describe("입력 → 저장할 변경 기록", () => {
  const p = planned([office], "2026-10-13");

  it("아무것도 안 골랐으면 빈 기록 (= 원래대로)", () => {
    expect(buildDayEntry(blank(p))).toEqual({});
  });

  it("휴가", () => {
    expect(buildDayEntry({ ...blank(p), replace: "휴가" })).toEqual({ replace: { type: "휴가" } });
  });

  it("교육·출장은 시간을 담는다", () => {
    expect(buildDayEntry({ ...blank(p), replace: "교육출장", training: { start: "08:00", end: "20:00" } })).toEqual({
      replace: { type: "교육출장", start: "08:00", end: "20:00" },
    });
  });

  it("휴가와 추가 근무를 함께 둘 수 있다", () => {
    expect(buildDayEntry({ ...blank(p), replace: "휴가", extraOn: true, extra: { start: "19:00", end: "21:00" } })).toEqual({
      replace: { type: "휴가" },
      extra: { start: "19:00", end: "21:00" },
    });
  });

  it("추가 근무를 끄면 시간은 저장하지 않는다", () => {
    expect(buildDayEntry({ ...blank(p), extraOn: false, extra: { start: "19:00", end: "21:00" } })).toEqual({});
  });

  it("[식사시간 공제] 체크는 평시 1시간 미만 근무에만 남긴다 (규칙 3)", () => {
    const night = buildDayEntry({ ...blank(p), extraOn: true, extra: { start: "22:00", end: "06:00", mealDeduct: false } });
    expect(night.extra).toEqual({ start: "22:00", end: "06:00", mealDeduct: false });
    const day = buildDayEntry({ ...blank(p), extraOn: true, extra: { start: "19:00", end: "21:00", mealDeduct: false } });
    expect(day.extra).toEqual({ start: "19:00", end: "21:00" });
  });
});

describe("저장해도 되는지 검사", () => {
  it("올바른 추가 근무(일근 18~21시)는 통과", () => {
    expect(checkDayEntry(input([office]), "2026-10-13", { extra: { start: "18:00", end: "21:00" } })).toBeNull();
  });

  it("정해진 근무시간과 겹치는 추가 근무는 안내 (규칙 14)", () => {
    const msg = checkDayEntry(input([office]), "2026-10-13", { extra: { start: "17:00", end: "21:00" } });
    expect(msg).toContain("겹쳐요");
    expect(msg).toContain("10/13");
  });

  it("전날 야간이 끝나기 전의 추가 근무도 겹침 (10/2 야간 18:00~10/3 09:00)", () => {
    expect(checkDayEntry(input([patrol]), "2026-10-03", { extra: { start: "07:00", end: "10:00" } })).toContain("겹쳐요");
    expect(checkDayEntry(input([patrol]), "2026-10-03", { extra: { start: "09:00", end: "12:00" } })).toBeNull();
  });

  it("교육·출장으로 바꾼 날은 바뀐 시간과 겹치는지 본다", () => {
    const entry = { replace: { type: "교육출장" as const, start: "08:00", end: "20:00" }, extra: { start: "19:00", end: "22:00" } };
    expect(checkDayEntry(input([office]), "2026-10-13", entry)).toContain("겹쳐요");
  });

  it("휴가로 바꾼 날의 추가 근무는 정해진 근무와 겹치지 않는다 (그날 근무가 없으므로)", () => {
    const entry = { replace: { type: "휴가" as const }, extra: { start: "10:00", end: "12:00" } };
    expect(checkDayEntry(input([office]), "2026-10-13", entry)).toBeNull();
  });

  it("쉬는 날의 휴가는 안내", () => {
    expect(checkDayEntry(input([patrol]), "2026-10-03", { replace: { type: "휴가" } })).toContain("쉬는 날");
  });

  it("교육·출장 시간이 올바르지 않으면 안내", () => {
    expect(checkDayEntry(input([office]), "2026-10-13", { replace: { type: "교육출장", start: "09:05", end: "18:00" } })).toContain("다시 입력");
  });

  it("다른 날의 문제는 이 날 저장을 막지 않는다", () => {
    const overrides = { "2026-10-14": { extra: { start: "17:00", end: "21:00" } } }; // 이미 겹치는 날이 있어도
    expect(checkDayEntry(input([office], overrides), "2026-10-13", { replace: { type: "휴가" } })).toBeNull();
  });

  it("빈 기록(원래대로)은 늘 통과", () => {
    expect(checkDayEntry(input([office]), "2026-10-13", {})).toBeNull();
  });
});

describe("창 맨 위 설명", () => {
  it("정해진 근무를 한 줄로", () => {
    expect(describePlanned([patrol], "2026-10-02", HOLIDAYS)).toBe("야간 18:00~다음 날 09:00");
    expect(describePlanned([patrol], "2026-10-01", HOLIDAYS)).toBe("주간 09:00~18:00");
    expect(describePlanned([patrol], "2026-10-03", HOLIDAYS)).toBe("비번");
    expect(describePlanned([{ ...patrol, pattern: 4, shiftTimes: {} }], "2026-10-01", HOLIDAYS)).toBe("당직 09:00 시작 · 24시간");
  });
});
