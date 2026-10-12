// lib/holidays/kr.ts 시험 — 2026~2048년 내장 공휴일: 연도마다 있어야 할 날, 대체공휴일 규칙, 한국 기준 음력 값
import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, isValidDate } from "../time";
import { BUILT_IN_HOLIDAYS, COMPUTED_FROM_YEAR, effectiveHolidays } from "./kr";

const dates = Object.keys(BUILT_IN_HOLIDAYS);
const years = Array.from({ length: 23 }, (_, i) => 2026 + i);
const name = (d: string) => BUILT_IN_HOLIDAYS[d];

describe("데이터 모양", () => {
  it("모두 올바른 날짜이고, 날짜순이며 겹치지 않는다", () => {
    expect(dates.every((d) => isValidDate(d))).toBe(true);
    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
  });
  it("2026~2048년이 모두 들어 있고 그 밖의 해는 없다", () => {
    const present = [...new Set(dates.map((d) => Number(d.slice(0, 4))))];
    expect(present).toEqual(years);
  });
  it("계산값 시작 연도는 2028년", () => expect(COMPUTED_FROM_YEAR).toBe(2028));
});

describe("해마다 있어야 하는 공휴일", () => {
  it.each(years)("%i년: 고정 공휴일 10개와 설날·추석 연휴, 부처님오신날이 있다", (y) => {
    for (const [md, n] of [["01-01", "신정"], ["03-01", "삼일절"], ["05-01", "노동절"], ["05-05", "어린이날"], ["06-06", "현충일"], ["07-17", "제헌절"], ["08-15", "광복절"], ["10-03", "개천절"], ["10-09", "한글날"], ["12-25", "성탄절"]]) {
      expect(name(`${y}-${md}`), `${y}-${md}`).toContain(n);
    }
    const inYear = dates.filter((d) => d.startsWith(`${y}-`));
    // 다른 공휴일과 겹친 날은 이름이 "개천절·추석"처럼 합쳐진다
    const isMain = (d: string, word: string) => name(d).includes(word) && !name(d).includes("연휴") && !name(d).startsWith("대체");
    expect(inYear.filter((d) => isMain(d, "설날"))).toHaveLength(1);
    expect(inYear.filter((d) => isMain(d, "추석"))).toHaveLength(1);
    expect(inYear.some((d) => name(d).includes("부처님오신날"))).toBe(true);
    // 설날·추석은 앞뒤 하루씩 연휴가 붙는다
    for (const main of inYear.filter((d) => isMain(d, "설날") || isMain(d, "추석"))) {
      expect(name(addDays(main, -1))).toContain("연휴");
      expect(name(addDays(main, 1))).toContain("연휴");
    }
  });
});

describe("대체공휴일 규칙", () => {
  const subs = dates.filter((d) => name(d).startsWith("대체공휴일"));
  it("대체공휴일은 모두 평일(월~금)이다", () => {
    for (const d of subs) expect([0, 6], d).not.toContain(dayOfWeek(d));
  });
  it("신정·현충일은 토·일이어도 대체공휴일이 없다 (2026년 현충일은 토요일)", () => {
    expect(dayOfWeek("2026-06-06")).toBe(6);
    expect(subs.some((d) => name(d).includes("신정") || name(d).includes("현충일"))).toBe(false);
  });
  it("토·일에 걸린 삼일절·광복절·개천절·한글날·성탄절은 다음 평일로 대체된다 (2027 검증 값)", () => {
    expect(name("2027-10-11")).toBe("대체공휴일(한글날)"); // 10/9 토 → 10/10 일을 건너뛰고 월요일
    expect(name("2027-12-27")).toBe("대체공휴일(성탄절)");
    expect(name("2026-03-02")).toBe("대체공휴일(삼일절)");
  });
  it("설날 연휴에 일요일이 끼면 연휴 다음 평일이 대체공휴일이다", () => {
    expect(name("2027-02-09")).toBe("대체공휴일(설날)"); // 2/6 토, 2/7 일(설날), 2/8 월
    expect(name("2033-02-02")).toBe("대체공휴일(설날)"); // 2033 설날 1/31 월 → 연휴 1/30 일
  });
  it("연휴에 토요일만 있으면 대체공휴일이 없다 (2026 추석 9/24~26)", () => {
    expect(dates.some((d) => d.startsWith("2026-09") && name(d).startsWith("대체"))).toBe(false);
  });
  it("대체공휴일은 공휴일이나 주말과 겹치지 않고 해마다 최소 0, 최대 8일", () => {
    for (const y of years) {
      const n = subs.filter((d) => d.startsWith(`${y}-`)).length;
      expect(n, `${y}`).toBeLessThanOrEqual(8);
    }
  });
});

describe("음력 공휴일: 한국 시각 기준 (중국 달력과 하루 다른 해)", () => {
  it("2028 설날은 1월 27일 (한국 시각으로 삭이 27일 00:12)", () => expect(name("2028-01-27")).toBe("설날"));
  it("2030 설날은 2월 3일", () => expect(name("2030-02-03")).toBe("설날"));
  it("2040 추석은 9월 21일", () => expect(name("2040-09-21")).toBe("추석"));
  it("알려진 값: 2026 설날 2/17·추석 9/25·부처님오신날 5/24, 2027 설날 2/7·추석 9/15·부처님오신날 5/13", () => {
    expect(name("2026-02-17")).toBe("설날");
    expect(name("2026-09-25")).toBe("추석");
    expect(name("2026-05-24")).toBe("부처님오신날");
    expect(name("2027-02-07")).toBe("설날");
    expect(name("2027-09-15")).toBe("추석");
    expect(name("2027-05-13")).toBe("부처님오신날");
  });
  it("두 공휴일이 겹치면 이름을 함께 쓰고 대체공휴일은 1일 (2028 추석 10/3 = 개천절)", () => {
    expect(name("2028-10-03")).toBe("개천절·추석");
    expect(name("2028-10-05")).toBe("대체공휴일(개천절·추석)");
  });
  it("2028-04-12 국회의원선거만 선거일로 들어 있다 (2027 이후 지방선거 등은 정해지면 직접 추가)", () => {
    expect(dates.filter((d) => name(d).includes("선거")).sort()).toEqual(["2026-06-03", "2028-04-12"]);
  });
});

describe("effectiveHolidays", () => {
  it("2048년 공휴일도 달력·계산에 쓰인다", () => {
    expect(effectiveHolidays().has("2048-12-25")).toBe(true);
    expect(effectiveHolidays().has("2049-01-01")).toBe(false);
  });
});
