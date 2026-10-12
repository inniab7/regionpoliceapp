// Design Ref: §5.3 ③ — 개인정보 검사: 주민등록번호·전화번호·차량번호 형식과 이름으로 보이는 표현을 감지한다
// Plan: 작업 28 — 개인정보 차단. 질문을 AI에 보내기 **전에** 이 검사를 통과해야 한다(PRD 5장 ② 규칙 4).
// 감지되면 AI로 보내지 않는다. 감지된 내용 자체는 화면·로그 어디에도 다시 쓰지 않고 "종류"만 알려 준다.
// 정해진 패턴 검사이므로 AI가 아니라 규칙으로만 판단한다(이름은 완벽하지 않아, 헷갈리는 일반 법률 용어는 예외로 둔다).

export type PrivacyKind = "주민등록번호" | "전화번호" | "차량번호" | "이름";

/** 감지 시 화면에 보이는 안내 (DESIGN 4.4) */
export const PRIVACY_BLOCK_MESSAGE = "개인정보(이름·주민등록번호·전화번호·차량번호)를 지우고 다시 물어봐 주세요";

/** 자주 쓰는 성씨 (이름 감지용). 드문 성씨는 일반 낱말과 겹치기 쉬워 뺐다 */
const SURNAMES = "김이박최정강조윤장임한오서신권황안송류유홍전고문양손배백허남심노하곽성차주우구민나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부";

/** 성씨로 시작하지만 사람 이름이 아닌 흔한 낱말 (질문에 자주 나옴) */
const COMMON_WORDS = new Set([
  "신문", "신임", "선임", "후임", "주임", "조사", "구속", "구금", "고소", "고발", "진술", "임의", "임용", "안전", "신고", "현장", "한번", "한도", "주취", "주차", "주정", "우선", "우회", "구호",
  "구조", "민원", "방법", "방해", "공무", "공공", "금지", "금액", "기준", "기간", "인정", "인적", "제한", "제지", "제출", "제공", "경찰", "경우", "경범", "도로", "도주", "소란", "소지",
  "선거", "성범", "성폭", "전화", "전과", "정당", "정지", "정보", "지시", "지구", "진행", "차량", "차로", "추행", "추적", "원동", "연령", "여부", "위반", "위험", "위치", "유치", "유예",
  "유죄", "유출", "문서", "문자", "명령", "명예", "양형", "어린", "예방", "용의", "사건", "사실", "사고", "사용", "사망", "부상", "부정", "표지", "함정", "변호", "변사", "변경", "배상",
  "백지", "하차", "하위", "하루", "노상", "노인", "남용", "심문", "심사", "심신", "곽란", "권리", "권한", "국민", "국가", "국내", "황당", "천재", "채증", "채무", "허위", "허가", "제3", "모욕",
  "인명", "인근", "인수", "인권", "윤리", "장비", "장구", "장애", "전자", "전체", "한국", "한시", "강제", "강도", "강간", "송치", "송달", "손괴", "손해", "서면", "서류", "설치", "마약",
  "구분", "구체", "기소", "기록", "기타", "반드", "반환", "반복", "연락", "연속", "오토", "오염", "오인", "오전", "오후", "고의", "고지", "고용", "공동", "공개", "공범", "공소",
]);

/** 사람 앞에 붙는 직책·역할 (뒤에 이름이 오기 쉽다) */
const ROLE_WORDS = "피의자|피해자|신고자|용의자|목격자|참고인|고소인|고발인|피고소인|민원인|가해자|당사자|운전자|피고인|증인|대상자|상대방|보호자|관계자";

/** 경찰 계급 (이름 뒤에 붙으면 사람 이름) */
const RANKS = "순경|경장|경사|경위|경감|경정|총경|경무관|치안감|치안정감|치안총감";

const NAME_BODY = `[${SURNAMES}][가-힣]{2}`; // 성 + 이름 두 글자 (세 글자 이름)

/** 한글 낱말의 시작인지 (앞 글자가 한글이면 낱말 중간이라 이름으로 보지 않는다) */
const BOUNDARY = "(?<![가-힣])";

// ① 주민등록번호: 생년월일 6자리 + 뒤 7자리(첫 자리 1~8). 월·일 범위는 따로 확인한다
const RRN = /(?<!\d)(\d{2})(\d{2})(\d{2})[-\s]?[1-8]\d{6}(?!\d)/g;

// ② 전화번호: 휴대전화(010 등), 서울 02, 지역번호(031 등), 인터넷전화 070
const PHONE_PATTERNS = [
  /(?<!\d)01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/,
  /(?<!\d)0(?:2|[3-6][1-5]|70)[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/,
];

// ③ 차량번호: 숫자 2~3자리 + 번호판 글자 + 숫자 4자리 (예: 12가 3456, 123가4567). "제44조 1000"처럼 법 조문은 제외
const PLATE_LETTERS = "가나다라마거너더러머버서어저고노도로모보소오조구누두루무부수우주하허호배아바사자육해공합국";
const PLATE = new RegExp(`(?<![제\\d])\\d{2,3}\\s?[${PLATE_LETTERS}]\\s?\\d{4}(?!\\d)`);

// ④ 이름: 호칭(씨·님), 계급, 직책 뒤에 오는 "성+이름" 표현, 또는 "이름은/성명:" 뒤의 낱말
const NAME_WITH_HONORIFIC = new RegExp(`${BOUNDARY}(${NAME_BODY}|[${SURNAMES}][가-힣])\\s?(?:씨|님)`, "g");
// 성씨만 있는 "박 경위"는 "이 경사"(이 사람)와 구별이 안 되어 잡지 않는다 — 성+이름 세 글자일 때만
const NAME_WITH_RANK = new RegExp(`${BOUNDARY}(${NAME_BODY})\\s?(?:${RANKS})`, "g");
const NAME_AFTER_ROLE = new RegExp(`(?:${ROLE_WORDS})\\s?(${NAME_BODY})(?![가-힣]{2})`, "g");
const NAME_LABEL = /(?:이름|성명)\s?(?:은|이|가|:|=)?\s?([가-힣]{2,4})/g;

function isValidBirth(mm: string, dd: string): boolean {
  const m = Number(mm);
  const d = Number(dd);
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function hasRrn(text: string): boolean {
  for (const m of text.matchAll(RRN)) {
    if (isValidBirth(m[2], m[3])) return true;
  }
  return false;
}

/** 이름처럼 보이지만 흔한 낱말이면 이름이 아니다 */
function isCommonWord(token: string): boolean {
  return COMMON_WORDS.has(token) || COMMON_WORDS.has(token.slice(0, 2));
}

function hasName(text: string): boolean {
  for (const m of text.matchAll(NAME_WITH_HONORIFIC)) {
    if (!isCommonWord(m[1])) return true;
  }
  for (const m of text.matchAll(NAME_WITH_RANK)) {
    if (!isCommonWord(m[1])) return true;
  }
  for (const m of text.matchAll(NAME_AFTER_ROLE)) {
    if (!isCommonWord(m[1])) return true;
  }
  for (const m of text.matchAll(NAME_LABEL)) {
    const token = m[1];
    // "이름은 무엇인가요" 같은 질문 속 낱말은 제외 — 성씨로 시작하는 2~4글자만 이름으로 본다
    if (SURNAMES.includes(token[0]) && !isCommonWord(token)) return true;
  }
  return false;
}

/**
 * 질문에서 개인정보로 보이는 것의 종류를 찾는다. 없으면 빈 배열.
 * 전각 숫자·기호는 반각으로 맞춘 뒤 검사한다.
 */
export function detectPersonalInfo(question: string): PrivacyKind[] {
  const text = question.normalize("NFKC");
  const kinds: PrivacyKind[] = [];
  if (hasRrn(text)) kinds.push("주민등록번호");
  if (PHONE_PATTERNS.some((p) => p.test(text))) kinds.push("전화번호");
  if (PLATE.test(text)) kinds.push("차량번호");
  if (hasName(text)) kinds.push("이름");
  return kinds;
}
