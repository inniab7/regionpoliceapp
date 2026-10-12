// lib/overtime/allocate.ts 시험 — 주 40시간 누적과 휴일 > 야간 > 기본 초과 배분
import { describe, expect, it } from "vitest";
import { addDays } from "../time";
import { allocate, type DayWork } from "./allocate";
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

// 2026-10-04(일) ~ 10-10(토) 한 주
const SUN = "2026-10-04";
const d = (n: number) => addDays(SUN, n); // 0=일 1=월 … 6=토

describe("주 40시간 (규칙 4)", () => {
  it("월~금 주간 09~18시(하루 8시간) = 40시간 → 기본 초과 0", () => {
    const r = allocate([1, 2, 3, 4, 5].map((n) => day(d(n), [["09:00", "18:00"]])));
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: 0, sum: 0 });
    expect(r.days.at(-1)!.weekAccumulated).toBe(h(40));
  });

  it("40시간을 넘은 평시만 기본 초과: 금요일 추가 근무 19~21시(공제 후 1시간) → 1시간", () => {
    const days = [1, 2, 3, 4].map((n) => day(d(n), [["09:00", "18:00"]]));
    days.push(day(d(5), [["09:00", "18:00"], ["19:00", "21:00"]]));
    expect(allocate(days).total).toEqual({ basic: h(1), night: 0, holiday: 0, sum: h(1) });
  });

  it("야간도 주 누적에 들어간다: 야간 18~09시 ×3 = 42시간 → 야간 24시간 + 기본 초과 2시간", () => {
    // 근무 1회 = 식사 공제 후 14시간(야간 8 + 평시 6). 셋째 근무 06~07시에 40시간이 차고 07~09시가 기본 초과
    const r = allocate([1, 2, 3].map((n) => day(d(n), [["18:00", "09:00"]])));
    expect(r.total).toEqual({ basic: h(2), night: h(24), holiday: 0, sum: h(26) });
  });

  it("40시간을 넘어도 야간 칸은 야간에만 들어간다 (기본 초과에 중복 없음, 규칙 7)", () => {
    const r = allocate([1, 2, 3, 4].map((n) => day(d(n), [["18:00", "09:00"]])));
    // 56시간 근무: 야간 32시간 + 40시간 넘은 평시
    expect(r.total.night).toBe(h(32));
    expect(r.total.sum).toBe(r.total.basic + r.total.night + r.total.holiday);
  });
});

describe("휴가·당직은 주 누적에 8시간만 (규칙 4·12)", () => {
  it("월 연가 + 화~금 주간 32시간 = 40시간 → 0, 금 추가 1시간 → 기본 초과 1시간", () => {
    const days = [day(d(1), [], { creditDay: true }), ...[2, 3, 4].map((n) => day(d(n), [["09:00", "18:00"]]))];
    days.push(day(d(5), [["09:00", "18:00"], ["19:00", "21:00"]]));
    expect(allocate(days).total.basic).toBe(h(1));
  });

  it("당직일은 결과 4줄에 아무것도 넣지 않는다", () => {
    const r = allocate([day(d(1), [], { creditDay: true })]);
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: 0, sum: 0 });
    expect(r.days[0].weekAccumulated).toBe(h(8));
  });
});

describe("휴일 (규칙 6 — 하루 8시간까지)", () => {
  it("토요일 주간 09~18시 → 휴일 8시간, 주 누적에는 안 들어감", () => {
    const r = allocate([day(d(6), [["09:00", "18:00"]], { restDay: true })]);
    expect(r.total).toEqual({ basic: 0, night: 0, holiday: h(8), sum: h(8) });
    expect(r.days[0].weekAccumulated).toBe(0);
  });

  it("토요일 야간 18~09시 → 휴일 8 + 야간 3, 평시 3시간은 주 누적에", () => {
    const r = allocate([day(d(6), [["18:00", "09:00"]], { restDay: true })]);
    expect(r.total).toEqual({ basic: 0, night: h(3), holiday: h(8), sum: h(11) });
    expect(r.days[0].weekAccumulated).toBe(h(6)); // 넘은 6시간(야간 3 + 평시 3)
  });

  it("주중 40시간을 채운 뒤 토요일 야간 → 휴일 8 + 야간 3 + 기본 초과 3", () => {
    const days = [1, 2, 3, 4, 5].map((n) => day(d(n), [["09:00", "18:00"]]));
    days.push(day(d(6), [["18:00", "09:00"]], { restDay: true }));
    expect(allocate(days).total).toEqual({ basic: h(3), night: h(3), holiday: h(8), sum: h(14) });
  });
});

describe("주와 달의 경계 (규칙 8)", () => {
  it("일요일이 되면 주 누적을 새로 센다", () => {
    const sat = "2026-10-10";
    const sun = "2026-10-11";
    const r = allocate([day(sat, [["09:00", "09:00"]]), day(sun, [["09:00", "09:00"]])]);
    expect(r.days[1].weekAccumulated).toBe(h(23)); // 토요일 23시간은 이어지지 않음
  });

  it("달을 걸친 주는 1일부터 새로: 10/1(목)·10/2(금) 24시간 근무 → 46시간", () => {
    // 24시간 근무 = 공제 후 23시간(평시 09~16:30·17:30~22시 12시간, 야간 8시간, 평시 06~09시 3시간)
    // 둘째 날: 23 + 12 = 35시간 → 야간 중 03시에 40시간을 넘김 → 넘은 야간 3시간은 야간에만,
    // 이어지는 평시 06~09시 3시간이 기본 초과
    const r = allocate([day("2026-10-01", [["09:00", "09:00"]]), day("2026-10-02", [["09:00", "09:00"]])]);
    expect(r.days[1].weekAccumulated).toBe(h(46));
    expect(r.total.night).toBe(h(16));
    expect(r.total.basic).toBe(h(3));
  });

  it("날짜 순서가 섞여 들어와도 날짜 순으로 계산한다", () => {
    const days = [5, 3, 1, 4, 2].map((n) => day(d(n), [["09:00", "18:00"]]));
    days.push(day(d(5), [["19:00", "21:00"]]));
    expect(allocate(days).total.basic).toBe(h(1));
  });
});
