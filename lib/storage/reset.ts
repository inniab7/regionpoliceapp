// Design Ref: §4.5 — 설정의 [초기화]: 이 기기에 저장된 모든 값을 지워 처음 설치한 상태로 되돌린다
// Plan: 초기화 기능. 등록 정보·근무 변경·공휴일·다른 팀·메모·백업 시각(앱 데이터)과 AI 연결 정보(키 포함)를 모두 지운다.
// 되돌릴 수 없다. 화면에서 반드시 한 번 더 물어본 뒤에만 호출한다. 이 기기 밖(서버·백업 파일)에는 원래 아무것도 없다.
import { AI_CONNECTION_KEY } from "./aiKey";
import type { KeyValueStore } from "./keyValueStore";
import { APP_DATA_KEY } from "./store";

/** 초기화로 지우는 저장 키 전부 */
export const RESET_KEYS = [APP_DATA_KEY, AI_CONNECTION_KEY] as const;

export type ResetResult = "ok" | "failed";

/**
 * 저장된 값을 모두 지운다. 일부라도 못 지우면 "failed".
 * 망가진 데이터도 그대로 지운다 (읽을 수 없는 데이터를 새로 시작하는 방법이기도 하다).
 * 다른 사이트나 이 앱과 상관없는 저장 값은 건드리지 않는다.
 */
export function resetAllData(store: KeyValueStore): ResetResult {
  let failed = false;
  for (const key of RESET_KEYS) {
    try {
      store.removeItem(key);
      if (store.getItem(key) !== null) failed = true; // 지웠는지 다시 확인
    } catch {
      failed = true;
    }
  }
  return failed ? "failed" : "ok";
}
