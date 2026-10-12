// Design Ref: §6.1 — 저장된 앱 데이터를 읽어 일부만 바꿔 다시 저장한다 (공휴일 편집, 근무 변경 등이 함께 쓴다)
// Plan: 작업 21 — 공휴일 편집. 저장소는 호출하는 쪽에서 넘긴다 (시험에서는 메모리 저장소).
import type { SavedData } from "../types";
import type { KeyValueStore } from "./keyValueStore";
import { loadData, saveData } from "./store";

/** 저장 결과 */
export type UpdateResult =
  | "ok"
  | "empty" // 아직 등록한 적이 없어 바꿀 데이터가 없음
  | "corrupt" // 저장된 내용을 읽을 수 없음 (지우지 않는다)
  | "save-failed"; // 저장 공간이 부족하거나 저장이 막힘

/**
 * 저장된 앱 데이터에 updater를 적용해 다시 저장한다.
 * updater가 같은 데이터를 그대로 돌려주면 저장하지 않는다.
 */
export function updateData(store: KeyValueStore, updater: (data: SavedData) => SavedData): UpdateResult {
  const loaded = loadData(store);
  if (loaded.kind === "empty") return "empty";
  if (loaded.kind === "corrupt") return "corrupt";

  const next = updater(loaded.data);
  if (next === loaded.data) return "ok";
  return saveData(store, next) ? "ok" : "save-failed";
}
