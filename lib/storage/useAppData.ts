// Design Ref: §6.1 — 화면에서 기기에 저장된 앱 데이터를 읽는다 (저장이 바뀌면 화면도 따라 바뀜)
// Plan: 작업 19 — 첫 접속 안내, 설정의 내 등록 정보, [변경]이 같은 데이터를 보게 한다.
// 서버에서 그릴 때는 저장소가 없으므로 "loading"으로 시작하고, 브라우저에서 읽은 뒤 바뀐다.
import { useMemo, useSyncExternalStore } from "react";
import { getBrowserStore, type KeyValueStore } from "./keyValueStore";
import { APP_DATA_KEY, parseSavedData } from "./store";
import type { SavedData } from "../types";

/** 화면이 보는 저장 상태 */
export type AppDataState =
  | { status: "loading" } // 서버에서 그리는 중이거나 아직 브라우저에서 읽기 전
  | { status: "unavailable" } // 이 브라우저는 저장소를 쓸 수 없음 (사생활 보호 모드 등)
  | { status: "empty" } // 아직 등록한 적 없음
  | { status: "corrupt" } // 저장된 내용을 읽을 수 없음 (자동으로 지우지 않는다)
  | { status: "ok"; data: SavedData };

// useSyncExternalStore는 같은 값이면 같은 결과를 돌려줘야 해서, 저장 문자열 자체를 스냅샷으로 쓴다.
const LOADING = "\u0000loading";
const UNAVAILABLE = "\u0000unavailable";
const EMPTY = "";

const listeners = new Set<() => void>();
let cachedStore: KeyValueStore | null | undefined;

/** 이 기기(브라우저)의 저장소. 쓸 수 없으면 null (매번 확인하지 않게 한 번만 알아본다) */
export function appStore(): KeyValueStore | null {
  if (cachedStore === undefined) cachedStore = getBrowserStore();
  return cachedStore;
}

/** 저장이 바뀌었음을 화면에 알린다 (저장한 직후에 호출) */
export function notifyDataChanged(): void {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // 다른 탭에서 바꾼 경우
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): string {
  const store = appStore();
  if (!store) return UNAVAILABLE;
  try {
    return store.getItem(APP_DATA_KEY) ?? EMPTY;
  } catch {
    return UNAVAILABLE;
  }
}

/** 기기에 저장된 앱 데이터를 읽는다 */
export function useAppData(): AppDataState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => LOADING);
  return useMemo<AppDataState>(() => {
    if (raw === LOADING) return { status: "loading" };
    if (raw === UNAVAILABLE) return { status: "unavailable" };
    if (raw === EMPTY) return { status: "empty" };
    try {
      const data = parseSavedData(JSON.parse(raw));
      return data ? { status: "ok", data } : { status: "corrupt" };
    } catch {
      return { status: "corrupt" };
    }
  }, [raw]);
}
