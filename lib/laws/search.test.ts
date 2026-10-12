// lib/laws/search.ts 시험 — 실제 법령 파일(public/laws/)로 "이 질문이면 이 조문이 후보 8개 안에 든다"를 확인
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSearchIndex, expandSynonyms, searchArticles, stripSuffix, type SearchIndex } from "./search";
import { parseLawDocument, parseLawIndex } from "./types";

let index: SearchIndex;

beforeAll(() => {
  const read = (f: string): unknown => JSON.parse(readFileSync(`public/laws/${f}`, "utf8"));
  const idx = parseLawIndex(read("index.json"));
  if (!idx) throw new Error("index.json");
  index = buildSearchIndex(
    idx.laws.map((l) => {
      const document = parseLawDocument(read(l.file));
      if (!document) throw new Error(l.file);
      return { id: l.id, document };
    }),
  );
});

/** 후보 안에서 그 조문의 순위(1부터). 없으면 0 */
function rankOf(question: string, lawName: string, no: string, previous?: string[]): number {
  const found = searchArticles(index, question, { previous });
  return found.findIndex((c) => c.lawName === lawName && c.article.no === no) + 1;
}

describe("낱말 다듬기", () => {
  it("끝의 조사·어미를 뗀다 (2글자 이상 남을 때만)", () => {
    expect(stripSuffix("음주운전을")).toBe("음주운전");
    expect(stripSuffix("체포해도")).toBe("체포");
    expect(stripSuffix("검문에서")).toBe("검문");
    expect(stripSuffix("차가")).toBe("차가"); // 떼면 1글자가 되므로 그대로
  });
  it("동의어로 법령에 적힌 말을 덧붙인다", () => {
    expect(expandSynonyms("음주운전 하면 어떻게 되나요")[0]).toContain("술에 취한 상태");
    expect(expandSynonyms("아무 상관 없는 말")).toEqual([]);
  });
});

describe("질문 → 후보 조문 (실제 법령)", () => {
  // [질문, 법령, 들어 있어야 할 조문]
  it.each([
    ["음주운전 기준이 어떻게 되나요?", "도로교통법", "제44조"],
    ["술에 취한 상태에서 운전하면 어떻게 되나요", "도로교통법", "제44조"],
    ["무면허 운전은 처벌이 어떻게 되나요", "도로교통법", "제43조"],
    ["교통사고 후 도주하면 어떤 조치를 해야 하나요", "도로교통법", "제54조"],
    ["불심검문은 어떤 경우에 할 수 있나요?", "경찰관 직무집행법", "제3조"],
    ["술에 취한 사람을 보호조치 할 수 있나요", "경찰관 직무집행법", "제4조"],
    ["경찰장구 수갑은 언제 사용할 수 있나요", "경찰관 직무집행법", "제10조"],
    ["무기 사용 기준이 뭔가요", "경찰관 직무집행법", "제10조의4"],
    ["현행범인 체포는 누구나 할 수 있나요", "형사소송법", "제212조"],
    ["긴급체포 요건이 뭐예요", "형사소송법", "제200조의3"],
    ["절도죄 처벌은 어떻게 되나요", "형법", "제329조"],
    ["폭행죄는 어떻게 처벌하나요", "형법", "제260조"],
    ["공무집행방해죄가 뭔가요", "형법", "제136조"],
    ["정당방위는 언제 인정되나요", "형법", "제21조"],
    ["경범죄 노상방뇨는 어떻게 되나요", "경범죄 처벌법", "제3조"],
    ["주민등록번호 처리 제한 규정", "개인정보 보호법", "제24조의2"],
    ["개인정보 유출되면 어떻게 통지하나요", "개인정보 보호법", "제34조"],
  ])("%s → %s %s가 후보 8개 안에 든다", (question, lawName, no) => {
    const rank = rankOf(question, lawName, no);
    expect(rank, `${lawName} ${no} 순위`).toBeGreaterThan(0);
  });

  it("범칙금 질문은 시행령 범칙금 별표가 후보에 든다", () => {
    const found = searchArticles(index, "음주운전 범칙금 얼마예요");
    expect(found.some((c) => c.lawName === "도로교통법 시행령" && c.article.no === "별표 8")).toBe(true);
  });
});

describe("직접 지목·법령 이름·이어서 묻기", () => {
  it("'도로교통법 제44조'처럼 지목하면 그 조문이 1등", () => {
    expect(rankOf("도로교통법 제44조 내용 알려줘", "도로교통법", "제44조")).toBe(1);
  });
  it("법령 이름을 같이 쓰면 같은 번호라도 그 법령의 조문이 1등", () => {
    expect(rankOf("형법 제250조", "형법", "제250조")).toBe(1);
    expect(rankOf("도로교통법 시행령 별표 8", "도로교통법 시행령", "별표 8")).toBe(1);
  });
  it("직전 질문의 문맥을 약하게 반영한다 ('그럼 처벌은?')", () => {
    const withoutContext = searchArticles(index, "그럼 처벌은 어떻게 되나요");
    const withContext = rankOf("그럼 처벌은 어떻게 되나요", "도로교통법", "제148조의2", ["음주운전 기준이 뭔가요"]);
    expect(withContext).toBeGreaterThan(0);
    expect(withoutContext.some((c) => c.lawName === "도로교통법" && c.article.no === "제148조의2")).toBe(false);
  });
});

describe("관련 없는 질문", () => {
  it("법령과 상관없는 질문은 후보가 없다 (→ '등록된 자료에서 찾을 수 없습니다')", () => {
    expect(searchArticles(index, "오늘 저녁 메뉴 추천해줘")).toEqual([]);
    expect(searchArticles(index, "")).toEqual([]);
  });
  it("후보는 8개를 넘지 않고 점수 순이다", () => {
    const found = searchArticles(index, "운전 중 처벌");
    expect(found.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < found.length; i++) expect(found[i - 1].score).toBeGreaterThanOrEqual(found[i].score);
  });
});
