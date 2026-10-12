// lib/laws/load.ts 시험 — 버전 붙은 주소, 검사, 일부만 받아지면 실패
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { loadLaws } from "./load";

/** public/laws 안의 실제 파일을 돌려주는 가짜 fetch */
function fakeFetch(override: Record<string, () => Response> = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const path = url.replace("/laws/", "").split("?")[0];
    if (override[path]) return override[path]();
    return new Response(readFileSync(`public/laws/${path}`, "utf8"), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("법령 불러오기", () => {
  it("7종을 모두 받고, 파일 주소에 버전이 붙는다", async () => {
    const f = fakeFetch();
    const laws = await loadLaws(f, "/laws");
    expect(laws.map((l) => l.document.name)).toContain("도로교통법 시행령");
    expect(laws).toHaveLength(7);
    const urls = (f as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes("?v=2026"))).toHaveLength(7);
  });
  it("index.json은 매번 새 버전을 확인한다(no-cache)", async () => {
    const f = fakeFetch();
    await loadLaws(f, "/laws");
    const first = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(first[0])).toBe("/laws/index.json");
    expect((first[1] as RequestInit).cache).toBe("no-cache");
  });
  it("한 법령이라도 못 받으면 실패한다(일부 법령만으로 답하지 않는다)", async () => {
    const f = fakeFetch({ "road-traffic.json": () => new Response("x", { status: 404 }) });
    await expect(loadLaws(f, "/laws")).rejects.toThrow();
  });
  it("파일이 망가졌으면 실패한다", async () => {
    const f = fakeFetch({ "criminal-act.json": () => new Response('{"name":"형법"}', { status: 200 }) });
    await expect(loadLaws(f, "/laws")).rejects.toThrow();
  });
  it("index.json의 기준일과 파일의 기준일이 다르면 실패한다", async () => {
    const doc = JSON.parse(readFileSync("public/laws/minor-offenses.json", "utf8"));
    doc.baseDate = "2000-01-01";
    const f = fakeFetch({ "minor-offenses.json": () => new Response(JSON.stringify(doc), { status: 200 }) });
    await expect(loadLaws(f, "/laws")).rejects.toThrow();
  });
  it("인터넷이 끊겨 요청 자체가 실패하면 실패한다", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(loadLaws(f, "/laws")).rejects.toThrow();
  });
});
