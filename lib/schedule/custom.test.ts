// 직접 만든 패턴(패턴 6) 시험 — 순환 반복, 일근 시간, 저장 검사, 계산이 기존 패턴과 똑같이 나오는지
import { describe, expect, it } from "vitest";
import { profileRows } from "../../components/setup/profileRows";
import { calculateMonth } from "../overtime/monthly";
import { buildProfile } from "../storage/profile";
import { createEmptyData, parseSavedData } from "../storage/store";
import type { CustomCycleKind, Profile, SavedData } from "../types";
import { dayKindFor, plannedDay } from "./generate";
import { hasWorkDay, profileCycle, timedKindsInPattern } from "./patterns";
import { handoverGroups } from "./teams";

const NO_HOLIDAYS = new Set<string>();
const TIMES = { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } };

function custom(cycle: CustomCycleKind[], start = "2026-10-01", shiftTimes: Profile["shiftTimes"] = TIMES): Profile {
  return {
    effectiveFrom: "2000-01-01",
    agency: "서울경찰청",
    department: "형사",
    team: "1팀",
    pattern: 6,
    patternStartDate: start,
    customCycle: cycle,
    shiftTimes,
  };
}

describe("순환 반복 (dayKindFor)", () => {
  const p = custom(["주간", "주간", "휴무", "야간", "비번"]);
  it("시작일부터 만든 순서대로 반복한다", () => {
    const kinds = ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06", "10-07", "10-08"].map((d) => dayKindFor(p, `2026-${d}`, NO_HOLIDAYS));
    expect(kinds).toEqual(["주간", "주간", "휴무", "야간", "비번", "주간", "주간", "휴무"]);
  });
  it("시작일 이전도 거꾸로 이어서 센다", () => {
    expect(dayKindFor(p, "2026-09-30", NO_HOLIDAYS)).toBe("비번");
    expect(dayKindFor(p, "2026-09-26", NO_HOLIDAYS)).toBe("주간"); // 정확히 한 바퀴(5일) 전 = 순환의 첫째 날
  });
  it("토·일·공휴일과 상관없이 만든 순서 그대로다", () => {
    const sat = custom(["일근", "일근", "휴무"], "2026-10-03"); // 10/3(토·개천절)부터
    const holidays = new Set(["2026-10-03", "2026-10-05"]);
    expect(dayKindFor(sat, "2026-10-03", holidays)).toBe("일근");
    expect(dayKindFor(sat, "2026-10-04", holidays)).toBe("일근"); // 일요일
    expect(dayKindFor(sat, "2026-10-05", holidays)).toBe("휴무");
  });
  it("순환이 한 날뿐이어도 계속 반복한다", () => {
    expect(dayKindFor(custom(["일근"]), "2027-03-01", NO_HOLIDAYS)).toBe("일근");
  });
  it("순환이 비어 있는 이상한 등록 정보는 쉬는 날로 본다 (저장할 때 걸러지므로 실제로는 없음)", () => {
    expect(dayKindFor(custom([]), "2026-10-01", NO_HOLIDAYS)).toBe("휴무");
  });
});

describe("근무 시간", () => {
  it("일근은 등록한 시간을 쓰고, 없으면 09:00~18:00", () => {
    const withTime = custom(["일근", "휴무"], "2026-10-01", { 일근: { start: "08:30", end: "17:30" } });
    expect(plannedDay([withTime], "2026-10-01", NO_HOLIDAYS).time).toEqual({ start: "08:30", end: "17:30" });
    const noTime = custom(["일근", "휴무"], "2026-10-01", {});
    expect(plannedDay([noTime], "2026-10-01", NO_HOLIDAYS).time).toEqual({ start: "09:00", end: "18:00" });
  });
  it("패턴 5(일근)는 여전히 09:00~18:00 고정", () => {
    const five: Profile = { ...custom([]), pattern: 5, customCycle: undefined, patternStartDate: undefined, shiftTimes: {} };
    expect(plannedDay([five], "2026-10-01", NO_HOLIDAYS)).toMatchObject({ kind: "일근", time: { start: "09:00", end: "18:00" } });
    expect(plannedDay([five], "2026-10-03", NO_HOLIDAYS).kind).toBe("휴무");
  });
  it("시간을 입력받을 종류는 순환에 든 주간·야간·일근", () => {
    expect(timedKindsInPattern(6, ["야간", "휴무", "주간", "일근", "주간"])).toEqual(["주간", "야간", "일근"]);
    expect(timedKindsInPattern(6, ["야간", "비번"])).toEqual(["야간"]);
    expect(timedKindsInPattern(2)).toEqual(["주간", "야간"]); // 기존 패턴은 그대로
  });
});

describe("계산 결과가 기존 패턴과 똑같다", () => {
  const holidays = new Set(["2026-10-03", "2026-10-05", "2026-10-09"]);
  const pattern2: Profile = { ...custom([]), pattern: 2, customCycle: undefined };

  it("패턴 2와 같은 순환(주간·야간·비번·휴무)을 직접 만들면 한 달 결과가 같다", () => {
    const mine = custom(["주간", "야간", "비번", "휴무"]);
    for (const month of [9, 10, 11]) {
      const a = calculateMonth({ profiles: [pattern2], overrides: {}, holidays, year: 2026, month });
      const b = calculateMonth({ profiles: [mine], overrides: {}, holidays, year: 2026, month });
      expect(b.total).toEqual(a.total);
      expect(b.days.map((d) => d.plannedKind)).toEqual(a.days.map((d) => d.plannedKind));
    }
  });

  it("10월 결과가 손계산(기본 초과 3 · 야간 54 · 휴일 48 · 합계 105시간)과 같다", () => {
    const r = calculateMonth({ profiles: [custom(["주간", "야간", "비번", "휴무"])], overrides: {}, holidays, year: 2026, month: 10 });
    expect(r.total).toMatchObject({ basic: 3 * 60, night: 54 * 60, holiday: 48 * 60, sum: 105 * 60 });
  });

  it("일근을 섞은 순환도 근무일은 주 누적에 8시간씩 반영된다 (평일 일근 5일 + 주말 휴무 = 초과 0)", () => {
    // 월~금 일근, 토·일 휴무 순환을 월요일(10/5가 공휴일이라 10/12)부터
    const mine = custom(["일근", "일근", "일근", "일근", "일근", "휴무", "휴무"], "2026-10-12", { 일근: { start: "09:00", end: "18:00" } });
    const r = calculateMonth({ profiles: [mine], overrides: {}, holidays: NO_HOLIDAYS, year: 2026, month: 10 });
    // 10/12~10/30 중 일근 날의 시간: 하루 식사 공제 후 8시간 → 주 40시간 이내라 기본 초과 0, 야간 0, 휴일 0
    expect(r.total).toMatchObject({ basic: 0, night: 0, holiday: 0, sum: 0 });
  });
});

describe("다른 팀 표시와 요약", () => {
  it("직접 만든 패턴도 다른 팀의 근무를 계산한다", () => {
    const mine = custom(["주간", "야간", "비번", "휴무"]);
    const g = handoverGroups([mine], [{ teamNo: "2팀", patternStartDate: "2026-09-30" }], "2026-10-01", NO_HOLIDAYS);
    expect(g).toEqual([{ label: "오늘 야간에 들어오는 팀", teamNos: ["2팀"] }]);
  });
  it("등록 요약에 반복 일수와 순환이 나온다", () => {
    const rows = Object.fromEntries(profileRows(custom(["주간", "야간", "비번", "휴무"])));
    expect(rows["근무 형태"]).toBe("패턴 6 (직접 만들기) (4일 반복: 주간 → 야간 → 비번 → 휴무)");
  });
  it("profileCycle: 일근(5)은 순환 없음, 6은 만든 순환, 나머지는 기존 순환", () => {
    expect(profileCycle({ pattern: 5 })).toBeNull();
    expect(profileCycle({ pattern: 6, customCycle: ["주간", "휴무"] })).toEqual(["주간", "휴무"]);
    expect(profileCycle({ pattern: 6, customCycle: [] })).toBeNull();
    expect(profileCycle({ pattern: 4 })).toEqual(["당직", "휴무", "비번"]);
  });
  it("hasWorkDay", () => {
    expect(hasWorkDay(["휴무", "비번"])).toBe(false);
    expect(hasWorkDay(["휴무", "일근"])).toBe(true);
  });
});

describe("등록 정보 만들기·저장 검사", () => {
  const input = { effectiveFrom: "2000-01-01", agency: "서울경찰청", department: "형사" as const, team: "1팀", pattern: 6 as const, patternStartDate: "2026-10-01" };
  const wrap = (profile: unknown): unknown => ({ ...createEmptyData("2026-10-12T00:00:00.000Z"), profiles: [profile] });
  const parse = (profile: unknown): SavedData | null => parseSavedData(JSON.parse(JSON.stringify(wrap(profile))));

  it("buildProfile: 순환을 담고, 순환에 든 근무 종류의 시간만 담는다 (일근은 기본 09:00~18:00)", () => {
    const p = buildProfile({ ...input, customCycle: ["일근", "주간", "휴무"], shiftTimes: { 주간: { start: "07:30", end: "16:30" }, 야간: { start: "18:00", end: "09:00" } } });
    expect(p.customCycle).toEqual(["일근", "주간", "휴무"]);
    expect(Object.keys(p.shiftTimes)).toEqual(["주간", "일근"]);
    expect(p.shiftTimes.일근).toEqual({ start: "09:00", end: "18:00" });
    expect(p.shiftTimes.주간).toEqual({ start: "07:30", end: "16:30" });
  });
  it("다른 패턴에서는 customCycle을 담지 않는다", () => {
    const p = buildProfile({ ...input, pattern: 2, customCycle: ["주간", "휴무"], shiftTimes: TIMES });
    expect(p).not.toHaveProperty("customCycle");
  });
  it("저장 → 불러오기를 통과한다", () => {
    const p = buildProfile({ ...input, customCycle: ["주간", "야간", "비번", "휴무"], shiftTimes: TIMES });
    const back = parse(p);
    expect(back?.profiles[0].customCycle).toEqual(["주간", "야간", "비번", "휴무"]);
  });
  it.each([
    ["순환이 없음", { customCycle: undefined }],
    ["순환이 비어 있음", { customCycle: [] }],
    ["근무하는 날이 없음", { customCycle: ["휴무", "비번"] }],
    ["고를 수 없는 종류(심야)", { customCycle: ["주간", "심야"] }],
    ["고를 수 없는 종류(당직)", { customCycle: ["당직", "휴무"] }],
    ["31일 초과", { customCycle: Array(32).fill("주간") }],
    ["시작일 없음", { customCycle: ["주간", "휴무"], patternStartDate: undefined }],
  ])("거부: %s", (_, patch) => {
    const base = buildProfile({ ...input, customCycle: ["주간", "휴무"], shiftTimes: TIMES });
    expect(parse({ ...base, ...patch })).toBeNull();
  });
  it("패턴 2에 customCycle이 붙어 있으면 거부", () => {
    const base = buildProfile({ ...input, pattern: 2, shiftTimes: TIMES });
    expect(parse({ ...base, customCycle: ["주간"] })).toBeNull();
  });
  it("31일 순환은 허용", () => {
    const base = buildProfile({ ...input, customCycle: [...Array(30).fill("휴무"), "주간"], shiftTimes: TIMES });
    expect(parse(base)).not.toBeNull();
  });
});
