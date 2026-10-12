// Design Ref: §7.2 — AI에게 받은 답을 앱이 검사한다: 출처가 후보 조문에 실제로 있는지, 3문장·200자 이내인지, 출처마다 기준일 붙이기
// Plan: 작업 29 — 답변 만들기. AI가 규칙을 어겨도 화면에는 규칙을 지킨 답만 나가게 하는 마지막 관문.
import type { Candidate } from "../laws/search";

/** 등록된 자료에 없을 때 고정 문구 (PRD 5장 ② 규칙 1) */
export const NOT_FOUND_MESSAGE = "등록된 자료에서 찾을 수 없습니다";

/** 현장 판단 질문에 붙는 고정 문구 (PRD 5장 ② 규칙 6) */
export const FIELD_JUDGMENT_NOTICE = "AI는 법률 조항만 안내할 뿐 현장 판단을 할 수 없습니다. 내부 지침이나 상급자의 지시를 따르세요.";

export const MAX_ANSWER_CHARS = 200;
export const MAX_ANSWER_SENTENCES = 3;

/** AI가 돌려주는 답의 모양 */
export interface RawAnswer {
  found: boolean;
  answer: string;
  sources: { law: string; article: string }[];
  fieldJudgment: boolean;
}

/** 화면에 보여 줄 출처 (기준일은 AI가 아니라 앱이 법령 파일에서 붙인다) */
export interface AnswerSource {
  law: string;
  article: string;
  title: string;
  baseDate: string;
}

export type FinalAnswer =
  | { kind: "answer"; text: string; sources: AnswerSource[]; fieldJudgment: boolean }
  | { kind: "not-found"; fieldJudgment: boolean };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** AI 응답 글에서 JSON 한 덩어리를 꺼낸다 (코드블록이나 앞뒤 설명이 붙어도 읽는다). 모양이 다르면 null */
export function parseAiAnswer(text: string): RawAnswer | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let value: unknown;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.found !== "boolean") return null;
  const answer = typeof value.answer === "string" ? value.answer : "";
  const sources: RawAnswer["sources"] = [];
  if (Array.isArray(value.sources)) {
    for (const s of value.sources) {
      if (isRecord(s) && typeof s.law === "string" && typeof s.article === "string") sources.push({ law: s.law, article: s.article });
    }
  }
  return { found: value.found, answer, sources, fieldJudgment: value.fieldJudgment === true };
}

const squash = (s: string) => s.replace(/\s+/g, "");

/** 조 번호 비교용: "제44조", "44조", "제 44 조" 모두 같게 */
function normalizeArticleNo(no: string): string {
  const s = squash(no);
  if (/^별표/.test(s)) return s;
  const m = s.match(/^제?(\d+)조(?:의(\d+))?$/);
  return m ? `제${m[1]}조${m[2] ? `의${m[2]}` : ""}` : s;
}

/** AI가 적은 출처가 후보 조문 중 어느 것인지 찾는다 (없으면 null = 지어낸 출처) */
function matchCandidate(source: { law: string; article: string }, candidates: Candidate[]): Candidate | null {
  const law = squash(source.law);
  const no = normalizeArticleNo(source.article);
  return candidates.find((c) => squash(c.lawName) === law && normalizeArticleNo(c.article.no) === no) ?? null;
}

/** 문장 단위로 나눈다 (마침표·물음표·느낌표 뒤에서) */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?。])\s+/)
    .filter((s) => s !== "");
}

/** 3문장·200자 이내로 줄인다. 뒤 문장부터 버리고, 한 문장이 너무 길면 잘라 …를 붙인다 */
export function limitAnswer(text: string): string {
  let sentences = splitSentences(text).slice(0, MAX_ANSWER_SENTENCES);
  while (sentences.length > 1 && sentences.join(" ").length > MAX_ANSWER_CHARS) sentences = sentences.slice(0, -1);
  const joined = sentences.join(" ");
  return joined.length <= MAX_ANSWER_CHARS ? joined : `${joined.slice(0, MAX_ANSWER_CHARS - 1).trimEnd()}…`;
}

/**
 * AI 답을 검사해 최종 답을 만든다.
 * - found가 false이거나 답이 비었거나 출처가 하나도 후보 조문과 맞지 않으면 → 찾을 수 없음
 * - 후보 조문에 없는 출처는 빼고, 남은 출처에 법령 파일의 기준일을 붙인다
 */
export function checkAnswer(raw: RawAnswer, candidates: Candidate[]): FinalAnswer {
  const notFound: FinalAnswer = { kind: "not-found", fieldJudgment: raw.fieldJudgment };
  if (!raw.found || raw.answer.trim() === "") return notFound;

  const sources: AnswerSource[] = [];
  for (const s of raw.sources) {
    const c = matchCandidate(s, candidates);
    if (c && !sources.some((x) => x.law === c.lawName && x.article === c.article.no)) {
      sources.push({ law: c.lawName, article: c.article.no, title: c.article.title, baseDate: c.baseDate });
    }
  }
  if (sources.length === 0) return notFound;

  return { kind: "answer", text: limitAnswer(raw.answer), sources, fieldJudgment: raw.fieldJudgment };
}
