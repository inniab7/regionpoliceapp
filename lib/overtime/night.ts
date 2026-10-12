// Design Ref: §5.2 ④ — 야간 = 실제 시각 22:00~06:00 (규칙 5)
// Plan: 작업 9·10 — 식사 공제(평시 판단)와 야간 집계가 함께 쓰는 기준
import { slotMinuteOfDay } from "./shift";

/** 야간 시작 22:00 (분) */
export const NIGHT_START_MINUTE = 22 * 60;
/** 야간 끝 06:00 (분) */
export const NIGHT_END_MINUTE = 6 * 60;

/** 10분 칸이 야간(22:00~06:00)인지. 아니면 평시 */
export function isNightSlot(slot: number): boolean {
  const m = slotMinuteOfDay(slot);
  return m >= NIGHT_START_MINUTE || m < NIGHT_END_MINUTE;
}
