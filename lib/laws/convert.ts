// Design Ref: §6.3 — 국가법령정보센터 공개 API(JSON) 원문을 현답 법령 파일 모양으로 바꾼다
// Plan: 작업 26 — 법령 문서 준비. `scripts/fetch-laws.mjs`가 쓴다. 순수 함수라 인터넷 없이 시험할 수 있다.
// 이 파일은 Node가 직접 읽으므로 가져오기는 `import type`만 쓴다.
import type { LawArticle, LawDocument } from "./types";

type Json = Record<string, unknown>;

const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** 원문은 값이 하나면 객체, 여럿이면 배열로 온다. 항상 배열로 맞춘다 */
function asArray(v: unknown): unknown[] {
  if (v === undefined || v === null || v === "") return [];
  return Array.isArray(v) ? v : [v];
}

/** 문자열이나 (여러 겹의) 문자열 배열을 한 줄씩 펴서 모은다 */
function flattenStrings(v: unknown, trim = true): string[] {
  if (typeof v === "string") return v.trim() === "" ? [] : [trim ? v.trim() : v];
  if (Array.isArray(v)) return v.flatMap((x) => flattenStrings(x, trim));
  return [];
}

/** 호 안의 목(가, 나, 다…)까지 줄로 모은다 */
function hoLines(ho: unknown): string[] {
  if (!isRecord(ho)) return [];
  const lines = flattenStrings(ho["호내용"]);
  for (const mok of asArray(ho["목"])) {
    if (isRecord(mok)) lines.push(...flattenStrings(mok["목내용"]));
  }
  return lines;
}

/** 항 → 항 줄 + 그 아래 호·목 줄 */
function hangLines(hang: unknown): string[] {
  if (!isRecord(hang)) return [];
  const lines = flattenStrings(hang["항내용"]);
  for (const ho of asArray(hang["호"])) lines.push(...hoLines(ho));
  return lines;
}

/** "20261002" → "2026-10-02". 모양이 다르면 null */
export function toIsoDate(yyyymmdd: unknown): string | null {
  if (typeof yyyymmdd !== "string" || !/^\d{8}$/.test(yyyymmdd)) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/** 조문 한 건 → LawArticle. 장·절 제목(조문여부 "전문")이나 번호 없는 건 null */
function convertArticle(unit: unknown): LawArticle | null {
  if (!isRecord(unit) || unit["조문여부"] !== "조문") return null;
  const num = String(unit["조문번호"] ?? "").trim();
  if (num === "") return null;
  const branch = String(unit["조문가지번호"] ?? "").trim();
  const no = `제${num}조${branch ? `의${branch}` : ""}`;
  const lines = [...flattenStrings(unit["조문내용"])];
  for (const hang of asArray(unit["항"])) lines.push(...hangLines(hang));
  const text = lines.join("\n");
  if (text === "") return null;
  return { no, title: typeof unit["조문제목"] === "string" ? unit["조문제목"].trim() : "", text };
}

/** 표 테두리(┏━┯┓ 등)만 있는 줄인지 */
const BORDER_ONLY = /^[\s┏┓┗┛┠┨┯┷┼┬┴┣┫╋━─┃│]*$/;

/** 표 안에서 새 항목이 시작하는 줄인지 ("4. …", "5의2. …", "1) …", "가. …", "① …") */
const NEW_ITEM = /^(\d+(의\d+)?\.|\d+\)|[가-하]\.|[①-⑳])/;

/** 표 칸 하나의 글자를 정리한다 */
function cellText(c: string): string {
  return c.replace(/\s+/g, " ").trim();
}

/**
 * 표의 한 묶음(┠ 줄 사이)을 한 줄로 합친다.
 * 별표는 여러 행위가 금액칸 하나를 함께 쓰는 경우가 많다(칸 합치기). 줄마다 나열하면 금액이 엉뚱한 행위 줄에 붙어 보이므로,
 * 묶음 안의 칸을 세로로 이어 "행위들 | 근거 조문 | 금액들"로 만든다. 같은 칸 안의 항목은 " / "로 나눈다.
 * 줄마다 칸 수가 다르면(안쪽 표 등) 합치지 않고 줄 단위로 둔다.
 */
function mergeTableBlock(block: string[][]): string[] {
  if (block.length === 0) return [];
  const cols = Math.max(...block.map((r) => r.length));
  if (block.some((r) => r.length !== cols)) {
    return block.map((r) => r.map(cellText).join(" | ")).filter((l) => l.replace(/[\s|]/g, "") !== "");
  }
  const merged: string[] = [];
  for (let c = 0; c < cols; c++) {
    const segments: string[] = [];
    for (const row of block) {
      const t = cellText(row[c]);
      if (t === "") continue;
      if (segments.length === 0 || NEW_ITEM.test(t)) segments.push(t);
      else segments[segments.length - 1] += ` ${t}`;
    }
    merged.push(segments.join(" / "));
  }
  return merged.every((m) => m === "") ? [] : [merged.join(" | ")];
}

/** 별표 본문 줄들을 읽기 쉽게 바꾼다 (표는 묶음 단위로, 표가 아닌 줄은 그대로) */
export function cleanAnnexLines(lines: string[]): string[] {
  const out: string[] = [];
  let block: string[][] = [];
  const flush = () => {
    out.push(...mergeTableBlock(block));
    block = [];
  };
  for (const line of lines) {
    if (BORDER_ONLY.test(line)) {
      // ┠(묶음 사이 가로줄), ┏(표 시작), ┗(표 끝)이면 지금까지 모은 묶음을 마무리한다. 빈 칸만 있는 줄은 건너뛴다
      if (/[┠┏┗┣╋]/.test(line)) flush();
      continue;
    }
    if (/[┃│]/.test(line)) {
      const cells = line.split(/[┃│]/);
      if (/^\s*[┃│]/.test(line)) cells.shift();
      if (/[┃│]\s*$/.test(line)) cells.pop();
      block.push(cells);
    } else {
      flush();
      if (line.trim() !== "") out.push(line.trim());
    }
  }
  flush();
  return out;
}

/** 별표 한 건 → LawArticle (예: no "별표 8"). 삭제된 별표나 내용 없는 별표는 null */
function convertAnnex(unit: unknown): LawArticle | null {
  if (!isRecord(unit) || unit["별표구분"] !== "별표") return null;
  const title = typeof unit["별표제목"] === "string" ? unit["별표제목"].trim() : "";
  if (title === "" || title.startsWith("삭제")) return null;
  const num = parseInt(String(unit["별표번호"] ?? ""), 10);
  if (!Number.isFinite(num)) return null;
  const branch = parseInt(String(unit["별표가지번호"] ?? "0"), 10);
  const no = `별표 ${num}${branch > 0 ? `의${branch}` : ""}`;
  const lines = cleanAnnexLines(flattenStrings(unit["별표내용"], false));
  if (lines.length === 0) return null;
  return { no, title, text: lines.join("\n") };
}

/** API 응답(JSON)을 법령 파일로 바꾼다(조문 + 별표). 법령 이름이 기대와 다르거나 조문이 없으면 null */
export function convertLaw(raw: unknown, expectedName: string): LawDocument | null {
  if (!isRecord(raw) || !isRecord(raw["법령"])) return null;
  const law = raw["법령"];
  const info = law["기본정보"];
  if (!isRecord(info) || info["법령명_한글"] !== expectedName) return null;
  const baseDate = toIsoDate(info["시행일자"]);
  if (!baseDate) return null;
  const jo = law["조문"];
  const units = isRecord(jo) ? asArray(jo["조문단위"]) : [];
  const articles = units.map(convertArticle).filter((a): a is LawArticle => a !== null);
  if (articles.length === 0) return null;
  // 별표(표)도 조문 목록 뒤에 붙인다 (예: 범칙금액표)
  const annexes = isRecord(law["별표"]) ? asArray(law["별표"]["별표단위"]) : [];
  articles.push(...annexes.map(convertAnnex).filter((a): a is LawArticle => a !== null));
  return { name: expectedName, baseDate, source: "국가법령정보센터", articles };
}

/** 검색 결과(법령 목록)에서 이름이 정확히 같은 현행 법령의 일련번호를 찾는다 */
export function findLawSerial(searchRaw: unknown, name: string): string | null {
  if (!isRecord(searchRaw) || !isRecord(searchRaw["LawSearch"])) return null;
  for (const item of asArray(searchRaw["LawSearch"]["law"])) {
    if (!isRecord(item)) continue;
    if (item["법령명한글"] === name && item["현행연혁코드"] === "현행" && typeof item["법령일련번호"] === "string") {
      return item["법령일련번호"];
    }
  }
  return null;
}
