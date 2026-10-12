// lib/storage/aiKey.ts 시험 — AI 키는 앱 데이터와 따로 저장, [연결 끊기], 끝 4자리만 표시
import { describe, expect, it } from "vitest";
import type { AiConnection } from "../types";
import { AI_CONNECTION_KEY, clearAiConnection, loadAiConnection, maskApiKey, saveAiConnection } from "./aiKey";
import { createMemoryStore } from "./keyValueStore";
import { APP_DATA_KEY, createEmptyData, saveData } from "./store";

// 진짜 키가 아닌 시험용 가짜 값
const conn: AiConnection = { provider: "claude", apiKey: "test-key-0000a1b2", verifiedAt: "2026-10-12T00:00:00.000Z" };

describe("AI 연결 정보", () => {
  it("저장하고 다시 불러온다", () => {
    const store = createMemoryStore();
    expect(saveAiConnection(store, conn)).toBe(true);
    expect(loadAiConnection(store)).toEqual(conn);
  });

  it("앱 데이터와 다른 키에 저장해, 앱 데이터(백업 대상)에 섞이지 않는다", () => {
    const store = createMemoryStore();
    saveData(store, createEmptyData("2026-10-12T00:00:00.000Z"));
    saveAiConnection(store, conn);
    expect(AI_CONNECTION_KEY).not.toBe(APP_DATA_KEY);
    expect(store.getItem(APP_DATA_KEY)).not.toContain(conn.apiKey);
  });

  it("[연결 끊기]는 키를 바로 지운다", () => {
    const store = createMemoryStore();
    saveAiConnection(store, conn);
    clearAiConnection(store);
    expect(store.getItem(AI_CONNECTION_KEY)).toBeNull();
    expect(loadAiConnection(store)).toBeNull();
  });

  it("앞뒤 공백은 지우고 저장한다", () => {
    const store = createMemoryStore();
    saveAiConnection(store, { ...conn, apiKey: `  ${conn.apiKey}\n` });
    expect(loadAiConnection(store)?.apiKey).toBe(conn.apiKey);
  });

  it.each([
    ["망가진 JSON", "{"],
    ["없는 AI", JSON.stringify({ ...conn, provider: "copilot" })],
    ["빈 키", JSON.stringify({ ...conn, apiKey: "   " })],
  ])("%s → null", (_, raw) => {
    expect(loadAiConnection(createMemoryStore({ [AI_CONNECTION_KEY]: raw }))).toBeNull();
  });
});

describe("키 가리기", () => {
  it("끝 4자리만 보여 준다", () => {
    expect(maskApiKey(conn.apiKey)).toBe("…a1b2");
    expect(maskApiKey(conn.apiKey)).not.toContain("test-key");
  });

  it("너무 짧은 키는 아예 보여 주지 않는다", () => {
    expect(maskApiKey("abcd")).toBe("…");
  });
});
