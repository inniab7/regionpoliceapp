// Design Ref: §4.2·§4.5 (nice) — 다른 팀 근무 표시: 팀마다 팀 번호와 패턴 시작일만 받고, 패턴과 교대 시간은 내 것과 같다고 본다
// Plan: 작업 33·34 — 다른 팀 등록과 표시. 순수 함수: 저장소·현재 시각을 쓰지 않는다.
import { addDays, isValidDate } from "../time";
import type { DateString, DayKind, OtherTeam, Profile } from "../types";
import { dayKindFor, plannedDay } from "./generate";
import { PATTERNS } from "./patterns";

/** 등록할 수 있는 다른 팀 수 (PRD 흐름 ②) */
export const MAX_OTHER_TEAMS = 6;
/** 팀 번호 최대 글자 수 (예: "3팀") */
export const MAX_TEAM_NO_LENGTH = 10;

export interface TeamDay {
  teamNo: string;
  kind: DayKind;
}

/** 다른 팀이 의미 있는 패턴인지 (순환이 있는 패턴 1~4만. 일근(5)은 팀 교대가 없다) */
export function supportsOtherTeams(profile: Profile | null): profile is Profile {
  return profile !== null && PATTERNS[profile.pattern].cycle !== null;
}

/** 그날 각 팀의 근무 종류. 내 패턴을 쓰되 시작일만 팀의 것으로 바꾼다 */
export function otherTeamKinds(
  profiles: readonly Profile[],
  teams: readonly OtherTeam[],
  date: DateString,
  holidays: ReadonlySet<DateString>,
): TeamDay[] {
  const profile = plannedDay(profiles, date, holidays).profile;
  if (!supportsOtherTeams(profile)) return [];
  return teams.map((t) => ({ teamNo: t.teamNo, kind: dayKindFor({ ...profile, patternStartDate: t.patternStartDate }, date, holidays) }));
}

/** 화면에 보일 한 묶음: 예) "오늘 야간에 들어오는 팀" → 3팀, 5팀 */
export interface HandoverGroup {
  label: string;
  teamNos: string[];
}

const names = (days: TeamDay[], kind: DayKind) => days.filter((d) => d.kind === kind).map((d) => d.teamNo);

/**
 * 내 오늘 근무를 기준으로 "다음에 들어오는 팀"을 묶어 준다.
 * - 내가 주간 → 오늘 야간(·심야)에 들어오는 팀
 * - 내가 야간·심야 → 내일 주간에 들어오는 팀
 * - 내가 당직 → 내일 당직에 들어오는 팀
 * - 쉬는 날(비번·휴무) → 오늘 근무하는 팀을 종류별로
 */
export function handoverGroups(
  profiles: readonly Profile[],
  teams: readonly OtherTeam[],
  today: DateString,
  holidays: ReadonlySet<DateString>,
): HandoverGroup[] {
  if (teams.length === 0) return [];
  const mine = plannedDay(profiles, today, holidays);
  if (!supportsOtherTeams(mine.profile) || !mine.kind) return [];

  const now = otherTeamKinds(profiles, teams, today, holidays);
  const next = otherTeamKinds(profiles, teams, addDays(today, 1), holidays);

  switch (mine.kind) {
    case "주간": {
      const groups: HandoverGroup[] = [{ label: "오늘 야간에 들어오는 팀", teamNos: names(now, "야간") }];
      const late = names(now, "심야");
      if (late.length > 0 || mine.profile.pattern === 1) groups.push({ label: "오늘 심야에 들어오는 팀", teamNos: late });
      return groups;
    }
    case "야간":
    case "심야":
      return [{ label: "내일 주간에 들어오는 팀", teamNos: names(next, "주간") }];
    case "당직":
      return [{ label: "내일 당직에 들어오는 팀", teamNos: names(next, "당직") }];
    default: {
      // 비번·휴무: 오늘 근무하는 팀을 종류별로 보여 준다 (근무하는 종류만)
      const kinds: DayKind[] = ["주간", "야간", "심야", "당직"];
      return kinds
        .map((k) => ({ label: `오늘 ${k} 근무 팀`, teamNos: names(now, k) }))
        .filter((g) => g.teamNos.length > 0);
    }
  }
}

export type TeamCheck = { ok: true; teams: OtherTeam[] } | { ok: false; message: string };

/** 다른 팀 하나를 추가해도 되는지 검사하고, 되면 추가한 목록을 돌려준다 */
export function addOtherTeam(existing: readonly OtherTeam[], myTeam: string, input: { teamNo: string; patternStartDate: string }): TeamCheck {
  const teamNo = input.teamNo.trim().replace(/\s+/g, " ");
  if (existing.length >= MAX_OTHER_TEAMS) return { ok: false, message: `다른 팀은 ${MAX_OTHER_TEAMS}팀까지 등록할 수 있어요.` };
  if (teamNo === "") return { ok: false, message: "팀 번호를 적어 주세요. 예: 3팀" };
  if (teamNo.length > MAX_TEAM_NO_LENGTH) return { ok: false, message: `팀 번호는 ${MAX_TEAM_NO_LENGTH}글자까지 적을 수 있어요.` };
  const same = (a: string, b: string) => a.replace(/\s+/g, "").toLowerCase() === b.replace(/\s+/g, "").toLowerCase();
  if (same(teamNo, myTeam)) return { ok: false, message: "내 팀과 같은 번호예요. 다른 팀의 번호를 적어 주세요." };
  if (existing.some((t) => same(t.teamNo, teamNo))) return { ok: false, message: "이미 등록한 팀이에요." };
  if (!isValidDate(input.patternStartDate)) return { ok: false, message: "패턴 시작일을 골라 주세요." };
  return { ok: true, teams: [...existing, { teamNo, patternStartDate: input.patternStartDate }] };
}

/** 다른 팀 하나를 지운 목록 */
export function removeOtherTeam(existing: readonly OtherTeam[], teamNo: string): OtherTeam[] {
  return existing.filter((t) => t.teamNo !== teamNo);
}
