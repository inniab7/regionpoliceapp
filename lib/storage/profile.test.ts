// lib/storage/profile.ts 시험 — 입력값 → Profile, 등록 저장 (첫 등록·[변경]·망가진 데이터)
import { describe, expect, it } from "vitest";
import { createMemoryStore, type KeyValueStore } from "./keyValueStore";
import { FIRST_PROFILE_EFFECTIVE_FROM, buildProfile, registerProfile, type ProfileInput } from "./profile";
import { APP_DATA_KEY, loadData, parseSavedData } from "./store";

const NOW = "2026-10-12T00:00:00.000Z";

const base: ProfileInput = {
  effectiveFrom: FIRST_PROFILE_EFFECTIVE_FROM,
  agency: "  서울경찰청 ",
  department: "지구대·파출소",
  team: " 1팀 ",
  pattern: 2,
  patternStartDate: "2026-10-01",
  shiftTimes: { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } },
};

describe("입력값 → 등록 정보 (buildProfile)", () => {
  it("공백을 정리하고 패턴에 있는 근무 종류만 담는다", () => {
    const p = buildProfile({ ...base, shiftTimes: { ...base.shiftTimes, 심야: { start: "22:00", end: "06:00" } } });
    expect(p.agency).toBe("서울경찰청");
    expect(p.team).toBe("1팀");
    expect(Object.keys(p.shiftTimes)).toEqual(["주간", "야간"]); // 패턴 2에 심야는 없다
  });

  it("패턴 5(일근)는 시작일과 근무 시간을 담지 않는다", () => {
    const p = buildProfile({ ...base, pattern: 5, shiftTimes: { 주간: { start: "09:00", end: "18:00" } } });
    expect(p).not.toHaveProperty("patternStartDate");
    expect(p.shiftTimes).toEqual({});
  });

  it("당직은 종료를 시작과 같게 맞춘다 (24시간 근무)", () => {
    const p = buildProfile({ ...base, pattern: 4, shiftTimes: { 당직: { start: "08:30", end: "18:00" } } });
    expect(p.shiftTimes.당직).toEqual({ start: "08:30", end: "08:30" });
  });

  it("[식사시간 공제] 체크는 평시가 1시간 미만인 근무에만 남긴다", () => {
    const p = buildProfile({
      ...base,
      pattern: 1,
      shiftTimes: {
        주간: { start: "09:00", end: "18:00", mealDeduct: false },
        야간: { start: "18:00", end: "22:00" },
        심야: { start: "22:00", end: "06:00", mealDeduct: false },
      },
    });
    expect(p.shiftTimes.주간).not.toHaveProperty("mealDeduct");
    expect(p.shiftTimes.심야?.mealDeduct).toBe(false);
  });

  it("입력이 비어 있어도 기본 근무시간으로 채운다", () => {
    expect(buildProfile({ ...base, shiftTimes: {} }).shiftTimes.주간).toEqual({ start: "09:00", end: "18:00" });
  });

  it("만든 등록 정보는 저장 데이터 검사를 통과한다", () => {
    const p = buildProfile(base);
    const data = { version: 1, createdAt: NOW, profiles: [p], overrides: {}, holidaysAdded: [], holidaysRemoved: [], otherTeams: [], memos: [], lastBackupAt: null };
    expect(parseSavedData(JSON.parse(JSON.stringify(data)))).not.toBeNull();
  });

  it("시작 시각에 분(10분 단위)이 있어도 저장·불러오기를 통과한다 (예: 주간 08:30, 야간 18:40)", () => {
    const p = buildProfile({ ...base, shiftTimes: { 주간: { start: "08:30", end: "18:00" }, 야간: { start: "18:40", end: "09:00" } } });
    expect(p.shiftTimes.주간?.start).toBe("08:30");
    const data = { version: 1, createdAt: NOW, profiles: [p], overrides: {}, holidaysAdded: [], holidaysRemoved: [], otherTeams: [], memos: [], lastBackupAt: null };
    const back = parseSavedData(JSON.parse(JSON.stringify(data)));
    expect(back?.profiles[0].shiftTimes.야간?.start).toBe("18:40");
  });

  it.each(["지구대·파출소", "형사", "수사", "사고조사", "교통관리", "교통안전", "내근", "기타(기동대 등)"] as const)("부서 %s로 저장·불러오기를 통과한다", (department) => {
    const p = buildProfile({ ...base, department });
    const data = { version: 1, createdAt: NOW, profiles: [p], overrides: {}, holidaysAdded: [], holidaysRemoved: [], otherTeams: [], memos: [], lastBackupAt: null };
    expect(parseSavedData(JSON.parse(JSON.stringify(data)))?.profiles[0].department).toBe(department);
  });

  it("목록에 없는 부서는 저장 데이터 검사에서 거부한다", () => {
    const p = { ...buildProfile(base), department: "경무" };
    const data = { version: 1, createdAt: NOW, profiles: [p], overrides: {}, holidaysAdded: [], holidaysRemoved: [], otherTeams: [], memos: [], lastBackupAt: null };
    expect(parseSavedData(JSON.parse(JSON.stringify(data)))).toBeNull();
  });

  it("10분 단위가 아닌 시작 시각(08:35)은 저장 데이터 검사에서 거부한다", () => {
    const p = buildProfile({ ...base, shiftTimes: { 주간: { start: "08:35", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } } });
    const data = { version: 1, createdAt: NOW, profiles: [p], overrides: {}, holidaysAdded: [], holidaysRemoved: [], otherTeams: [], memos: [], lastBackupAt: null };
    expect(parseSavedData(JSON.parse(JSON.stringify(data)))).toBeNull();
  });
});

describe("등록 저장 (registerProfile)", () => {
  it("처음 등록: 새 데이터를 만들어 저장한다", () => {
    const store = createMemoryStore();
    expect(registerProfile(store, buildProfile(base), NOW)).toBe("ok");
    const loaded = loadData(store);
    expect(loaded.kind).toBe("ok");
    if (loaded.kind === "ok") {
      expect(loaded.data.createdAt).toBe(NOW);
      expect(loaded.data.profiles).toHaveLength(1);
      expect(loaded.data.profiles[0].effectiveFrom).toBe("2000-01-01");
    }
  });

  it("[변경]: 기존 데이터(근무 변경·공휴일)는 그대로 두고 등록 이력만 추가한다", () => {
    const store = createMemoryStore();
    registerProfile(store, buildProfile(base), NOW);
    // 근무 변경 기록을 하나 넣어 둔다
    const first = loadData(store);
    if (first.kind !== "ok") throw new Error();
    store.setItem(APP_DATA_KEY, JSON.stringify({ ...first.data, overrides: { "2026-10-13": { replace: { type: "휴가" } } }, holidaysAdded: ["2026-10-20"] }));

    const change = buildProfile({ ...base, effectiveFrom: "2026-11-01", department: "형사", pattern: 5 });
    expect(registerProfile(store, change, "2026-11-01T00:00:00.000Z")).toBe("ok");

    const after = loadData(store);
    if (after.kind !== "ok") throw new Error();
    expect(after.data.profiles.map((p) => p.effectiveFrom)).toEqual(["2000-01-01", "2026-11-01"]);
    expect(after.data.overrides).toHaveProperty("2026-10-13");
    expect(after.data.holidaysAdded).toEqual(["2026-10-20"]);
    expect(after.data.createdAt).toBe(NOW); // 첫 등록 시각은 바뀌지 않는다
  });

  it("같은 적용일로 다시 등록하면 바꿔 끼운다", () => {
    const store = createMemoryStore();
    registerProfile(store, buildProfile(base), NOW);
    registerProfile(store, buildProfile({ ...base, team: "3팀" }), NOW);
    const after = loadData(store);
    if (after.kind !== "ok") throw new Error();
    expect(after.data.profiles).toHaveLength(1);
    expect(after.data.profiles[0].team).toBe("3팀");
  });

  it("망가진 데이터는 지우지 않고 알린다", () => {
    const store = createMemoryStore({ [APP_DATA_KEY]: "{망가진" });
    expect(registerProfile(store, buildProfile(base), NOW)).toBe("corrupt");
    expect(store.getItem(APP_DATA_KEY)).toBe("{망가진");
  });

  it("사용자가 새로 등록하겠다고 하면(replaceCorrupt) 망가진 데이터를 새 데이터로 바꾼다", () => {
    const store = createMemoryStore({ [APP_DATA_KEY]: "{망가진" });
    expect(registerProfile(store, buildProfile(base), NOW, { replaceCorrupt: true })).toBe("ok");
    expect(loadData(store).kind).toBe("ok");
  });

  it("저장 공간이 꽉 차면 save-failed", () => {
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(registerProfile(full, buildProfile(base), NOW)).toBe("save-failed");
  });
});
