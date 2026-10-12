// Design Ref: §6.1 ① — 앱 데이터는 localStorage 키 `hyeondap:v1`에 저장 (백업 파일도 같은 모양)
// Plan: 작업 6 — 기기 저장 모듈 (등록 이력·근무 변경·공휴일·첫 등록일, 저장 형식 버전 포함)
// 저장된 내용은 사용자가 고칠 수도 있고 망가질 수도 있으므로, 불러올 때마다 모양을 검사한다.
// 검사 함수(parseSavedData)는 백업 파일 불러오기(작업 24)에서도 그대로 쓴다.
import { profileOnDate } from "../schedule/generate";
import { isValidDate, isValidShiftTime } from "../time";
import {
  DEPARTMENTS,
  PATTERN_IDS,
  SAVED_DATA_VERSION,
  type DayEntry,
  type IsoDateTime,
  type Memo,
  type OtherTeam,
  type Profile,
  type SavedData,
  type TimeRange,
} from "../types";
import type { KeyValueStore } from "./keyValueStore";

/** 앱 데이터 저장 키 */
export const APP_DATA_KEY = "hyeondap:v1";

/** 불러오기 결과: 없음 / 정상 / 망가짐 */
export type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; data: SavedData }
  | { kind: "corrupt" };

/** 처음 등록할 때 쓰는 빈 앱 데이터 */
export function createEmptyData(now: IsoDateTime): SavedData {
  return {
    version: SAVED_DATA_VERSION,
    createdAt: now,
    profiles: [],
    overrides: {},
    holidaysAdded: [],
    holidaysRemoved: [],
    otherTeams: [],
    memos: [],
    lastBackupAt: null,
  };
}

/** 기기에서 앱 데이터를 불러온다 */
export function loadData(store: KeyValueStore): LoadResult {
  let raw: string | null;
  try {
    raw = store.getItem(APP_DATA_KEY);
  } catch {
    return { kind: "corrupt" };
  }
  if (raw === null) return { kind: "empty" };
  try {
    const data = parseSavedData(JSON.parse(raw));
    return data ? { kind: "ok", data } : { kind: "corrupt" };
  } catch {
    return { kind: "corrupt" };
  }
}

/**
 * 앱 데이터를 기기에 저장한다. 성공하면 true.
 * 저장 공간이 꽉 찼거나 저장소를 쓸 수 없으면 false (화면에서 안내한다).
 */
export function saveData(store: KeyValueStore, data: SavedData): boolean {
  try {
    store.setItem(APP_DATA_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** 그 날짜에 적용되는 등록 정보 (규칙 16, 실제 계산은 lib/schedule에서) */
export function profileOn(data: SavedData, date: string): Profile | null {
  return profileOnDate(data.profiles, date);
}

/**
 * 등록 정보를 추가한다([변경] 포함). 같은 적용일이 이미 있으면 바꿔 끼운다.
 * 원래 데이터는 건드리지 않고 새 데이터를 돌려준다.
 */
export function addProfile(data: SavedData, profile: Profile): SavedData {
  const others = data.profiles.filter((p) => p.effectiveFrom !== profile.effectiveFrom);
  const profiles = [...others, profile].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return { ...data, profiles };
}

/** 그날 변경 기록을 넣는다. 빈 기록이면 지운다(=[원래대로]) */
export function setDayEntry(data: SavedData, date: string, entry: DayEntry): SavedData {
  const overrides = { ...data.overrides };
  if (!entry.replace && !entry.extra) delete overrides[date];
  else overrides[date] = entry;
  return { ...data, overrides };
}

// ─── 모양 검사 ──────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isDateString = (v: unknown): v is string => isString(v) && isValidDate(v);
const isIsoString = (v: unknown): v is string => isString(v) && !Number.isNaN(Date.parse(v));

function isTimeRange(v: unknown): v is TimeRange {
  return (
    isObject(v) &&
    isString(v.start) &&
    isValidShiftTime(v.start) &&
    isString(v.end) &&
    isValidShiftTime(v.end) &&
    (v.mealDeduct === undefined || typeof v.mealDeduct === "boolean")
  );
}

function isProfile(v: unknown): v is Profile {
  if (!isObject(v)) return false;
  if (!isDateString(v.effectiveFrom) || !isString(v.agency) || !isString(v.team)) return false;
  if (!(DEPARTMENTS as readonly unknown[]).includes(v.department)) return false;
  if (!(PATTERN_IDS as readonly unknown[]).includes(v.pattern)) return false;
  if (v.patternStartDate !== undefined && !isDateString(v.patternStartDate)) return false;
  // 패턴 1~4는 시작일이 꼭 있어야 순환을 계산할 수 있다 (패턴 5는 없음)
  if (v.pattern !== 5 && v.patternStartDate === undefined) return false;
  if (!isObject(v.shiftTimes)) return false;
  return Object.entries(v.shiftTimes).every(
    ([kind, range]) =>
      ["주간", "야간", "심야", "당직"].includes(kind) &&
      isTimeRange(range) &&
      // 당직은 24시간 근무라 종료가 시작과 같아야 한다 (규칙 11·12)
      (kind !== "당직" || range.end === range.start),
  );
}

function isDayEntry(v: unknown): v is DayEntry {
  if (!isObject(v)) return false;
  if (v.extra !== undefined && !isTimeRange(v.extra)) return false;
  if (v.replace !== undefined) {
    if (!isObject(v.replace)) return false;
    if (v.replace.type === "휴가") return true;
    if (v.replace.type === "교육출장") return isTimeRange(v.replace);
    return false;
  }
  return true;
}

const isOtherTeam = (v: unknown): v is OtherTeam =>
  isObject(v) && isString(v.teamNo) && isDateString(v.patternStartDate);

const isMemo = (v: unknown): v is Memo =>
  isObject(v) && isString(v.id) && isIsoString(v.createdAt) && isString(v.text);

/**
 * 알 수 없는 값을 검사해 올바른 앱 데이터면 돌려주고, 아니면 null.
 * 앞으로 저장 형식 버전이 올라가면 여기서 옛 버전을 새 버전으로 바꿔 준다.
 */
export function parseSavedData(value: unknown): SavedData | null {
  if (!isObject(value)) return null;
  if (value.version !== SAVED_DATA_VERSION) return null;
  if (!isIsoString(value.createdAt)) return null;
  if (!Array.isArray(value.profiles) || !value.profiles.every(isProfile)) return null;
  if (!isObject(value.overrides)) return null;
  for (const [date, entry] of Object.entries(value.overrides)) {
    if (!isValidDate(date) || !isDayEntry(entry)) return null;
  }
  if (!Array.isArray(value.holidaysAdded) || !value.holidaysAdded.every(isDateString)) return null;
  if (!Array.isArray(value.holidaysRemoved) || !value.holidaysRemoved.every(isDateString)) return null;
  if (!Array.isArray(value.otherTeams) || !value.otherTeams.every(isOtherTeam)) return null;
  if (!Array.isArray(value.memos) || !value.memos.every(isMemo)) return null;
  if (value.lastBackupAt !== null && !isIsoString(value.lastBackupAt)) return null;

  // 검사를 통과한 항목만 골라 담는다 (알 수 없는 다른 항목은 버린다)
  return {
    version: SAVED_DATA_VERSION,
    createdAt: value.createdAt,
    profiles: value.profiles as Profile[],
    overrides: value.overrides as Record<string, DayEntry>,
    holidaysAdded: value.holidaysAdded as string[],
    holidaysRemoved: value.holidaysRemoved as string[],
    otherTeams: value.otherTeams as OtherTeam[],
    memos: value.memos as Memo[],
    lastBackupAt: value.lastBackupAt as IsoDateTime | null,
  };
}
