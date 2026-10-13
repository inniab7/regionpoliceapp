// lib/laws/lookup.ts 시험 — AI 없이 조문만 찾는 모드 (실제 법령 파일 사용)
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { LOOKUP_LIMIT, lookupArticles } from "./lookup";
import { buildSearchIndex, type SearchIndex } from "./search";
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

describe("조문 검색 모드", () => {
  it("음주운전 질문이면 도로교통법 제44조를 찾아 법령 이름·기준일과 함께 보여 준다", () => {
    const r = lookupArticles(index, "음주운전 기준이 어떻게 되나요?");
    expect(r.kind).toBe("found");
    if (r.kind !== "found") return;
    expect(r.items.length).toBeLessThanOrEqual(LOOKUP_LIMIT);
    const hit = r.items.find((i) => i.law === "도로교통법" && i.no === "제44조");
    expect(hit).toBeDefined();
    expect(hit?.baseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hit?.text.length).toBeGreaterThan(0);
  });

  it("빈 질문과 500자 초과는 invalid", () => {
    expect(lookupArticles(index, "   ").kind).toBe("invalid");
    expect(lookupArticles(index, "가".repeat(501)).kind).toBe("invalid");
  });

  it("개인정보(전화번호)가 있으면 검색하지 않고 안내만 한다", () => {
    const r = lookupArticles(index, "010-1234-5678 번호 음주운전");
    expect(r.kind).toBe("privacy");
  });

  it("관련 없는 질문은 not-found", () => {
    expect(lookupArticles(index, "zzzz qqqq").kind).toBe("not-found");
  });
});
