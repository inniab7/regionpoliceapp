// lib/storage/backup.ts 시험 — 백업 파일 만들기·검사·불러오기, AI 키 제외, 6개월 안내
import { describe, expect, it } from "vitest";
import type { AiConnection, Profile } from "../types";
import { saveAiConnection } from "./aiKey";
import {
  createBackup,
  lastBackupDate,
  parseBackup,
  restoreBackup,
  shouldRemindBackup,
  summarizeBackup,
} from "./backup";
import { createMemoryStore, type KeyValueStore } from "./keyValueStore";
import { addProfile, createEmptyData, loadData, saveData, setDayEntry } from "./store";

const NOW = new Date("2026-10-12T03:00:00.000Z"); // 한국 시간 2026-10-12 12:00

const profile: Profile = {
  effectiveFrom: "2000-01-01",
  agency: "서울청",
  department: "형사",
  team: "2팀",
  pattern: 2,
  patternStartDate: "2026-10-01",
  shiftTimes: { 주간: { start: "09:00", end: "18:00" }, 야간: { start: "18:00", end: "09:00" } },
};

function sample() {
  let data = createEmptyData("2026-03-01T00:00:00.000Z");
  data = addProfile(data, profile);
  data = setDayEntry(data, "2026-10-13", { replace: { type: "휴가" } });
  data = setDayEntry(data, "2026-10-14", { extra: { start: "19:00", end: "21:00" } });
  return { ...data, holidaysAdded: ["2026-10-20"], holidaysRemoved: ["2026-10-09"] };
}

describe("백업 파일 만들기", () => {
  it("파일 이름에 한국 날짜가 들어간다", () => {
    expect(createBackup(sample(), NOW).fileName).toBe("현답-백업-2026-10-12.json");
  });

  it("파일 안의 마지막 백업 시각은 만든 시각이다", () => {
    const { content, savedAt } = createBackup(sample(), NOW);
    expect(savedAt).toBe("2026-10-12T03:00:00.000Z");
    expect(JSON.parse(content).data.lastBackupAt).toBe(savedAt);
  });

  it("원래 데이터는 바꾸지 않는다", () => {
    const data = sample();
    createBackup(data, NOW);
    expect(data.lastBackupAt).toBeNull();
  });

  it("AI 키는 백업 파일에 들어가지 않는다 (PRD 7장 ②)", () => {
    const store = createMemoryStore();
    saveData(store, sample());
    const conn: AiConnection = { provider: "claude", apiKey: "test-secret-key-9876", verifiedAt: NOW.toISOString() };
    saveAiConnection(store, conn);
    const loaded = loadData(store);
    if (loaded.kind !== "ok") throw new Error();
    const { content } = createBackup(loaded.data, NOW);
    expect(content).not.toContain("test-secret-key-9876");
    expect(content).not.toContain("apiKey");
    expect(content).not.toContain("hyeondap:ai");
  });
});

describe("백업 파일 읽기 (parseBackup)", () => {
  it("만든 파일을 그대로 다시 읽을 수 있다", () => {
    const data = sample();
    const { content } = createBackup(data, NOW);
    const r = parseBackup(content);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.data).toEqual({ ...data, lastBackupAt: "2026-10-12T03:00:00.000Z" });
  });

  it.each([
    ["JSON이 아님", "안녕하세요"],
    ["빈 파일", ""],
    ["배열", "[]"],
    ["다른 앱의 파일", JSON.stringify({ app: "다른앱", kind: "backup", formatVersion: 1, data: {} })],
    ["백업이 아닌 파일", JSON.stringify({ app: "현답", kind: "export", formatVersion: 1, data: {} })],
  ])("%s → 백업 파일이 아니라고 안내", (_, text) => {
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("백업 파일이 아니에요");
  });

  it("알 수 없는 버전은 불러오지 않는다", () => {
    const file = JSON.parse(createBackup(sample(), NOW).content);
    file.formatVersion = 2;
    const r = parseBackup(JSON.stringify(file));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("버전");
  });

  it("내용이 잘못되었으면(없는 부서) 불러오지 않고 지금 정보는 그대로라고 안내", () => {
    const file = JSON.parse(createBackup(sample(), NOW).content);
    file.data.profiles[0].department = "경무";
    const r = parseBackup(JSON.stringify(file));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("지금 정보는 그대로");
  });

  it("10분 단위가 아닌 시각이 섞인 파일은 거부", () => {
    const file = JSON.parse(createBackup(sample(), NOW).content);
    file.data.overrides["2026-10-14"].extra.start = "19:05";
    expect(parseBackup(JSON.stringify(file)).ok).toBe(false);
  });
});

describe("불러오기 요약", () => {
  it("등록 정보·근무 변경·공휴일 변경 개수를 보여 준다", () => {
    const { content } = createBackup(sample(), NOW);
    const r = parseBackup(content);
    if (!r.ok) throw new Error();
    expect(summarizeBackup(r.file)).toEqual(["등록 정보 1건", "근무 변경 2일", "공휴일 변경 2건"]);
  });
});

describe("불러와서 바꾸기 (restoreBackup)", () => {
  it("새 기기(빈 저장소)에 그대로 되살린다", () => {
    const r = parseBackup(createBackup(sample(), NOW).content);
    if (!r.ok) throw new Error();
    const store = createMemoryStore();
    expect(restoreBackup(store, r.file)).toBe("ok");
    const loaded = loadData(store);
    expect(loaded.kind === "ok" && loaded.data.profiles).toHaveLength(1);
    expect(loaded.kind === "ok" && Object.keys(loaded.data.overrides)).toEqual(["2026-10-13", "2026-10-14"]);
  });

  it("이미 있는 정보는 백업 내용으로 통째로 바뀌고, AI 연결 정보는 그대로 남는다", () => {
    const store = createMemoryStore();
    saveData(store, { ...createEmptyData("2026-01-01T00:00:00.000Z"), holidaysAdded: ["2026-12-24"] });
    const conn: AiConnection = { provider: "gemini", apiKey: "test-key-aaaa1111", verifiedAt: NOW.toISOString() };
    saveAiConnection(store, conn);

    const r = parseBackup(createBackup(sample(), NOW).content);
    if (!r.ok) throw new Error();
    restoreBackup(store, r.file);

    const loaded = loadData(store);
    expect(loaded.kind === "ok" && loaded.data.holidaysAdded).toEqual(["2026-10-20"]); // 옛 값은 사라짐
    expect(store.getItem("hyeondap:ai")).toContain("test-key-aaaa1111"); // AI 키는 그대로
  });

  it("저장 공간이 꽉 차면 save-failed", () => {
    const r = parseBackup(createBackup(sample(), NOW).content);
    if (!r.ok) throw new Error();
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(restoreBackup(full, r.file)).toBe("save-failed");
  });
});

describe("6개월 안내 (마지막 백업, 없으면 첫 등록 기준)", () => {
  const at = (createdAt: string, lastBackupAt: string | null) => ({ ...createEmptyData(createdAt), lastBackupAt });

  it("백업한 적 없고 첫 등록 후 6개월이 지나면 안내", () => {
    expect(shouldRemindBackup(at("2026-04-12T03:00:00.000Z", null), NOW)).toBe(true);
  });

  it("5개월 29일이면 아직 안내하지 않는다", () => {
    expect(shouldRemindBackup(at("2026-04-13T03:00:00.000Z", null), NOW)).toBe(false);
  });

  it("마지막 백업이 있으면 그 날짜가 기준이다 (첫 등록이 오래돼도)", () => {
    expect(shouldRemindBackup(at("2025-01-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"), NOW)).toBe(false);
    expect(shouldRemindBackup(at("2025-01-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z"), NOW)).toBe(true);
  });

  it("방금 백업했으면 안내하지 않는다", () => {
    expect(shouldRemindBackup(at("2025-01-01T00:00:00.000Z", NOW.toISOString()), NOW)).toBe(false);
  });

  it("날짜가 망가졌으면 안내하지 않는다 (잘못 띄우지 않기)", () => {
    expect(shouldRemindBackup({ ...createEmptyData("언젠가"), lastBackupAt: null }, NOW)).toBe(false);
  });
});

describe("마지막 백업 날짜 표시", () => {
  it("한국 날짜로 보여 주고, 한 번도 안 했으면 null", () => {
    expect(lastBackupDate({ ...createEmptyData("2026-01-01T00:00:00.000Z"), lastBackupAt: "2026-10-12T15:30:00.000Z" })).toBe("2026-10-13");
    expect(lastBackupDate(createEmptyData("2026-01-01T00:00:00.000Z"))).toBeNull();
  });
});
