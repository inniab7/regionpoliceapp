// lib/privacy/detect.ts 시험 — 개인정보는 막고, 평범한 법령 질문은 통과시키는지
import { describe, expect, it } from "vitest";
import { detectPersonalInfo } from "./detect";

describe("주민등록번호", () => {
  it.each([
    "주민번호 900101-1234567 인 사람이 운전면허가 있나요",
    "9001011234567 조회가 되나요",
    "900101 1234567",
    "８００２０２－２２３４５６７", // 전각 숫자
    "외국인 등록 900101-5234567",
  ])("%s → 감지", (q) => expect(detectPersonalInfo(q)).toContain("주민등록번호"));

  it("월·일이 말이 안 되는 숫자는 주민번호로 보지 않는다", () => {
    expect(detectPersonalInfo("1234567890123")).not.toContain("주민등록번호");
    expect(detectPersonalInfo("901301-1234567")).not.toContain("주민등록번호");
  });
});

describe("전화번호", () => {
  it.each([
    "010-1234-5678로 연락하는 건 괜찮나요",
    "01012345678 번호로 문자",
    "010 1234 5678",
    "02-123-4567 번호",
    "031-123-4567 이 번호",
    "070-1234-5678",
    "010.1234.5678",
  ])("%s → 감지", (q) => expect(detectPersonalInfo(q)).toContain("전화번호"));

  it("전화번호가 아닌 숫자는 통과", () => {
    expect(detectPersonalInfo("범칙금 120000원이고 벌점 15점인가요")).toEqual([]);
    expect(detectPersonalInfo("112 신고 접수는 어떻게 하나요")).toEqual([]);
    expect(detectPersonalInfo("20261002 시행 법령")).toEqual([]);
  });
});

describe("차량번호", () => {
  it.each([
    "12가3456 차량이 신호위반을 했어요",
    "123가 4567 차량",
    "서울12가3456",
    "98호 1234 렌터카",
    "45마 1234",
  ])("%s → 감지", (q) => expect(detectPersonalInfo(q)).toContain("차량번호"));

  it("법 조문 번호나 날짜·금액은 차량번호가 아니다", () => {
    expect(detectPersonalInfo("도로교통법 제44조 1000만원")).toEqual([]);
    expect(detectPersonalInfo("제148조의2 3000만원 이하 벌금")).toEqual([]);
    expect(detectPersonalInfo("2026년 10월 12일 1234명")).toEqual([]);
  });
});

describe("이름으로 보이는 표현", () => {
  it.each([
    "홍길동 씨가 신고했는데 어떻게 처리하나요",
    "김철수씨를 체포할 수 있나요",
    "박철수 경위님께 보고",
    "피의자 홍길동을 체포하려면",
    "신고자 김영희가 진술했어요",
    "이름은 홍길동입니다",
    "성명: 최민수",
    "이영희 경사가 현장에",
  ])("%s → 감지", (q) => expect(detectPersonalInfo(q)).toContain("이름"));

  it("법률 용어는 이름으로 보지 않는다", () => {
    expect(detectPersonalInfo("피의자 신문 때 진술거부권을 알려야 하나요")).toEqual([]);
    expect(detectPersonalInfo("피의자 구속 요건이 뭔가요")).toEqual([]);
    expect(detectPersonalInfo("피해자 조사는 어디서 하나요")).toEqual([]);
    expect(detectPersonalInfo("신임 경위가 현장에서 해야 할 일")).toEqual([]);
    expect(detectPersonalInfo("주임 경사에게 보고하는 규정")).toEqual([]);
  });
});

describe("평범한 법령 질문은 통과", () => {
  it.each([
    "음주운전 기준이 어떻게 되나요?",
    "불심검문은 어떤 경우에 할 수 있나요?",
    "현행범인 체포는 누구나 할 수 있나요",
    "긴급체포 요건이 뭐예요",
    "절도죄 처벌은 어떻게 되나요",
    "경범죄 노상방뇨는 어떻게 되나요",
    "개인정보 유출되면 어떻게 통지하나요",
    "무면허 운전 범칙금은 얼마인가요",
    "도로교통법 제44조 내용 알려줘",
    "도로교통법 시행령 별표 8 보여줘",
    "어린이보호구역 속도 제한은?",
    "정당방위는 언제 인정되나요",
    "공무집행방해죄가 뭔가요",
    "술에 취한 사람을 보호조치 할 수 있나요",
    "그럼 처벌은 어떻게 되나요",
    "경찰장구 수갑은 언제 사용할 수 있나요",
    "임의동행을 거부하면 어떻게 되나요",
    "피의자에게 변호인 선임권을 알려야 하나요",
    "신고자 보호 규정이 있나요",
  ])("%s", (q) => expect(detectPersonalInfo(q)).toEqual([]));

  it("빈 질문", () => expect(detectPersonalInfo("")).toEqual([]));
});

describe("여러 종류가 함께 있으면 모두 알린다", () => {
  it("이름 + 전화번호 + 차량번호", () => {
    expect(detectPersonalInfo("홍길동 씨 010-1234-5678 차량 12가3456")).toEqual(["전화번호", "차량번호", "이름"]);
  });
});
