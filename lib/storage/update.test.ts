// lib/storage/update.ts 시험 — 저장된 데이터의 일부만 바꿔 다시 저장
import { describe, expect, it } from "vitest";
import { addHoliday } from "../holidays/edit";
import { createMemoryStore, type KeyValueStore } from "./keyValueStore";
import { APP_DATA_KEY, createEmptyData, loadData, saveData } from "./store";
import { updateData } from "./update";

const NOW = "2026-10-12T00:00:00.000Z";

describe("updateData", () => {
  it("저장된 데이터를 바꿔 다시 저장한다", () => {
    const store = createMemoryStore();
    saveData(store, createEmptyData(NOW));
    expect(updateData(store, (d) => addHoliday(d, "2026-10-20").data)).toBe("ok");
    const after = loadData(store);
    expect(after.kind === "ok" && after.data.holidaysAdded).toEqual(["2026-10-20"]);
  });

  it("등록 정보 같은 다른 내용은 그대로 둔다", () => {
    const store = createMemoryStore();
    saveData(store, { ...createEmptyData(NOW), memos: [{ id: "1", createdAt: NOW, text: "메모" }] });
    updateData(store, (d) => addHoliday(d, "2026-10-20").data);
    const after = loadData(store);
    expect(after.kind === "ok" && after.data.memos).toHaveLength(1);
  });

  it("아직 저장된 데이터가 없으면 empty (새로 만들지 않는다)", () => {
    expect(updateData(createMemoryStore(), (d) => d)).toBe("empty");
  });

  it("망가진 데이터는 지우지 않고 corrupt", () => {
    const store = createMemoryStore({ [APP_DATA_KEY]: "{망가진" });
    expect(updateData(store, (d) => addHoliday(d, "2026-10-20").data)).toBe("corrupt");
    expect(store.getItem(APP_DATA_KEY)).toBe("{망가진");
  });

  it("바뀐 게 없으면(같은 데이터를 돌려주면) 다시 저장하지 않는다", () => {
    const store = createMemoryStore();
    saveData(store, createEmptyData(NOW));
    let writes = 0;
    const counting: KeyValueStore = {
      getItem: (k) => store.getItem(k),
      setItem: (k, v) => {
        writes++;
        store.setItem(k, v);
      },
      removeItem: (k) => store.removeItem(k),
    };
    expect(updateData(counting, (d) => d)).toBe("ok");
    expect(writes).toBe(0);
  });

  it("저장 공간이 꽉 차면 save-failed", () => {
    const base = createMemoryStore();
    saveData(base, createEmptyData(NOW));
    const full: KeyValueStore = {
      getItem: (k) => base.getItem(k),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(updateData(full, (d) => addHoliday(d, "2026-10-20").data)).toBe("save-failed");
  });
});
