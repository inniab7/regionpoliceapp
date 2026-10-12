// 정답표(evals/questions.ts) 점검 — AI를 부르지 않고, 정답 조문이 법령에 실제로 있고 조문 찾기 후보 8개 안에 드는지 확인
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { EVAL_QUESTIONS } from "../../evals/questions";
import { buildSearchIndex, searchArticles, type SearchIndex } from "./search";
import { parseLawDocument, parseLawIndex } from "./types";

let index: SearchIndex;
beforeAll(() => {
  const read = (f: string): unknown => JSON.parse(readFileSync(`public/laws/${f}`, "utf8"));
  const idx = parseLawIndex(read("index.json"))!;
  index = buildSearchIndex(idx.laws.map((l) => ({ id: l.id, document: parseLawDocument(read(l.file))! })));
});

describe("정답표 20문항", () => {
  it("20개이고 번호가 1~20이다", () => {
    expect(EVAL_QUESTIONS.map((q) => q.no)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("정답 조문이 모두 법령에 실제로 있다", () => {
    for (const q of EVAL_QUESTIONS) {
      if (q.expect.type === "not-found") continue;
      for (const s of q.expect.sources) {
        const found = index.articles.some((a) => a.law.document.name === s.law && a.article.no === s.article);
        expect(found, `${q.no}번 ${s.law} ${s.article}`).toBe(true);
      }
    }
  });

  it("정답 조문 중 적어도 하나는 조문 찾기 후보 8개 안에 든다", () => {
    for (const q of EVAL_QUESTIONS) {
      if (q.expect.type === "not-found") continue;
      const sources = q.expect.sources;
      const cands = searchArticles(index, q.question);
      const hit = cands.some((c) => sources.some((s) => s.law === c.lawName && s.article === c.article.no));
      expect(hit, `${q.no}번 「${q.question}」 후보: ${cands.map((c) => `${c.lawName} ${c.article.no}`).join(", ")}`).toBe(true);
    }
  });

  it("등록 법령에 없는 질문(19번)은 '찾을 수 없음'이 정답이다 (후보가 몇 개 잡혀도 AI 단계에서 걸러야 한다)", () => {
    const q = EVAL_QUESTIONS.find((x) => x.no === 19)!;
    expect(q.expect).toEqual({ type: "not-found" });
  });
});
