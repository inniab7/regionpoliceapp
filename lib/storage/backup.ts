// Design Ref: §4.5·§6.1 — 백업 파일 저장·불러오기와 6개월 안내 (AI 키는 백업 파일에 넣지 않는다)
// Plan: 작업 24 — 백업 (PRD 7장 ②). 순수 함수: 화면에서 파일을 내려받고 읽는 부분만 컴포넌트에 있다.
// 백업 파일에는 앱 데이터(SavedData)만 담긴다. AI 연결 정보는 다른 저장 키(hyeondap:ai)라 여기서는 아예 만지지 않는다.
import { todayInKst } from "../time";
import type { SavedData } from "../types";
import type { KeyValueStore } from "./keyValueStore";
import { parseSavedData, saveData } from "./store";

const APP_NAME = "현답";
const FORMAT_VERSION = 1;

/** 백업 파일의 내용 */
export interface BackupFile {
  app: typeof APP_NAME;
  kind: "backup";
  formatVersion: typeof FORMAT_VERSION;
  /** 파일을 만든 시각 */
  exportedAt: string;
  /** 앱 데이터 (AI 키 없음) */
  data: SavedData;
}

/** 백업 파일을 만든다. 파일 안의 lastBackupAt은 만든 시각으로 맞춘다 */
export function createBackup(data: SavedData, now: Date): { fileName: string; content: string; savedAt: string } {
  const savedAt = now.toISOString();
  const file: BackupFile = {
    app: APP_NAME,
    kind: "backup",
    formatVersion: FORMAT_VERSION,
    exportedAt: savedAt,
    data: { ...data, lastBackupAt: savedAt },
  };
  return {
    fileName: `현답-백업-${todayInKst(now)}.json`,
    content: JSON.stringify(file, null, 2),
    savedAt,
  };
}

export type ParseBackupResult = { ok: true; file: BackupFile } | { ok: false; message: string };

const NOT_A_BACKUP = "백업 파일이 아니에요. 현답에서 저장한 .json 파일을 골라 주세요.";

/**
 * 파일 내용을 읽어 올바른 백업인지 검사한다. 반영은 하지 않는다.
 * 이상이 있으면 한국어 안내를 돌려주고, 지금 저장된 정보는 건드리지 않는다.
 */
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: NOT_A_BACKUP };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, message: NOT_A_BACKUP };
  const f = raw as Record<string, unknown>;
  if (f.app !== APP_NAME || f.kind !== "backup") return { ok: false, message: NOT_A_BACKUP };
  if (f.formatVersion !== FORMAT_VERSION) {
    return { ok: false, message: "이 백업 파일은 알 수 없는 버전이라 불러올 수 없어요. 앱을 최신으로 바꾼 뒤 다시 해 주세요." };
  }
  const data = parseSavedData(f.data);
  if (!data) return { ok: false, message: "백업 파일의 내용이 올바르지 않아서 불러올 수 없어요. 지금 정보는 그대로예요." };
  return {
    ok: true,
    file: {
      app: APP_NAME,
      kind: "backup",
      formatVersion: FORMAT_VERSION,
      exportedAt: typeof f.exportedAt === "string" ? f.exportedAt : (data.lastBackupAt ?? data.createdAt),
      data,
    },
  };
}

/** 불러오기 전에 보여 줄 요약 (예: ["등록 정보 2건", "근무 변경 5일"]) */
export function summarizeBackup(file: BackupFile): string[] {
  const d = file.data;
  const lines = [`등록 정보 ${d.profiles.length}건`, `근무 변경 ${Object.keys(d.overrides).length}일`];
  const holidayChanges = d.holidaysAdded.length + d.holidaysRemoved.length;
  if (holidayChanges > 0) lines.push(`공휴일 변경 ${holidayChanges}건`);
  if (d.otherTeams.length > 0) lines.push(`다른 팀 ${d.otherTeams.length}팀`);
  if (d.memos.length > 0) lines.push(`메모 ${d.memos.length}건`);
  return lines;
}

/**
 * 백업 내용으로 이 기기의 앱 데이터를 통째로 바꾼다 (AI 연결 정보는 그대로 둔다).
 * 호출하기 전에 사용자에게 "지금 정보가 바뀐다"고 확인을 받는다.
 */
export function restoreBackup(store: KeyValueStore, file: BackupFile): "ok" | "save-failed" {
  return saveData(store, file.data) ? "ok" : "save-failed";
}

/** 몇 개월 지났는지 판단할 때 쓰는 기준 (규칙: 마지막 백업 후 6개월, PRD 7장) */
export const BACKUP_REMINDER_MONTHS = 6;

/**
 * 백업 안내를 띄울 때인지: 마지막 백업(한 번도 안 했으면 첫 등록) 후 6개월이 지났으면 true.
 */
export function shouldRemindBackup(data: SavedData, now: Date, months = BACKUP_REMINDER_MONTHS): boolean {
  const base = new Date(data.lastBackupAt ?? data.createdAt);
  if (Number.isNaN(base.getTime())) return false;
  const due = new Date(base);
  due.setUTCMonth(due.getUTCMonth() + months);
  return now.getTime() >= due.getTime();
}

/** 화면 표시용 마지막 백업 날짜 ("YYYY-MM-DD", 한국 시간). 한 번도 안 했으면 null */
export function lastBackupDate(data: SavedData): string | null {
  return data.lastBackupAt ? todayInKst(new Date(data.lastBackupAt)) : null;
}
