// Design Ref: §6.1 ② — AI 연결 정보는 앱 데이터와 따로 `hyeondap:ai`에 저장 (백업 파일에 넣지 않음)
// Plan: 작업 6 — 기기 저장 모듈 (AI 키 분리 저장)
// 사용자 본인 키는 이 기기에만 둔다. 서버·로그·백업 파일로 보내지 않는다(CLAUDE.md 6장).
import { AI_PROVIDERS, type AiConnection } from "../types";
import type { KeyValueStore } from "./keyValueStore";

/** AI 연결 정보 저장 키 (앱 데이터 키와 다르다) */
export const AI_CONNECTION_KEY = "hyeondap:ai";

/** 저장된 AI 연결 정보를 불러온다. 없거나 망가졌으면 null */
export function loadAiConnection(store: KeyValueStore): AiConnection | null {
  try {
    const raw = store.getItem(AI_CONNECTION_KEY);
    if (raw === null) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const c = v as Record<string, unknown>;
    if (!(AI_PROVIDERS as readonly unknown[]).includes(c.provider)) return null;
    if (typeof c.apiKey !== "string" || c.apiKey.trim() === "") return null;
    if (typeof c.verifiedAt !== "string") return null;
    return { provider: c.provider as AiConnection["provider"], apiKey: c.apiKey, verifiedAt: c.verifiedAt };
  } catch {
    return null;
  }
}

/** AI 연결 정보를 저장한다. 성공하면 true */
export function saveAiConnection(store: KeyValueStore, connection: AiConnection): boolean {
  try {
    store.setItem(AI_CONNECTION_KEY, JSON.stringify({ ...connection, apiKey: connection.apiKey.trim() }));
    return true;
  } catch {
    return false;
  }
}

/** [연결 끊기] — 기기에서 키를 바로 지운다 */
export function clearAiConnection(store: KeyValueStore): void {
  try {
    store.removeItem(AI_CONNECTION_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다
  }
}

/** 화면 표시용: 키 전체를 보여 주지 않고 끝 4자리만 (예: "…a1b2") */
export function maskApiKey(apiKey: string): string {
  const key = apiKey.trim();
  return key.length <= 4 ? "…" : `…${key.slice(-4)}`;
}
