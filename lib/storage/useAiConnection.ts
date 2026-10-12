// Design Ref: §6.1 ② — 화면에서 기기에 저장된 AI 연결 정보(`hyeondap:ai`)를 읽는다. 앱 데이터와 따로 다룬다.
// Plan: 작업 25 — AI 연결. 이후 규정 찾기 화면도 같은 값을 본다.
import { useMemo, useSyncExternalStore } from "react";
import type { AiConnection } from "../types";
import { AI_CONNECTION_KEY, clearAiConnection, loadAiConnection, saveAiConnection } from "./aiKey";
import { createMemoryStore } from "./keyValueStore";
import { appStore } from "./useAppData";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

const LOADING = "\u0000loading";
const UNAVAILABLE = "\u0000unavailable";

function getSnapshot(): string {
  const store = appStore();
  if (!store) return UNAVAILABLE;
  try {
    return store.getItem(AI_CONNECTION_KEY) ?? "";
  } catch {
    return UNAVAILABLE;
  }
}

export type AiConnectionState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "none" }
  | { status: "connected"; connection: AiConnection };

export function useAiConnection(): AiConnectionState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => LOADING);
  return useMemo<AiConnectionState>(() => {
    if (raw === LOADING) return { status: "loading" };
    if (raw === UNAVAILABLE) return { status: "unavailable" };
    if (raw === "") return { status: "none" };
    // 읽는 일만 필요하므로 같은 문자열을 임시 저장소에 담아 검사 함수를 재사용한다
    const tmp = createMemoryStore();
    tmp.setItem(AI_CONNECTION_KEY, raw);
    const connection = loadAiConnection(tmp);
    return connection ? { status: "connected", connection } : { status: "none" };
  }, [raw]);
}

/** AI 연결 정보가 바뀌었음을 화면에 알린다 (초기화처럼 저장소를 밖에서 직접 지운 뒤에 호출) */
export function notifyAiConnectionChanged(): void {
  notify();
}

/** 연결 정보를 저장하고 화면에 알린다. 성공하면 true */
export function connectAi(connection: AiConnection): boolean {
  const store = appStore();
  if (!store) return false;
  const ok = saveAiConnection(store, connection);
  notify();
  return ok;
}

/** [연결 끊기] — 키를 이 기기에서 바로 지우고 화면에 알린다 */
export function disconnectAi(): void {
  const store = appStore();
  if (store) clearAiConnection(store);
  notify();
}
