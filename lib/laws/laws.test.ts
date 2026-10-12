// lib/laws/ 시험 — 원문 변환, 검사, 그리고 public/laws/ 에 실제로 들어 있는 7종 파일 점검
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convertLaw, findLawSerial, toIsoDate } from "./convert";
import { DEFAULT_LAWS, parseLawDocument, parseLawIndex } from "./types";

const readJson = (file: string): unknown => JSON.parse(readFileSync(`public/laws/${file}`, "utf8"));

const sample = {
  법령: {
    기본정보: { 법령명_한글: "시험법", 시행일자: "20261002" },
    조문: {
      조문단위: [
        { 조문번호: "1", 조문여부: "전문", 조문내용: "        제1장 총칙" },
        { 조문번호: "1", 조문여부: "조문", 조문제목: "목적", 조문내용: "제1조(목적) 이 법은 시험을 위한 것이다." },
        {
          조문번호: "3",
          조문여부: "조문",
          조문제목: "범칙행위",
          조문내용: "제3조(범칙행위)",
          항: [
            {
              항내용: "① 다음 각 호에 해당하는 사람은 벌금에 처한다.",
              호: [
                { 호내용: "1. 첫째" },
                { 호내용: "2. 둘째", 목: [{ 목내용: [["가. 하나"], ["나. 둘"]] }] },
              ],
            },
          ],
        },
        // 항이 하나뿐이면 배열이 아니라 객체로 온다
        { 조문번호: "3", 조문가지번호: "2", 조문여부: "조문", 조문제목: "가지", 조문내용: "제3조의2(가지) 내용", 항: { 항내용: "① 하나뿐인 항" } },
      ],
    },
  },
};

describe("원문 변환 (convertLaw)", () => {
  const doc = convertLaw(sample, "시험법");

  it("기준일은 시행일자이고 출처가 붙는다", () => {
    expect(doc?.baseDate).toBe("2026-10-02");
    expect(doc?.source).toBe("국가법령정보센터");
  });
  it("장 제목은 빼고 조문만 담는다", () => {
    expect(doc?.articles.map((a) => a.no)).toEqual(["제1조", "제3조", "제3조의2"]);
  });
  it("항·호·목이 줄로 이어진다", () => {
    expect(doc?.articles[1].text.split("\n")).toEqual([
      "제3조(범칙행위)",
      "① 다음 각 호에 해당하는 사람은 벌금에 처한다.",
      "1. 첫째",
      "2. 둘째",
      "가. 하나",
      "나. 둘",
    ]);
  });
  it("항이 객체 하나로 와도 읽는다", () => {
    expect(doc?.articles[2].text).toContain("① 하나뿐인 항");
  });
  it("법령 이름이 다르면 쓰지 않는다 (엉뚱한 법령 방지)", () => {
    expect(convertLaw(sample, "다른법")).toBeNull();
  });
  it("조문이 없거나 모양이 다르면 null", () => {
    expect(convertLaw({}, "시험법")).toBeNull();
    expect(convertLaw({ 법령: { 기본정보: { 법령명_한글: "시험법", 시행일자: "20261002" }, 조문: {} } }, "시험법")).toBeNull();
    expect(convertLaw({ 법령: { 기본정보: { 법령명_한글: "시험법", 시행일자: "오늘" }, 조문: {} } }, "시험법")).toBeNull();
  });
  it("날짜 바꾸기", () => {
    expect(toIsoDate("20260701")).toBe("2026-07-01");
    expect(toIsoDate("2026")).toBeNull();
  });
});

describe("검색 결과에서 법령 찾기 (findLawSerial)", () => {
  const search = {
    LawSearch: {
      law: [
        { 법령명한글: "도로교통법 시행령", 현행연혁코드: "현행", 법령일련번호: "2" },
        { 법령명한글: "도로교통법", 현행연혁코드: "현행", 법령일련번호: "1" },
      ],
    },
  };
  it("이름이 정확히 같은 법령만 고른다", () => {
    expect(findLawSerial(search, "도로교통법")).toBe("1");
    expect(findLawSerial(search, "도로교통법 시행령")).toBe("2");
    expect(findLawSerial(search, "형법")).toBeNull();
  });
});

describe("검사 (parseLawIndex·parseLawDocument)", () => {
  const entry = { id: "a", name: "가법", baseDate: "2026-10-02", version: "v1", file: "a.json" };
  it("올바른 index.json을 읽는다", () => {
    expect(parseLawIndex({ laws: [entry] })?.laws).toHaveLength(1);
  });
  it.each([
    ["법령 목록 없음", {}],
    ["기준일 모양 다름", { laws: [{ ...entry, baseDate: "20261002" }] }],
    ["파일 이름에 경로", { laws: [{ ...entry, file: "../x.json" }] }],
    ["버전 없음", { laws: [{ ...entry, version: "" }] }],
    ["id 중복", { laws: [entry, entry] }],
  ])("%s → null", (_, v) => expect(parseLawIndex(v)).toBeNull());

  it("조문이 비어 있는 법령 파일은 쓰지 않는다", () => {
    expect(parseLawDocument({ name: "가법", baseDate: "2026-10-02", source: "x", articles: [] })).toBeNull();
    expect(
      parseLawDocument({ name: "가법", baseDate: "2026-10-02", source: "x", articles: [{ no: "제1조", title: "", text: "" }] }),
    ).toBeNull();
  });
});

describe("public/laws/ 실제 파일 (기본 7종)", () => {
  const index = parseLawIndex(readJson("index.json"));

  it("index.json이 올바르고 기본 7종이 모두 있다", () => {
    expect(index).not.toBeNull();
    expect(index?.laws.map((l) => l.name)).toEqual(DEFAULT_LAWS.map((l) => l.name));
  });

  it.each(DEFAULT_LAWS.map((l) => [l.name, l.id]))("%s 파일이 올바르고 index.json과 기준일이 같다", (name, id) => {
    const entry = index?.laws.find((l) => l.id === id);
    expect(entry).toBeDefined();
    const doc = parseLawDocument(readJson(entry!.file));
    expect(doc).not.toBeNull();
    expect(doc!.name).toBe(name);
    expect(doc!.baseDate).toBe(entry!.baseDate);
    const nos = doc!.articles.map((a) => a.no);
    expect(new Set(nos).size).toBe(nos.length); // 같은 조문 번호가 두 번 나오지 않는다
  });

  it("대표 조문이 들어 있다 (도로교통법 제44조, 경찰관 직무집행법 제3조)", () => {
    const find = (id: string, no: string) => {
      const doc = parseLawDocument(readJson(`${id}.json`));
      return doc?.articles.find((a) => a.no === no);
    };
    expect(find("road-traffic", "제44조")?.title).toBe("술에 취한 상태에서의 운전 금지");
    expect(find("police-duties", "제3조")?.title).toBe("불심검문");
    expect(find("criminal-act", "제329조")?.title).toBe("절도");
  });
});
