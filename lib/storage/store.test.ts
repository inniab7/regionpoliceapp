// lib/storage/store.ts 시험 — 저장·불러오기·모양 검사·등록 이력·근무 변경
import { describe, expect, it } from "vitest";
import type { Profile, SavedData } from "../types";
import { createMemoryStore, type KeyValueStore } from "./keyValueStore";
import {
  APP_DATA_KEY,
  addProfile,
  createEmptyData,
  loadData,
  parseSavedData,
  profileOn,
  saveData,
  setDayEntry,
} from "./store";

const NOW = "2026-10-12T00:00:00.000Z";

const patrol: Profile = {
  effectiveFrom: "2026-10-01",
  agency: "서울청",
  department: "지구대·파출소",
  team: "1팀",
  pattern: 2,
  patternStartDate: "2026-10-01",
  shiftTimes: { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } },
};

const detective: Profile = {
  effectiveFrom: "2026-11-01",
  agency: "서울청",
  department: "형사",
  team: "2팀",
  pattern: 5,
  shiftTimes: {},
};

function sampleData(): SavedData {
  let data = createEmptyData(NOW);
  data = addProfile(data, patrol);
  data = setDayEntry(data, "2026-10-13", { replace: { type: "휴가" } });
  data = setDayEntry(data, "2026-10-14", { extra: { start: "19:00", end: "21:00" } });
  return { ...data, holidaysAdded: ["2026-10-20"] };
}

describe("저장과 불러오기", () => {
  it("아무것도 없으면 empty", () => {
    expect(loadData(createMemoryStore())).toEqual({ kind: "empty" });
  });

  it("저장한 그대로 다시 불러온다", () => {
    const store = createMemoryStore();
    const data = sampleData();
    expect(saveData(store, data)).toBe(true);
    expect(loadData(store)).toEqual({ kind: "ok", data });
  });

  it("JSON이 망가졌으면 corrupt (자동으로 지우지 않는다)", () => {
    const store = createMemoryStore({ [APP_DATA_KEY]: "{망가진" });
    expect(loadData(store)).toEqual({ kind: "corrupt" });
    expect(store.getItem(APP_DATA_KEY)).toBe("{망가진");
  });

  it("저장 공간이 꽉 차면 false", () => {
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(saveData(full, sampleData())).toBe(false);
  });

  it("저장소를 읽을 수 없으면 corrupt", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadData(broken)).toEqual({ kind: "corrupt" });
  });
});

describe("모양 검사 (백업 불러오기에서도 사용)", () => {
  it("올바른 데이터는 통과", () => {
    const data = sampleData();
    expect(parseSavedData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it("당직은 종료 = 시작(24시간)이면 통과", () => {
    const duty = { ...patrol, pattern: 4 as const, shiftTimes: { 당직: { start: "08:30", end: "08:30" } } };
    const data = { ...sampleData(), profiles: [duty] };
    expect(parseSavedData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it("모르는 항목은 버린다", () => {
    const withExtra = { ...sampleData(), hacked: "x" };
    expect(parseSavedData(withExtra)).not.toHaveProperty("hacked");
  });

  it.each([
    ["버전이 다름", { version: 2 }],
    ["없는 부서", { profiles: [{ ...patrol, department: "경무" }] }],
    ["없는 패턴", { profiles: [{ ...patrol, pattern: 6 }] }],
    ["패턴 1~4인데 시작일 없음", { profiles: [{ ...patrol, patternStartDate: undefined }] }],
    ["10분 단위가 아닌 시각", { profiles: [{ ...patrol, shiftTimes: { 주간: { start: "09:15", end: "18:00" } } }] }],
    ["당직 종료가 시작과 다름(24시간이 아님)", { profiles: [{ ...patrol, shiftTimes: { 당직: { start: "09:00", end: "18:00" } } }] }],
    ["없는 날짜의 변경", { overrides: { "2026-02-30": { replace: { type: "휴가" } } } }],
    ["시간 없는 교육·출장", { overrides: { "2026-10-13": { replace: { type: "교육출장" } } } }],
    ["잘못된 공휴일", { holidaysAdded: ["어제"] }],
    ["백업 시각이 날짜가 아님", { lastBackupAt: "언젠가" }],
  ])("%s → 거부", (_, patch) => {
    expect(parseSavedData({ ...sampleData(), ...patch })).toBeNull();
  });

  it("객체가 아니면 거부", () => {
    expect(parseSavedData(null)).toBeNull();
    expect(parseSavedData([])).toBeNull();
    expect(parseSavedData("데이터")).toBeNull();
  });
});

describe("등록 이력 (규칙 16 — 적용일)", () => {
  it("날짜마다 그때 적용되는 등록 정보를 고른다", () => {
    const data = addProfile(addProfile(createEmptyData(NOW), patrol), detective);
    expect(profileOn(data, "2026-09-30")).toBeNull();
    expect(profileOn(data, "2026-10-15")?.department).toBe("지구대·파출소");
    expect(profileOn(data, "2026-11-01")?.department).toBe("형사");
  });

  it("같은 적용일로 다시 등록하면 바꿔 끼운다", () => {
    const fixed = { ...patrol, team: "3팀" };
    const data = addProfile(addProfile(createEmptyData(NOW), patrol), fixed);
    expect(data.profiles).toHaveLength(1);
    expect(data.profiles[0].team).toBe("3팀");
  });

  it("원래 데이터는 바꾸지 않는다", () => {
    const before = createEmptyData(NOW);
    addProfile(before, patrol);
    expect(before.profiles).toHaveLength(0);
  });
});

describe("근무 변경 기록", () => {
  it("빈 기록을 넣으면 그날 변경을 지운다 ([원래대로])", () => {
    const data = setDayEntry(sampleData(), "2026-10-13", {});
    expect(data.overrides).not.toHaveProperty("2026-10-13");
  });

  it("휴가와 추가 근무를 함께 둘 수 있다", () => {
    const entry = { replace: { type: "휴가" as const }, extra: { start: "19:00", end: "21:00" } };
    expect(setDayEntry(createEmptyData(NOW), "2026-10-13", entry).overrides["2026-10-13"]).toEqual(entry);
  });
});
