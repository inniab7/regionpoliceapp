// Design Ref: §5.2 ④ — 야간 = 실제 시각 22:00~06:00 (규칙 5)
// Plan: 작업 9·10 — 식사 공제(평시 판단)와 야간 집계가 함께 쓰는 기준
import { TIME_STEP_MINUTES } from "../time";
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

/** 근무 칸을 야간 칸과 평시 칸으로 나눈다 (근무 순서 유지) */
export interface NightSplit {
  night: number[];
  regular: number[];
}

/**
 * 식사 공제 후 남은 근무 칸을 실제 시각 기준으로 야간·평시로 나눈다 (작업 10, 규칙 5).
 * 날을 넘긴 칸도 그 칸의 실제 시각으로 판단한다 (예: 다음 날 05:50은 야간, 06:00은 평시).
 */
export function splitByNight(slots: readonly number[]): NightSplit {
  const night: number[] = [];
  const regular: number[] = [];
  for (const s of slots) (isNightSlot(s) ? night : regular).push(s);
  return { night, regular };
}

/** 야간(22:00~06:00)에 근무한 분 */
export function nightMinutes(slots: readonly number[]): number {
  return splitByNight(slots).night.length * TIME_STEP_MINUTES;
}
