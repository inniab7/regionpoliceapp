// Design Ref: §5 ⑥ — 조문 찾기: 질문을 2글자 조각으로 나누고 동의어로 넓혀, 조문 제목·내용과 겹치는 정도로 점수를 매긴다
// Plan: 작업 27 — 조문 찾기. AI에 보낼 "후보 조문"(상위 8개)을 고른다. 순수 함수라 브라우저·서버 어디서나 시험할 수 있다.
// 점수가 낮은(겹치는 게 거의 없는) 조문은 후보에 넣지 않는다 → 후보가 없으면 "등록된 자료에서 찾을 수 없습니다"로 이어진다.
import { SYNONYM_RULES } from "./synonyms";
import type { LawArticle, LawDocument } from "./types";

/** 검색 대상으로 불러 둔 법령 하나 */
export interface LoadedLaw {
  id: string;
  document: LawDocument;
}

/** 찾은 후보 조문 */
export interface Candidate {
  lawId: string;
  lawName: string;
  baseDate: string;
  article: LawArticle;
  score: number;
}

interface IndexedArticle {
  law: LoadedLaw;
  article: LawArticle;
  titleGrams: Set<string>;
  textGrams: Set<string>;
  length: number;
}

export interface SearchIndex {
  articles: IndexedArticle[];
  /** 2글자 조각이 몇 개 조문에 나오는지 (드문 조각일수록 점수가 높다) */
  docFreq: Map<string, number>;
  lawNames: string[];
}

export interface SearchOptions {
  /** 직전 질문들 (이어서 묻는 경우의 문맥). 현재 질문보다 약하게 반영 */
  previous?: string[];
  /** 돌려줄 최대 개수 (기본 8) */
  limit?: number;
}

export const DEFAULT_LIMIT = 8;
/** 이 점수에 못 미치면 관련 없는 조문으로 보고 버린다 */
export const MIN_SCORE = 8;

const WORD_SPLIT = /[^0-9A-Za-z가-힣]+/;

/** 질문 끝에 붙는 조사·어미 (긴 것부터 떼어 낸다) */
const SUFFIXES = [
  "에서는", "으로는", "이라고", "에게는", "한테는", "하나요", "되나요", "인가요", "있나요", "없나요", "할까요", "합니까", "입니까", "되는지", "하는지", "인지",
  "에서", "으로", "에게", "한테", "까지", "부터", "라고", "하면", "되면", "해도", "하고", "이나", "에는", "에도", "으며", "이며", "처럼", "보다",
  "는데", "인데", "하나", "되나", "할까", "나요", "가요", "해요", "에요", "예요", "습니다", "입니다", "합니다",
  "를", "을", "은", "는", "이", "가", "의", "에", "도", "로", "와", "과", "만", "요", "며",
];

/** 질문에서 뜻이 없는 낱말(검색을 흐리는 말) */
const STOP_WORDS = new Set([
  "어떻게", "어떤", "무엇", "뭐", "언제", "어디", "경우", "때", "있나요", "되나요", "알려줘", "알려", "주세요", "궁금", "관련", "대해", "대한", "해당", "가능", "여부",
]);

/** 낱말 끝의 조사·어미를 떼어 낸다 (떼고 나서도 2글자 이상 남을 때만) */
export function stripSuffix(word: string): string {
  for (const s of SUFFIXES) {
    if (word.length - s.length >= 2 && word.endsWith(s)) return word.slice(0, -s.length);
  }
  return word;
}

/** 글을 낱말로 나눈다 */
function words(text: string): string[] {
  return text.toLowerCase().split(WORD_SPLIT).filter((w) => w !== "");
}

/** 낱말 하나를 2글자 조각으로 나눈다 ("음주운전" → 음주, 주운, 운전) */
function bigramsOfWord(word: string): string[] {
  const out: string[] = [];
  for (let i = 0; i + 2 <= word.length; i++) out.push(word.slice(i, i + 2));
  return out;
}

/** 조문 글(제목·본문)의 2글자 조각 */
function textGrams(text: string): Set<string> {
  const set = new Set<string>();
  for (const w of words(text)) for (const g of bigramsOfWord(w)) set.add(g);
  return set;
}

/** 질문의 2글자 조각 (조사를 뗀 낱말 기준). 낱말이 1글자뿐이면 건너뛴다 */
function queryGrams(text: string): Set<string> {
  const set = new Set<string>();
  for (const raw of words(text)) {
    if (STOP_WORDS.has(raw)) continue;
    const w = stripSuffix(raw);
    if (STOP_WORDS.has(w)) continue;
    for (const g of bigramsOfWord(w)) set.add(g);
  }
  return set;
}

/** 검색 준비: 조문마다 2글자 조각을 미리 뽑아 둔다 (법령을 불러온 뒤 한 번만) */
export function buildSearchIndex(laws: LoadedLaw[]): SearchIndex {
  const articles: IndexedArticle[] = [];
  const docFreq = new Map<string, number>();
  for (const law of laws) {
    for (const article of law.document.articles) {
      const grams = textGrams(`${article.no} ${article.title} ${article.text}`);
      for (const g of grams) docFreq.set(g, (docFreq.get(g) ?? 0) + 1);
      articles.push({
        law,
        article,
        titleGrams: textGrams(article.title),
        textGrams: grams,
        length: article.text.length,
      });
    }
  }
  return { articles, docFreq, lawNames: laws.map((l) => l.document.name) };
}

/** 질문에 들어 있는 동의어 규칙으로 넓힌 낱말들 (법령에 실제로 적힌 말) */
export function expandSynonyms(question: string): string[] {
  const squashed = question.toLowerCase().replace(/\s+/g, "");
  const out: string[] = [];
  for (const rule of SYNONYM_RULES) {
    if (rule.terms.some((t) => squashed.includes(t))) out.push(...rule.expand);
  }
  return out;
}

/** 질문에서 "도로교통법 제44조", "별표 8" 같은 직접 지목을 찾는다 */
function findReferences(question: string, lawNames: string[]): { lawName: string | null; no: string }[] {
  const refs: { lawName: string | null; no: string }[] = [];
  const names = [...lawNames].sort((a, b) => b.length - a.length);
  const re = /(?:제\s*(\d+)\s*조(?:\s*의\s*(\d+))?|별표\s*(\d+)(?:\s*의\s*(\d+))?)/g;
  for (const m of question.matchAll(re)) {
    const no = m[1] ? `제${m[1]}조${m[2] ? `의${m[2]}` : ""}` : `별표 ${m[3]}${m[4] ? `의${m[4]}` : ""}`;
    const before = question.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0).replace(/\s+/g, "");
    const lawName = names.find((n) => before.replace(/(의|에서|에|은|는)$/, "").endsWith(n.replace(/\s+/g, ""))) ?? null;
    refs.push({ lawName, no });
  }
  return refs;
}

/** 질문에서 언급한 법령 이름 (더 긴 이름에 포함된 짧은 이름은 따로 세지 않는다) */
function mentionedLaws(question: string, lawNames: string[]): Set<string> {
  let rest = question.replace(/\s+/g, "");
  const found = new Set<string>();
  for (const n of [...lawNames].sort((a, b) => b.length - a.length)) {
    const key = n.replace(/\s+/g, "");
    if (rest.includes(key)) {
      found.add(n);
      rest = rest.split(key).join(" ");
    }
  }
  return found;
}

/**
 * 질문과 관련 있는 조문을 점수 순으로 고른다.
 * - 현재 질문의 조각은 가중치 1, 동의어로 넓힌 조각은 0.8, 직전 질문의 조각은 0.4
 * - 조각 점수 = 가중치 × 드문 정도(idf) × (본문에 있으면 1 + 제목에 있으면 2 더)
 * - "제44조"처럼 직접 지목한 조문은 맨 앞으로
 */
export function searchArticles(index: SearchIndex, question: string, options: SearchOptions = {}): Candidate[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const total = Math.max(index.articles.length, 1);

  // 조각별 가중치 (같은 조각은 가장 높은 가중치 하나만)
  const weights = new Map<string, number>();
  const add = (grams: Iterable<string>, w: number) => {
    for (const g of grams) weights.set(g, Math.max(weights.get(g) ?? 0, w));
  };
  add(queryGrams(question), 1);
  for (const phrase of expandSynonyms(question)) add(queryGrams(phrase), 0.8);
  for (const prev of options.previous ?? []) {
    add(queryGrams(prev), 0.4);
    for (const phrase of expandSynonyms(prev)) add(queryGrams(phrase), 0.3);
  }

  const refs = findReferences(question, index.lawNames);
  const mentioned = mentionedLaws(question, index.lawNames);

  const scored: Candidate[] = [];
  for (const item of index.articles) {
    let score = 0;
    for (const [g, w] of weights) {
      const inText = item.textGrams.has(g);
      if (!inText) continue;
      const idf = Math.log(1 + total / (index.docFreq.get(g) ?? 1));
      score += w * idf * (1 + (item.titleGrams.has(g) ? 2 : 0));
    }
    // 긴 조문이 조각을 많이 품고 있다는 이유만으로 앞서지 않게 길이를 반영
    score /= 1 + 0.25 * Math.log(1 + item.length / 200);
    if (mentioned.has(item.law.document.name)) score *= 1.25;
    for (const r of refs) {
      if (r.no === item.article.no && (r.lawName === null || r.lawName === item.law.document.name)) {
        score += r.lawName ? 1000 : 50;
      }
    }
    if (score >= MIN_SCORE) {
      scored.push({
        lawId: item.law.id,
        lawName: item.law.document.name,
        baseDate: item.law.document.baseDate,
        article: item.article,
        score,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
