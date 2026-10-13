// lib/overtime/allocate.ts 시험 — 월 기준시간 초과(기본 초과)·야간(겹쳐서 따로)·휴일(따로) 배분
// 모든 기대값은 엔진을 돌려 본 값이 아니라 손으로 계산한 값이다 (규칙 4·5·6·7).
import { describe, expect, it } from "vitest";
import { effectiveHolidays } from "../holidays/kr";
import { allocate, monthlyBaseMinutes, type DayWork } from "./allocate";
import { buildShift, type Shift } from "./shift";

function shift(date: string, start: string, end: string): Shift {
  const r = buildShift(date, { start, end });
  if (!r.ok) throw new Error("근무를 만들지 못함");
  return r.shift;
}

/** 하루 입력 만들기: [시작, 끝] 근무들 */
function day(date: string, ranges: [string, string][], opts: Partial<DayWork> = {}): DayWork {
  return { date, restDay: false, creditDay: false, shifts: ranges.map(([s, e]) => shift(date, s, e)), ...opts };
}

const h = (hours: number) => hours * 60;
/** 2026년 10월의 날짜 */
const oct = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;
/** 월~금 평일 날짜 (2026-10-12(월)~16(금)) */
const WEEK = [12, 13, 14, 15, 16].map(oct);

describe("월 기준시간 = 평일(월~금) 중 공휴일이 아닌 날 × 8시간 (규칙 4)", () => {
  it("2026년 10월: 평일 22일 − 대체공휴일(5일)·한글날(9일) = 20일 → 160시간", () => {
    expect(monthlyBaseMinutes("2026-10-01", "2026-10-31", effectiveHolidays())).toBe(h(160));
  });

  it("공휴일이 없는 한 주(월~금)는 40시간, 수요일이 공휴일이면 32시간", () => {
    expect(monthlyBaseMinutes(oct(12), oct(18), new Set())).toBe(h(40));
    expect(monthlyBaseMinutes(oct(12), oct(18), new Set([oct(14)]))).toBe(h(32));
  });

  it("토·일과 겹친 공휴일은 빼지 않는다 (2026년 10월 3일 개천절은 토요일)", () => {
    expect(monthlyBaseMinutes(oct(12), oct(18), new Set([oct(17)]))).toBe(h(40));
  });

  it("2026년 2월: 평일 20일 − 설날 연휴 3일(16·17·18일) = 17일 → 136시간", () => {
    expect(monthlyBaseMinutes("2026-02-01", "2026-02-28", effectiveHolidays())).toBe(h(136));
  });

  it("받은 날짜 범위로 계산한다: 2026-10-01(목)·02(금)만 있으면 평일 2일 → 16시간", () => {
    const r = allocate([day(oct(1), [["09:00", "18:00"]]), day(oct(2), [["09:00", "18:00"]])]);
    expect(r.baseMinutes).toBe(h(16));
  });
});

describe("기본 초과 = 그 달 근무시간이 월 기준시간을 넘은 만큼 (규칙 4)", () => {
  const BASE = h(40);

  it("기준과 똑같이 일하면 0 (월~금 주간 8시간씩 = 40시간)", () => {
    const r = allocate(WEEK.map((d) => day(d, [["09:00", "18:00"]])), new Set(), BASE);
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: 0 });
    expect(r.countedMinutes).toBe(h(40));
  });

  it("넘은 시간만 기본 초과: 금요일 추가 근무 19~21시(공제 후 1시간) → 1시간", () => {
    const days = WEEK.slice(0, 4).map((d) => day(d, [["09:00", "18:00"]]));
    days.push(day(WEEK[4], [["09:00", "18:00"], ["19:00", "21:00"]]));
    expect(allocate(days, new Set(), BASE).total).toEqual({ basic: h(1), night: 0, holiday: 0 });
  });

  it("기준보다 적게 일하면 0 (일을 안 한 날이 있으면 초과가 생기지 않는다)", () => {
    const r = allocate(WEEK.slice(0, 3).map((d) => day(d, [["09:00", "18:00"]])), new Set(), BASE);
    expect(r.total.basic).toBe(0);
    expect(r.countedMinutes).toBe(h(24));
  });

  it("야간도 근무시간에 들어가면서 야간 줄에도 따로 나온다: 야간 18~09시 ×3 = 42시간 → 기본 초과 2, 야간 24", () => {
    // 근무 1회 = 식사 공제 후 14시간(야간 22~06시 8 + 평시 6). 3회 = 42시간 → 기준 40을 2시간 넘음
    const r = allocate([0, 1, 2].map((n) => day(WEEK[n], [["18:00", "09:00"]])), new Set(), BASE);
    expect(r.total).toEqual({ basic: h(2), night: h(24), holiday: 0 });
  });

  it("기준을 넘어도 야간 시간은 줄지 않는다 (겹쳐서 센다): 야간 ×4 = 56시간 → 기본 초과 16, 야간 32", () => {
    const r = allocate([0, 1, 2, 3].map((n) => day(WEEK[n], [["18:00", "09:00"]])), new Set(), BASE);
    expect(r.total).toEqual({ basic: h(16), night: h(32), holiday: 0 });
  });

  it("날짜 순서가 섞여 들어와도 같은 결과", () => {
    const days = [4, 2, 0, 3, 1].map((n) => day(WEEK[n], [["09:00", "18:00"]]));
    days.push(day(WEEK[4], [["19:00", "21:00"]]));
    expect(allocate(days, new Set(), BASE).total.basic).toBe(h(1));
  });

  it("날짜별 기본 초과는 그날 늘어난 초과분이고 합치면 월 합계다", () => {
    const r = allocate([0, 1, 2, 3].map((n) => day(WEEK[n], [["18:00", "09:00"]])), new Set(), BASE);
    // 누적: 14 → 28 → 42(초과 2) → 56(초과 16)
    expect(r.days.map((d) => d.monthAccumulated)).toEqual([h(14), h(28), h(42), h(56)]);
    expect(r.days.map((d) => d.basic)).toEqual([0, 0, h(2), h(14)]);
    expect(r.days.reduce((s, d) => s + d.basic, 0)).toBe(r.total.basic);
    expect(r.days.every((d) => d.monthBase === BASE)).toBe(true);
  });
});

describe("예시: 일반 근무 180시간 + 휴일근무 3일 (월 기준 160시간)", () => {
  it("기본 초과 20시간, 휴일 24시간(3일), 휴일 인정 시간은 기본 계산에서 빠진다", () => {
    // 평일 22일 × 8시간 = 176시간, 추가 근무 19~22시(공제 후 2시간) 2번 → 일반 근무 180시간
    const weekdays = [1, 2, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 26, 27, 28, 29, 30].map(oct);
    expect(weekdays).toHaveLength(22);
    const days = weekdays.map((d) => {
      const extra: [string, string][] = d === oct(29) || d === oct(30) ? [["19:00", "22:00"]] : [];
      return day(d, [["09:00", "18:00"], ...extra]);
    });
    // 휴일근무 3일: 토 3, 일 4, 토 10 — 하루 8시간씩
    for (const d of [3, 4, 10].map(oct)) days.push(day(d, [["09:00", "18:00"]], { restDay: true }));
    const r = allocate(days, new Set(), h(160));
    expect(r.countedMinutes).toBe(h(180));
    expect(r.total).toEqual({ basic: h(20), night: 0, holiday: h(24) });
  });
});

describe("휴가는 8시간으로 센다 (규칙 4)", () => {
  it("월 연가 + 화~금 주간 32시간 = 40시간 → 0, 금 추가 1시간 → 기본 초과 1시간", () => {
    const days = [day(WEEK[0], [], { creditDay: true }), ...WEEK.slice(1, 4).map((d) => day(d, [["09:00", "18:00"]]))];
    days.push(day(WEEK[4], [["09:00", "18:00"], ["19:00", "21:00"]]));
    expect(allocate(days, new Set(), h(40)).total.basic).toBe(h(1));
  });

  it("휴가일은 결과 항목에 아무것도 넣지 않는다 (근무시간 8시간만 더함)", () => {
    const r = allocate([day(WEEK[0], [], { creditDay: true })], new Set(), h(40));
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: 0 });
    expect(r.days[0].monthAccumulated).toBe(h(8));
  });

  it("휴가로 기준을 넘기면 그만큼이 초과가 된다 (기준 8시간, 휴가 8 + 주간 8 = 16 → 초과 8)", () => {
    const r = allocate([day(WEEK[0], [], { creditDay: true }), day(WEEK[1], [["09:00", "18:00"]])], new Set(), h(8));
    expect(r.total.basic).toBe(h(8));
  });
});

describe("휴일 (규칙 6 — 하루 8시간까지, 휴일수당으로 대체)", () => {
  const SAT = oct(17);

  it("토요일 주간 09~18시 → 휴일 8시간, 기본 근무시간에는 안 들어감", () => {
    const r = allocate([day(SAT, [["09:00", "18:00"]], { restDay: true })], new Set(), h(40));
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: h(8) });
    expect(r.countedMinutes).toBe(0);
  });

  it("휴일 인정 시간 안의 야간은 휴일에만 들어간다 (휴일 > 야간)", () => {
    // 토요일 야간 18~09시: 공제 후 14시간. 처음 8시간(18~21시 3 + 22~03시 5)은 휴일, 03~06시 야간 3 + 06~09시 평시 3
    const r = allocate([day(SAT, [["18:00", "09:00"]], { restDay: true })], new Set(), h(40));
    expect(r.total).toEqual({ basic: 0, night: h(3), holiday: h(8) });
    expect(r.countedMinutes).toBe(h(6));
  });

  it("휴일 8시간을 넘은 시간은 평일처럼 근무시간에 들어가 기준을 넘으면 기본 초과", () => {
    // 같은 근무인데 월 기준이 4시간뿐이라면 넘은 6시간 중 2시간이 초과
    const r = allocate([day(SAT, [["18:00", "09:00"]], { restDay: true })], new Set(), h(4));
    expect(r.total).toEqual({ basic: h(2), night: h(3), holiday: h(8) });
  });

  it("평일 40시간을 채운 뒤 토요일 야간 → 휴일 8 + 야간 3 + 기본 초과 6 (넘은 6시간 전부)", () => {
    const days = WEEK.map((d) => day(d, [["09:00", "18:00"]]));
    days.push(day(SAT, [["18:00", "09:00"]], { restDay: true }));
    expect(allocate(days, new Set(), h(40)).total).toEqual({ basic: h(6), night: h(3), holiday: h(8) });
  });
});
