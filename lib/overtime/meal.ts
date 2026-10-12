// Design Ref: §5.2 ⑤ — 식사 1시간 공제
// Plan: 작업 9 — 근무 1회당 1번, 평시 가운데 1시간 (규칙 2·3)
import { isNightSlot } from "./night";
import type { Shift } from "./shift";

/** 식사시간 1시간 = 10분 칸 6개 */
export const MEAL_SLOTS = 6;

/** 식사 공제 결과 */
export interface MealResult {
  /** 공제하고 남은 근무 칸 (원래 순서 유지) */
  worked: number[];
  /** 식사시간으로 뺀 칸 (없으면 빈 배열) */
  deducted: number[];
}

/**
 * 칸 목록의 가운데 count칸을 고른다.
 * 정확한 가운데가 10분 칸 경계에 맞지 않으면 앞쪽 칸으로 맞춘다 (규칙 2).
 */
function middleSlots(slots: readonly number[], count: number): number[] {
  if (slots.length <= count) return [...slots];
  const startIndex = Math.floor((slots.length - count) / 2);
  return slots.slice(startIndex, startIndex + count);
}

/**
 * 근무 1회에서 식사 1시간을 뺀다.
 * - 평시(야간 22:00~06:00이 아닌 시간)가 1시간 이상: 평시 칸을 근무 순서대로 이었을 때 가운데 1시간을 뺀다 (규칙 2)
 *   예) 18:00~09:00 → 평시 18~22시·06~09시 총 7시간의 가운데 → 21:00~22:00
 * - 평시가 1시간 미만: [식사시간 공제] 체크가 켜져 있으면 근무 전체의 가운데 1시간, 꺼져 있으면 빼지 않는다 (규칙 3)
 *   (근무 전체가 1시간이 안 되면 체크 시 근무 전체를 뺀다)
 */
export function applyMealDeduction(shift: Shift): MealResult {
  const regular = shift.slots.filter((s) => !isNightSlot(s));

  let deducted: number[];
  if (regular.length >= MEAL_SLOTS) {
    deducted = middleSlots(regular, MEAL_SLOTS);
  } else if (shift.mealDeduct) {
    deducted = middleSlots(shift.slots, MEAL_SLOTS);
  } else {
    deducted = [];
  }

  const removed = new Set(deducted);
  return { worked: shift.slots.filter((s) => !removed.has(s)), deducted };
}
