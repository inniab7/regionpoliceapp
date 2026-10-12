// Design Ref: §7.3 — 오류·예외 처리: 상황별 화면 문구. 질문 처리 결과(AskResult)를 화면이 그대로 그릴 수 있는 모양으로 바꾼다.
// Plan: 작업 30 — 예외 답변. 문구는 PRD·DESIGN의 문장 그대로이고, 문구를 고칠 때는 이 한 곳만 고친다.
import { FIELD_JUDGMENT_NOTICE, NOT_FOUND_MESSAGE, type AnswerSource } from "./check";
import type { AskResult } from "./ask";
import type { CallFailureReason } from "./call";
import { MAX_QUESTION_CHARS } from "./ask";

/** 화면이 누르게 할 버튼 (없으면 안내만) */
export type NoticeAction = "connect-ai" | "open-settings" | "edit-question" | "retry";

/** 화면에 그릴 결과 */
export type AskView =
  | {
      kind: "answer";
      text: string;
      sources: AnswerSource[];
      /** 현장 판단 질문이면 고정 문구 */
      fieldJudgmentNotice: string | null;
    }
  | {
      kind: "notice";
      /** not-found: 자료에 없음(정상 응답) / error: 처리하지 못함 */
      tone: "not-found" | "error";
      message: string;
      action: NoticeAction | null;
      fieldJudgmentNotice: string | null;
    };

export const MESSAGES = {
  notConnected: "AI를 먼저 연결해 주세요",
  invalidQuestion: `질문을 다시 입력해 주세요 (${MAX_QUESTION_CHARS}자까지)`,
  privacy: "개인정보를 지우고 다시 물어봐 주세요",
  offline: "인터넷 연결이 끊어져 처리할 수 없습니다",
  invalidKey: "AI 키가 맞지 않아요. 설정에서 다시 연결해 주세요",
  limit: "AI 사용 한도를 넘었어요. AI 회사 계정을 확인해 주세요",
  retryLater: "잠시 후 다시 시도해 주세요",
  modelChanged: "AI 회사 쪽 사정으로 연결되지 않았어요. 잠시 후 다시 시도하거나 설정에서 다른 AI를 골라 보세요",
} as const;

/** AI가 아직 연결되지 않았을 때 (질문을 보내기 전에 화면이 먼저 확인) */
export const NOT_CONNECTED_VIEW: AskView = {
  kind: "notice",
  tone: "error",
  message: MESSAGES.notConnected,
  action: "connect-ai",
  fieldJudgmentNotice: null,
};

function errorView(message: string, action: NoticeAction | null): AskView {
  return { kind: "notice", tone: "error", message, action, fieldJudgmentNotice: null };
}

/** AI 호출 실패 이유 → 화면 문구 (DESIGN 7.3 표) */
export function failureView(reason: CallFailureReason | "bad-answer"): AskView {
  switch (reason) {
    case "offline":
      return errorView(MESSAGES.offline, "retry");
    case "invalid-key":
      return errorView(MESSAGES.invalidKey, "open-settings");
    case "limit":
      return errorView(MESSAGES.limit, null);
    case "model":
      return errorView(MESSAGES.modelChanged, "open-settings");
    case "timeout":
    case "unreachable":
    case "bad-response":
    case "bad-answer":
    case "unknown":
      return errorView(MESSAGES.retryLater, "retry");
  }
}

/** 질문 처리 결과 → 화면 */
export function toView(result: AskResult): AskView {
  switch (result.kind) {
    case "invalid-question":
      return errorView(MESSAGES.invalidQuestion, "edit-question");
    case "privacy":
      // 감지된 내용 자체는 다시 보여 주지 않고 종류만 알린다
      return errorView(`${MESSAGES.privacy} (${result.found.join("·")} 감지)`, "edit-question");
    case "ai-error":
      return failureView(result.reason);
    case "not-found":
      return {
        kind: "notice",
        tone: "not-found",
        message: NOT_FOUND_MESSAGE,
        action: null,
        fieldJudgmentNotice: result.answer.fieldJudgment ? FIELD_JUDGMENT_NOTICE : null,
      };
    case "answer":
      if (result.answer.kind !== "answer") return toView({ ...result, kind: "not-found" });
      return {
        kind: "answer",
        text: result.answer.text,
        sources: result.answer.sources,
        fieldJudgmentNotice: result.answer.fieldJudgment ? FIELD_JUDGMENT_NOTICE : null,
      };
  }
}
