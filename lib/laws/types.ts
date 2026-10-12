// Design Ref: §6.3 — 법령 문서 (`public/laws/`): index.json(법령별 기준일·버전)과 법령 파일 하나의 모양, 그리고 읽을 때의 검사
// Plan: 작업 26 — 법령 문서 준비. 파일이 망가졌거나 모양이 다르면 쓰지 않고 null을 돌려준다(잘못된 조문으로 답하지 않기 위해).

/** 법령 한 조문 */
export interface LawArticle {
  /** 조문 번호 (예: "제44조", "제3조의2") */
  no: string;
  /** 조문 제목 (예: "술에 취한 상태에서의 운전 금지") */
  title: string;
  /** 조문 전문 (항·호·목 포함, 줄바꿈으로 구분) */
  text: string;
}

/** 법령 파일 하나 */
export interface LawDocument {
  name: string;
  /** 기준일 "YYYY-MM-DD" (현행 법령의 시행일) */
  baseDate: string;
  source: string;
  articles: LawArticle[];
}

/** index.json 안의 법령 한 건 */
export interface LawIndexEntry {
  id: string;
  name: string;
  baseDate: string;
  /** 바뀌면 사용자 기기가 법령 파일을 다시 받는다 */
  version: string;
  file: string;
}

export interface LawIndex {
  laws: LawIndexEntry[];
}

/** 기본 법령 7종 (CLAUDE.md 5장). id는 파일 이름이 된다 */
export const DEFAULT_LAWS: readonly { id: string; name: string }[] = [
  { id: "criminal-act", name: "형법" },
  { id: "minor-offenses", name: "경범죄 처벌법" },
  { id: "road-traffic", name: "도로교통법" },
  { id: "road-traffic-decree", name: "도로교통법 시행령" },
  { id: "criminal-procedure", name: "형사소송법" },
  { id: "police-duties", name: "경찰관 직무집행법" },
  { id: "personal-info", name: "개인정보 보호법" },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FILE = /^[a-z0-9-]+\.json$/; // 주소를 건드리는 이름(../ 등)은 받지 않는다

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** index.json을 검사해 읽는다. 하나라도 이상하면 null */
export function parseLawIndex(value: unknown): LawIndex | null {
  if (!isRecord(value) || !Array.isArray(value.laws)) return null;
  const laws: LawIndexEntry[] = [];
  const ids = new Set<string>();
  for (const e of value.laws) {
    if (!isRecord(e)) return null;
    if (!isNonEmptyString(e.id) || !isNonEmptyString(e.name) || !isNonEmptyString(e.version)) return null;
    if (typeof e.baseDate !== "string" || !DATE.test(e.baseDate)) return null;
    if (typeof e.file !== "string" || !FILE.test(e.file)) return null;
    if (ids.has(e.id)) return null;
    ids.add(e.id);
    laws.push({ id: e.id, name: e.name, baseDate: e.baseDate, version: e.version, file: e.file });
  }
  return { laws };
}

/** 법령 파일 하나를 검사해 읽는다. 조문이 하나도 없거나 이상하면 null */
export function parseLawDocument(value: unknown): LawDocument | null {
  if (!isRecord(value) || !Array.isArray(value.articles)) return null;
  if (!isNonEmptyString(value.name) || !isNonEmptyString(value.source)) return null;
  if (typeof value.baseDate !== "string" || !DATE.test(value.baseDate)) return null;
  const articles: LawArticle[] = [];
  for (const a of value.articles) {
    if (!isRecord(a)) return null;
    if (!isNonEmptyString(a.no) || typeof a.title !== "string" || !isNonEmptyString(a.text)) return null;
    articles.push({ no: a.no, title: a.title, text: a.text });
  }
  if (articles.length === 0) return null;
  return { name: value.name, baseDate: value.baseDate, source: value.source, articles };
}
