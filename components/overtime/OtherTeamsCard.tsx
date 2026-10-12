// Design Ref: §4.2 (nice) — 첫 화면의 작은 칸: 다음에 들어오는 팀과 팀별 오늘 근무
// Plan: 작업 34 — 다른 팀 근무 표시. 예) 내가 주간이면 오늘 야간에 들어오는 팀, 내가 야간이면 내일 주간에 들어오는 팀
import Link from "next/link";
import { DAY_KIND_SHORT } from "@/lib/schedule/patterns";
import { handoverGroups, otherTeamKinds, supportsOtherTeams } from "@/lib/schedule/teams";
import { plannedDay } from "@/lib/schedule/generate";
import type { DateString, SavedData } from "@/lib/types";

interface Props {
  data: SavedData;
  today: DateString;
  holidays: ReadonlySet<DateString>;
}

export default function OtherTeamsCard({ data, today, holidays }: Props) {
  if (data.otherTeams.length === 0) return null;
  const profile = plannedDay(data.profiles, today, holidays).profile;
  if (!supportsOtherTeams(profile)) return null;

  const groups = handoverGroups(data.profiles, data.otherTeams, today, holidays);
  const kinds = otherTeamKinds(data.profiles, data.otherTeams, today, holidays);

  return (
    <div className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-600">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">다른 팀 근무</p>
        <Link href="/settings#teams" className="text-sm font-bold text-blue-700 underline dark:text-blue-400">
          팀 편집
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">오늘은 근무하는 다른 팀이 없어요.</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-base">
          {groups.map((g) => (
            <li key={g.label}>
              {g.label}{" "}
              <b>{g.teamNos.length > 0 ? `${g.teamNos.length}팀 (${g.teamNos.join(", ")})` : "없음"}</b>
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="팀별 오늘 근무">
        {kinds.map((t) => (
          <li key={t.teamNo} className="rounded-full bg-zinc-100 px-2.5 py-1 text-sm dark:bg-zinc-800">
            {t.teamNo} · {DAY_KIND_SHORT[t.kind]}
          </li>
        ))}
      </ul>
    </div>
  );
}
