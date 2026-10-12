// Design Ref: §4.2 — (조건부) 백업 안내 띠: 마지막 백업(없으면 첫 등록) 후 6개월이 지나면 첫 화면 위에 보인다
// Plan: 작업 24 — 백업
import Link from "next/link";
import { BACKUP_REMINDER_MONTHS, lastBackupDate, shouldRemindBackup } from "@/lib/storage/backup";
import type { SavedData } from "@/lib/types";

export default function BackupBanner({ data, now }: { data: SavedData; now: Date }) {
  if (!shouldRemindBackup(data, now)) return null;
  const last = lastBackupDate(data);

  return (
    <div role="status" className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-950 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100">
      <p className="text-base font-bold">⚠ 백업해 주세요</p>
      <p className="mt-0.5 text-sm">
        {last ? `마지막 백업(${last}) 후` : "백업한 적 없이 등록한 지"} {BACKUP_REMINDER_MONTHS}개월이 지났어요. 휴대폰을 바꾸거나 브라우저 데이터를
        지우면 정보가 사라질 수 있어요.
      </p>
      <Link
        href="/settings#backup"
        className="mt-2 flex h-12 items-center justify-center rounded-lg bg-amber-700 text-base font-bold text-white"
      >
        백업하러 가기
      </Link>
    </div>
  );
}
