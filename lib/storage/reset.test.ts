// lib/storage/reset.ts 시험 — 초기화하면 앱 데이터와 AI 연결이 모두 사라지고, 다른 값은 그대로 남는다
import { describe, expect, it } from "vitest";
import type { AiConnection, Profile } from "../types";
import { saveAiConnection, loadAiConnection } from "./aiKey";
import { createMemoryStore, type KeyValueStore } from "./keyValueStore";
import { RESET_KEYS, resetAllData } from "./reset";
import { addProfile, createEmptyData, loadData, saveData } from "./store";

const profile: Profile = {
  effectiveFrom: "2000-01-01",
  agency: "서울청",
  department: "지구대·파출소",
  team: "1팀",
  pattern: 2,
  patternStartDate: "2026-10-01",
  shiftTimes: { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } },
};
const conn: AiConnection = { provider: "claude", apiKey: "test-key-9999", verifiedAt: "2026-10-12T00:00:00.000Z" };

function filled(): KeyValueStore {
  const store = createMemoryStore({ "다른앱:값": "그대로" });
  saveData(store, addProfile(createEmptyData("2026-10-01T00:00:00.000Z"), profile));
  saveAiConnection(store, conn);
  return store;
}

describe("초기화 (resetAllData)", () => {
  it("앱 데이터와 AI 연결(키 포함)을 모두 지운다 → 처음 설치한 상태", () => {
    const store = filled();
    expect(loadData(store).kind).toBe("ok");
    expect(loadAiConnection(store)).not.toBeNull();

    expect(resetAllData(store)).toBe("ok");

    expect(loadData(store).kind).toBe("empty"); // 등록한 적 없는 상태
    expect(loadAiConnection(store)).toBeNull();
    for (const key of RESET_KEYS) expect(store.getItem(key)).toBeNull();
  });

  it("이 앱과 상관없는 저장 값은 건드리지 않는다", () => {
    const store = filled();
    resetAllData(store);
    expect(store.getItem("다른앱:값")).toBe("그대로");
  });

  it("이미 비어 있어도 문제없이 성공한다 (두 번 눌러도 안전)", () => {
    const store = createMemoryStore();
    expect(resetAllData(store)).toBe("ok");
    expect(resetAllData(store)).toBe("ok");
  });

  it("망가진 데이터도 지운다 (새로 시작하는 방법)", () => {
    const store = createMemoryStore({ "hyeondap:v1": "{깨진 json", "hyeondap:ai": "???" });
    expect(resetAllData(store)).toBe("ok");
    expect(loadData(store).kind).toBe("empty");
  });

  it("저장소가 지우기를 막으면 failed로 알린다", () => {
    const blocked: KeyValueStore = {
      getItem: () => "남아 있음",
      setItem: () => {},
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(resetAllData(blocked)).toBe("failed");
  });

  it("지웠다고 하는데 값이 남아 있으면 failed로 알린다", () => {
    const stubborn: KeyValueStore = { getItem: () => "그대로 남음", setItem: () => {}, removeItem: () => {} };
    expect(resetAllData(stubborn)).toBe("failed");
  });
});
