// Design Ref: §6.1 — 기기 저장은 브라우저 localStorage를 쓴다
// Plan: 작업 6 — 기기 저장 모듈 (저장소 연결 부분)
// 저장 기능을 시험할 수 있게 localStorage를 직접 쓰지 않고 이 작은 모양(getItem/setItem/removeItem)을 받는다.

/** localStorage와 같은 모양의 저장소 (시험에서는 메모리 저장소로 바꿔 끼운다) */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * 브라우저 저장소를 돌려준다. 쓸 수 없으면 null.
 * (서버에서 그릴 때, 사생활 보호 모드, 사용자가 사이트 데이터를 막은 경우 등)
 */
export function getBrowserStore(): KeyValueStore | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "hyeondap:probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 시험용 메모리 저장소 */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}
