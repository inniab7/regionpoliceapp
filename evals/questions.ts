// Design Ref: §9 — 규정 질문 정답표 (PRD 성공 기준 5: 질문 20개 중 18개 이상 정답, 모든 답에 출처)
// Plan: 작업 32 — 정답률 검증. **Claude가 쓴 초안이며 Yuni가 검토·수정해 확정한다.**
//
// 채점 방법(자동):
//   answer    → 등록 법령 안에서 답했고, 출처 중 하나가 `sources`에 있고, `facts`가 있으면 답에 모두 들어 있어야 정답
//   not-found → 등록된 자료에서 찾을 수 없다고 답하면 정답 (등록 법령에 없는 내용을 지어내면 오답)
//   field     → 현장 판단 질문: 고정 문구가 붙고, (답을 했다면) 출처가 `sources`에 있으면 정답
// `keyPoint`는 사람이 읽고 확인하는 정답 요지다(자동 채점에는 쓰지 않음). 리포트에 AI 답과 나란히 나온다.

export interface SourceRef {
  law: string;
  article: string;
}

export type Expectation =
  | { type: "answer"; sources: SourceRef[] }
  | { type: "not-found" }
  | { type: "field"; sources: SourceRef[] };

export interface EvalQuestion {
  no: number;
  question: string;
  expect: Expectation;
  /** 정답 요지 (Yuni 검토용) */
  keyPoint: string;
  /** 답에 꼭 들어 있어야 하는 핵심 낱말·숫자 (출처만 맞고 내용이 틀린 답을 잡는다). 없으면 출처만 본다 */
  facts?: string[];
}

export const EVAL_QUESTIONS: EvalQuestion[] = [
  { no: 1, question: "음주운전으로 단속되는 혈중알코올농도 기준이 어떻게 되나요?", expect: { type: "answer", sources: [{ law: "도로교통법", article: "제44조" }] }, keyPoint: "혈중알코올농도 0.03퍼센트 이상이면 술에 취한 상태로 운전 금지", facts: ["0.03"] },
  { no: 2, question: "음주 측정을 거부하면 어떻게 되나요?", expect: { type: "answer", sources: [{ law: "도로교통법", article: "제44조" }, { law: "도로교통법", article: "제148조의2" }] }, keyPoint: "경찰공무원의 측정 요구에 응할 의무가 있고, 거부하면 제148조의2에 따라 처벌" },
  { no: 3, question: "운전면허 없이 운전하면 안 되나요?", expect: { type: "answer", sources: [{ law: "도로교통법", article: "제43조" }] }, keyPoint: "면허를 받지 않거나 효력이 정지된 경우 자동차 등을 운전해서는 안 됨(무면허운전 금지)" },
  { no: 4, question: "교통사고가 났을 때 운전자는 어떤 조치를 해야 하나요?", expect: { type: "answer", sources: [{ law: "도로교통법", article: "제54조" }] }, keyPoint: "즉시 정차, 사상자 구호, 경찰 신고 등 사고발생 시의 조치" },
  { no: 5, question: "운전 중에 휴대전화를 사용해도 되나요?", expect: { type: "answer", sources: [{ law: "도로교통법", article: "제49조" }] }, keyPoint: "운전 중 휴대용 전화 사용 금지(자동차 등이 정지한 경우 등 예외는 조문 확인)" },
  { no: 6, question: "도로교통법상 범칙금 통고처분은 누가 하나요?", expect: { type: "answer", sources: [{ law: "도로교통법", article: "제163조" }] }, keyPoint: "경찰서장 등이 범칙자에게 범칙금 납부통고서로 통고처분" },
  { no: 7, question: "승용자동차가 신호를 위반했을 때 범칙금은 얼마인가요?", expect: { type: "answer", sources: [{ law: "도로교통법 시행령", article: "별표 8" }] }, keyPoint: "시행령 별표 8의 신호·지시 위반 항목 중 승용자동차등 금액", facts: ["6만원"] },
  { no: 8, question: "불심검문은 어떤 경우에 할 수 있나요?", expect: { type: "answer", sources: [{ law: "경찰관 직무집행법", article: "제3조" }] }, keyPoint: "죄를 범하였거나 범하려 한다고 의심할 만한 상당한 이유가 있는 사람 등을 정지시켜 질문" },
  { no: 9, question: "술에 취한 사람을 보호조치 할 수 있는 요건이 뭔가요?", expect: { type: "answer", sources: [{ law: "경찰관 직무집행법", article: "제4조" }] }, keyPoint: "정신착란·술에 취해 자신 또는 다른 사람의 생명·신체·재산에 위해를 끼칠 우려 등(구호대상자)" },
  { no: 10, question: "경찰장구는 언제 사용할 수 있나요?", expect: { type: "answer", sources: [{ law: "경찰관 직무집행법", article: "제10조의2" }] }, keyPoint: "현행범 체포·도주 방지, 자기·타인 생명 보호 등 직무수행에 필요한 한도에서" },
  { no: 11, question: "현행범인은 누구나 체포할 수 있나요?", expect: { type: "answer", sources: [{ law: "형사소송법", article: "제212조" }] }, keyPoint: "현행범인은 누구든지 영장 없이 체포할 수 있다" },
  { no: 12, question: "긴급체포는 어떤 요건에서 할 수 있나요?", expect: { type: "answer", sources: [{ law: "형사소송법", article: "제200조의3" }] }, keyPoint: "장기 3년 이상 징역·금고에 해당하는 죄, 증거인멸·도망 우려 등 긴급을 요하고 영장을 받을 수 없을 때", facts: ["3년"] },
  { no: 13, question: "피의자를 체포할 때 고지해야 하는 내용은 무엇인가요?", expect: { type: "answer", sources: [{ law: "형사소송법", article: "제200조의5" }] }, keyPoint: "피의사실의 요지, 체포의 이유, 변호인 선임 가능, 변명할 기회" },
  { no: 14, question: "절도죄는 어떻게 처벌되나요?", expect: { type: "answer", sources: [{ law: "형법", article: "제329조" }] }, keyPoint: "6년 이하의 징역 또는 1천만원 이하의 벌금", facts: ["6년", "1천만원"] },
  { no: 15, question: "공무집행방해죄의 처벌은 어떻게 되나요?", expect: { type: "answer", sources: [{ law: "형법", article: "제136조" }] }, keyPoint: "직무를 집행하는 공무원에 대한 폭행·협박: 5년 이하 징역 또는 1천만원 이하 벌금", facts: ["5년"] },
  { no: 16, question: "정당방위는 언제 인정되나요?", expect: { type: "answer", sources: [{ law: "형법", article: "제21조" }] }, keyPoint: "현재의 부당한 침해로부터 자기 또는 타인의 법익을 방위하기 위한 상당한 이유 있는 행위" },
  { no: 17, question: "길에서 함부로 소변을 보면 경범죄인가요?", expect: { type: "answer", sources: [{ law: "경범죄 처벌법", article: "제3조" }] }, keyPoint: "노상방뇨는 경범죄(10만원 이하 벌금·구류·과료)" },
  { no: 18, question: "개인정보가 유출되면 어떻게 해야 하나요?", expect: { type: "answer", sources: [{ law: "개인정보 보호법", article: "제34조" }] }, keyPoint: "개인정보처리자는 지체 없이 정보주체에게 통지(항목·시점·대응 방법 등), 규모에 따라 신고" },
  { no: 19, question: "근로기준법상 연장근로 수당은 몇 퍼센트 가산해서 주나요?", expect: { type: "not-found" }, keyPoint: "근로기준법은 등록 법령이 아니므로 「등록된 자료에서 찾을 수 없습니다」" },
  { no: 20, question: "음주 의심 운전자를 현장에서 체포해도 되나요?", expect: { type: "field", sources: [{ law: "형사소송법", article: "제212조" }, { law: "형사소송법", article: "제200조의3" }, { law: "도로교통법", article: "제44조" }, { law: "경찰관 직무집행법", article: "제3조" }] }, keyPoint: "현장 판단 질문: 관련 조항만 안내하고 「AI는 법률 조항만 안내할 뿐 현장 판단을 할 수 없습니다…」 문구 표시" },
];
