// Design Ref: §4.5 (nice) — 설정의 다른 팀: 최대 6팀, 팀 번호 + 패턴 시작일, [추가]/[삭제]
// Plan: 작업 33 — 다른 팀 등록. 패턴과 교대 시간은 내 것과 같다고 보므로 팀 번호와 패턴 시작일만 받는다.
"use client";

import { useState } from "react";
import { MAX_OTHER_TEAMS, addOtherTeam, removeOtherTeam, supportsOtherTeams } from "@/lib/schedule/teams";
import { profileOn } from "@/lib/storage/store";
import { changeAppData, useAppData } from "@/lib/storage/useAppData";
import { formatShortDate, todayInKst } from "@/lib/time";

export default function OtherTeamsEditor() {
  const app = useAppData();
  const [teamNo, setTeamNo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (app.status === "loading") return <p className="text-zinc-600 dark:text-zinc-400">불러오는 중…</p>;
  if (app.status !== "ok") return <p className="text-base">근무를 등록하면 다른 팀을 추가할 수 있어요.</p>;

  const data = app.data;
  const profile = profileOn(data, todayInKst(new Date())) ?? data.profiles.at(-1) ?? null;
  if (!supportsOtherTeams(profile)) {
    return (
      <p className="text-base text-zinc-600 dark:text-zinc-400">
        일근(패턴 5)은 팀이 번갈아 근무하지 않아서 다른 팀 표시를 쓰지 않아요.
      </p>
    );
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const result = addOtherTeam(data.otherTeams, profile?.team ?? "", { teamNo, patternStartDate: startDate });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const saved = changeAppData((d) => ({ ...d, otherTeams: result.teams }));
    if (saved !== "ok") {
      setError("저장하지 못했어요. 이 기기의 저장 공간을 확인해 주세요.");
      return;
    }
    setTeamNo("");
    setStartDate("");
    setError(null);
  }

  function handleRemove(no: string) {
    changeAppData((d) => ({ ...d, otherTeams: removeOtherTeam(d.otherTeams, no) }));
  }

  const full = data.otherTeams.length >= MAX_OTHER_TEAMS;

  return (
    <div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        다른 팀의 <b>팀 번호</b>와 <b>패턴 시작일</b>(그 팀이 패턴의 첫 번째 근무를 하는 날)만 넣으면, 첫 화면에 다음에 들어오는 팀이
        계속 보여요. 패턴과 교대 시간은 내 것과 같다고 봐요. (최대 {MAX_OTHER_TEAMS}팀)
      </p>

      {data.otherTeams.length > 0 && (
        <ul className="mt-3 space-y-2">
          {data.otherTeams.map((t) => (
            <li key={t.teamNo} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-600">
              <span className="text-base">
                <b>{t.teamNo}</b> · 시작일 {formatShortDate(t.patternStartDate)}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(t.teamNo)}
                aria-label={`${t.teamNo} 삭제`}
                className="h-12 shrink-0 rounded-lg border border-red-600 px-4 text-base font-bold text-red-700 dark:border-red-400 dark:text-red-400"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{MAX_OTHER_TEAMS}팀을 모두 등록했어요. 바꾸려면 먼저 삭제해 주세요.</p>
      ) : (
        <form onSubmit={handleAdd} className="mt-3 space-y-2">
          <div>
            <label htmlFor="otherTeamNo" className="text-base font-bold">
              팀 번호
            </label>
            <input
              id="otherTeamNo"
              value={teamNo}
              onChange={(e) => {
                setTeamNo(e.target.value);
                setError(null);
              }}
              placeholder="예: 3팀"
              autoComplete="off"
              className="mt-1 h-12 w-full rounded-lg border border-zinc-400 bg-background px-3 text-base"
            />
          </div>
          <div>
            <label htmlFor="otherTeamStart" className="text-base font-bold">
              패턴 시작일
            </label>
            <input
              id="otherTeamStart"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setError(null);
              }}
              className="mt-1 h-12 w-full rounded-lg border border-zinc-400 bg-background px-3 text-base"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <button type="submit" className="h-12 w-full rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500">
            팀 추가
          </button>
        </form>
      )}
    </div>
  );
}
