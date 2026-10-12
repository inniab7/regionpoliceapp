// lib/ai/messages.ts 시험 — 상황별 화면 문구가 PRD·DESIGN의 문장과 같은지, 현장 판단 문구가 붙는지
import { describe, expect, it } from "vitest";
import type { AskResult } from "./ask";
import type { CallFailureReason } from "./call";
import { FIELD_JUDGMENT_NOTICE } from "./check";
import { MESSAGES, NOT_CONNECTED_VIEW, failureView, toView } from "./messages";

describe("고정 문구 (PRD 그대로)", () => {
  it("현장 판단 문구", () => {
    expect(FIELD_JUDGMENT_NOTICE).toBe("AI는 법률 조항만 안내할 뿐 현장 판단을 할 수 없습니다. 내부 지침이나 상급자의 지시를 따르세요.");
  });
  it("인터넷 끊김·연결 안 됨·잘못된 질문", () => {
    expect(MESSAGES.offline).toBe("인터넷 연결이 끊어져 처리할 수 없습니다");
    expect(MESSAGES.notConnected).toBe("AI를 먼저 연결해 주세요");
    expect(MESSAGES.invalidQuestion).toBe("질문을 다시 입력해 주세요 (500자까지)");
  });
  it("AI 미연결은 [AI 연결하기] 버튼으로 이어진다", () => {
    expect(NOT_CONNECTED_VIEW).toMatchObject({ kind: "notice", message: "AI를 먼저 연결해 주세요", action: "connect-ai" });
  });
});

describe("AI 호출 실패 → 화면", () => {
  it.each<[CallFailureReason | "bad-answer", string, string | null]>([
    ["offline", "인터넷 연결이 끊어져 처리할 수 없습니다", "retry"],
    ["invalid-key", "AI 키가 맞지 않아요. 설정에서 다시 연결해 주세요", "open-settings"],
    ["limit", "AI 사용 한도를 넘었어요. AI 회사 계정을 확인해 주세요", null],
    ["timeout", "잠시 후 다시 시도해 주세요", "retry"],
    ["unreachable", "잠시 후 다시 시도해 주세요", "retry"],
    ["unknown", "잠시 후 다시 시도해 주세요", "retry"],
    ["bad-response", "잠시 후 다시 시도해 주세요", "retry"],
    ["bad-answer", "잠시 후 다시 시도해 주세요", "retry"],
  ])("%s → %s", (reason, message, action) => {
    expect(failureView(reason)).toMatchObject({ kind: "notice", tone: "error", message, action });
  });
  it("모델 문제는 설정으로 안내", () => {
    expect(failureView("model")).toMatchObject({ tone: "error", action: "open-settings" });
  });
});

describe("질문 처리 결과 → 화면 (toView)", () => {
  it("빈 질문·500자 초과", () => {
    expect(toView({ kind: "invalid-question" })).toMatchObject({ message: "질문을 다시 입력해 주세요 (500자까지)", action: "edit-question" });
  });
  it("개인정보 감지: 종류만 알리고 내용은 다시 보여 주지 않는다", () => {
    const v = toView({ kind: "privacy", found: ["전화번호", "이름"], message: "x" });
    expect(v).toMatchObject({ kind: "notice", tone: "error", action: "edit-question" });
    expect(v.kind === "notice" && v.message).toBe("개인정보를 지우고 다시 물어봐 주세요 (전화번호·이름 감지)");
  });
  it("자료에 없음은 오류가 아니라 정상 안내(not-found)", () => {
    const r: AskResult = { kind: "not-found", answer: { kind: "not-found", fieldJudgment: false }, sentToAi: false };
    expect(toView(r)).toEqual({ kind: "notice", tone: "not-found", message: "등록된 자료에서 찾을 수 없습니다", action: null, fieldJudgmentNotice: null });
  });
  it("현장 판단 질문인데 자료에 없으면 고정 문구도 함께", () => {
    const r: AskResult = { kind: "not-found", answer: { kind: "not-found", fieldJudgment: true }, sentToAi: true };
    expect(toView(r)).toMatchObject({ fieldJudgmentNotice: FIELD_JUDGMENT_NOTICE });
  });
  it("답: 출처와 함께, 현장 판단이면 고정 문구", () => {
    const sources = [{ law: "형사소송법", article: "제212조", title: "현행범인의 체포", baseDate: "2026-10-02" }];
    const plain: AskResult = { kind: "answer", answer: { kind: "answer", text: "답", sources, fieldJudgment: false }, sentToAi: true };
    expect(toView(plain)).toEqual({ kind: "answer", text: "답", sources, fieldJudgmentNotice: null });
    const field: AskResult = { kind: "answer", answer: { kind: "answer", text: "답", sources, fieldJudgment: true }, sentToAi: true };
    expect(toView(field)).toMatchObject({ kind: "answer", fieldJudgmentNotice: FIELD_JUDGMENT_NOTICE });
  });
  it("AI 오류는 이유별 화면으로", () => {
    expect(toView({ kind: "ai-error", reason: "invalid-key" })).toMatchObject({ message: "AI 키가 맞지 않아요. 설정에서 다시 연결해 주세요" });
  });
});
