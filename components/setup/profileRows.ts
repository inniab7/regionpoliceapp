// 등록 정보를 화면에 보여 줄 "항목: 내용" 목록으로 바꾼다 (등록 요약과 설정 화면이 함께 쓴다)
import { PATTERNS } from "@/lib/schedule/patterns";
import { FIRST_PROFILE_EFFECTIVE_FROM } from "@/lib/storage/profile";
import { formatShortDate } from "@/lib/time";
import type { Profile } from "@/lib/types";

export function profileRows(profile: Profile): [label: string, value: string][] {
  const def = PATTERNS[profile.pattern];
  const rows: [string, string][] = [
    ["소속청", profile.agency],
    ["부서", profile.department],
    ["팀", profile.team],
    ["근무 형태", def.cycle ? `${def.label} (${def.cycle.join(" → ")})` : def.label],
  ];
  if (profile.patternStartDate) rows.push(["패턴 시작일", formatShortDate(profile.patternStartDate)]);

  if (profile.pattern === 5) {
    rows.push(["근무 시간", "일근 09:00~18:00 (고정)"]);
  } else {
    for (const [kind, range] of Object.entries(profile.shiftTimes)) {
      const text =
        kind === "당직"
          ? `${range.start} 시작 · 24시간`
          : `${range.start} ~ ${range.end}${range.mealDeduct === false ? " · 식사 공제 안 함" : ""}`;
      rows.push([`${kind} 근무`, text]);
    }
  }
  if (profile.effectiveFrom !== FIRST_PROFILE_EFFECTIVE_FROM) rows.push(["적용일", profile.effectiveFrom]);
  return rows;
}
