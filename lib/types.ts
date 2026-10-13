// Design Ref: §6.1 — 기기에 저장하는 데이터 모양 (앱 데이터 / AI 연결)
// Plan: 작업 3 — 공통 타입 정의 (부서·근무 종류·패턴·등록 정보·근무 변경 기록)
// 계산 규칙 번호(규칙 n)는 PRD 5장 ①의 규칙 1~17을 가리킨다.

/** 날짜 "YYYY-MM-DD" (한국 시간 기준) */
export type DateString = string;

/** 시각 "HH:MM" (24시간제, 10분 단위) */
export type TimeString = string;

/** ISO 시각 "2026-10-06T09:00:00.000Z" (저장·백업 시각 기록용) */
export type IsoDateTime = string;

// ─── 부서 ───────────────────────────────────────────────

/** 소속 부서 6종 (등록 화면 목록 순서) */
// 내근(일근 근무자 등)과 기타(기동대 등)는 야간 시간 자유 입력 대상이 아니다. 그런 경우는 근무 형태에서 「직접 만들기」(패턴 6)를 쓴다
export const DEPARTMENTS = ["지구대·파출소", "형사", "수사", "사고조사", "교통관리", "교통안전", "내근", "기타(기동대 등)"] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** 야간 시간을 선택지 제한 없이 10분 단위로 직접 고르는 부서 (규칙 10) */
export const FREE_NIGHT_TIME_DEPARTMENTS: readonly Department[] = [
  "형사",
  "수사",
  "사고조사",
  "교통관리",
  "교통안전",
];

// ─── 근무 종류 ──────────────────────────────────────────

/** 근무하는 날의 종류 */
export const SHIFT_KINDS = ["주간", "야간", "심야", "당직", "일근"] as const;
export type ShiftKind = (typeof SHIFT_KINDS)[number];

/** 쉬는 날의 종류 */
export const OFF_KINDS = ["비번", "휴무"] as const;
export type OffKind = (typeof OFF_KINDS)[number];

/** 패턴 순환의 하루 = 근무하는 날 또는 쉬는 날 */
export type DayKind = ShiftKind | OffKind;

/**
 * 등록 때 시작 시간을 입력받는 근무 종류.
 * 당직(규칙 12)은 패턴 4에서만 나오는 24시간 근무라 **시작 시각만** 고르고(기본 09:00), 종료는 시작과 같다.
 * 일근은 패턴 5에서는 09:00~18:00 고정이라 시간 입력이 없고(규칙 13), **직접 만든 패턴(6)** 에서만 시작·종료를 입력받는다.
 */
export type TimedShiftKind = "주간" | "야간" | "심야" | "당직" | "일근";

// ─── 근무 패턴 ──────────────────────────────────────────

/**
 * 근무 형태(패턴) 1~6 — 순환 내용은 lib/schedule/patterns.ts에서 정한다 (작업 7).
 * 6은 사용자가 순환을 직접 만드는 패턴(형사·수사 등): 순환은 등록 정보의 customCycle에 들어 있다.
 */
export const PATTERN_IDS = [1, 2, 3, 4, 5, 6] as const;
export type PatternId = (typeof PATTERN_IDS)[number];

/** 직접 만드는 패턴(6)에서 하루로 고를 수 있는 종류 */
export const CUSTOM_CYCLE_KINDS = ["주간", "야간", "일근", "휴무", "비번"] as const;
export type CustomCycleKind = (typeof CUSTOM_CYCLE_KINDS)[number];

/** 직접 만드는 패턴의 순환 길이 한도(일) */
export const MAX_CUSTOM_CYCLE_DAYS = 31;

// ─── 시간 범위 ──────────────────────────────────────────

/**
 * 근무 1회의 시작·종료 (10분 단위).
 * - 종료 < 시작이면 다음 날 끝나는 근무, 종료 = 시작이면 24시간 근무 (규칙 11)
 * - mealDeduct: 평시가 1시간 미만인 근무에서만 쓰는 [식사시간 공제] 체크.
 *   값이 없으면 체크된 것(공제함)으로 본다 (규칙 3)
 */
export interface TimeRange {
  start: TimeString;
  end: TimeString;
  mealDeduct?: boolean;
}

// ─── 등록 정보 ──────────────────────────────────────────

/**
 * 등록 정보 1건. [변경]할 때마다 새 항목을 등록 이력에 추가한다 (규칙 16).
 * 이름·연락처·계급·사번 필드는 만들지 않는다 (PRD 7장 ②).
 */
export interface Profile {
  /** 적용일. 이 날부터 이 등록 정보로 계산한다 (첫 등록은 등록일) */
  effectiveFrom: DateString;
  /** 소속청 */
  agency: string;
  department: Department;
  team: string;
  pattern: PatternId;
  /** 패턴 시작일 = 첫 번째 근무를 하는 날. 패턴 5(일근)는 없음 (규칙 13) */
  patternStartDate?: DateString;
  /** 직접 만든 패턴(6)의 순환. 하루씩 이 순서로 반복한다 (패턴 시작일 = 순환의 첫째 날). 다른 패턴에는 없다 */
  customCycle?: CustomCycleKind[];
  /** 근무 종류별 시작·종료. 고른 패턴에 들어 있는 종류만 채운다 */
  shiftTimes: Partial<Record<TimedShiftKind, TimeRange>>;
}

// ─── 근무 변경 기록 ──────────────────────────────────────

/** 휴가(연가·병가): 근무일에만 고를 수 있고, 그 달 근무시간에 8시간으로 인정 (규칙 4) */
export interface LeaveReplacement {
  type: "휴가";
}

/** 교육·출장: 그날 근무 대신 직접 입력한 시간으로 계산 */
export interface TrainingReplacement extends TimeRange {
  type: "교육출장";
}

/** 그날 정해진 근무를 바꾸는 변경 */
export type DayReplacement = LeaveReplacement | TrainingReplacement;

/**
 * 하루 단위 변경 기록.
 * - replace: 그날 근무를 휴가 또는 교육·출장으로 바꿈
 * - extra: 추가 근무(동원, 패턴 5는 "초과근무"). 정해진 근무시간 밖의 시간만 (규칙 14)
 * 둘은 함께 둘 수 있다.
 */
export interface DayEntry {
  replace?: DayReplacement;
  extra?: TimeRange;
}

// ─── nice 기능 ──────────────────────────────────────────

/** (nice) 다른 팀 — 패턴과 교대 시간은 내 것과 같다고 본다 */
export interface OtherTeam {
  teamNo: string;
  patternStartDate: DateString;
}

/** (nice) 메모 — 개인정보는 적지 않도록 화면에서 안내한다 */
export interface Memo {
  id: string;
  createdAt: IsoDateTime;
  text: string;
}

// ─── 기기 저장: 앱 데이터 (백업 파일에 포함) ─────────────

/** 앱 데이터 저장 형식 버전. 모양이 바뀌면 올린다 */
export const SAVED_DATA_VERSION = 1;

/** localStorage 키 `hyeondap:v1`에 저장하는 앱 데이터 (백업 파일도 이 모양) */
export interface SavedData {
  version: typeof SAVED_DATA_VERSION;
  /** 첫 등록 시각. 백업 안내 기준은 lastBackupAt ?? createdAt */
  createdAt: IsoDateTime;
  /** 등록 이력 (적용일 순) */
  profiles: Profile[];
  /** 날짜("YYYY-MM-DD") → 그날 변경 기록 */
  overrides: Record<DateString, DayEntry>;
  /** 사용자가 추가한 공휴일 */
  holidaysAdded: DateString[];
  /** 내장 공휴일 중 사용자가 뺀 날 */
  holidaysRemoved: DateString[];
  /** (nice) 최대 6팀 */
  otherTeams: OtherTeam[];
  /** (nice) */
  memos: Memo[];
  /** 마지막 백업 시각 */
  lastBackupAt: IsoDateTime | null;
}

// ─── 기기 저장: AI 연결 (백업 파일에 넣지 않음) ───────────

export const AI_PROVIDERS = ["gemini", "chatgpt", "claude"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** 화면에 보여 줄 AI 이름 */
export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  claude: "Claude",
};

/**
 * localStorage 키 `hyeondap:ai`에 저장하는 AI 연결 정보.
 * 사용자 본인 키는 이 기기에만 두고, 서버·로그·백업 파일로 보내지 않는다.
 */
export interface AiConnection {
  provider: AiProvider;
  apiKey: string;
  /** [연결 확인] 성공 시각 */
  verifiedAt: IsoDateTime;
}
