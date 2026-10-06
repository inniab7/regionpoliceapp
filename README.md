# 현답

> 답이 있는 현장 근무자를 위하여

지구대·파출소·교대근무 경찰관을 위한 스마트폰 웹앱입니다.

- **초과근무 자동 산출**: 근무 패턴으로 한 달 근무표를 만들고 기본 초과·야간·휴일·합계 4줄로 계산합니다.
- **규정·매뉴얼 AI 질의응답**: 등록된 공개 법령 안에서만, 출처와 기준일을 붙여 답합니다. AI는 사용자가 본인 API 키로 연결합니다.

## 문서

| 문서 | 내용 |
|---|---|
| [PRD.md](PRD.md) | 기획서 (기준 문서, 계산 규칙 1~17) |
| [PLAN.md](PLAN.md) | 만들 순서 (작업 1~40) |
| [DESIGN.md](DESIGN.md) | 화면·데이터·기술 설계 |
| [CLAUDE.md](CLAUDE.md) | 작업 규칙 |

## 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

```bash
npm run lint     # 코드 검사
npm run build    # 배포용 빌드
```

## 기술

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · 배포: Vercel
