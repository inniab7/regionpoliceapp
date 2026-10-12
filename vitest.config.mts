// Vitest 설정 — 일반 시험 (`npm run test`)
// 계산·검색 같은 순수 함수를 시험하므로 브라우저 흉내(jsdom) 없이 Node에서 돌린다.
// 실제 AI를 부르는 정답률 시험(evals/)은 여기서 빼고 `npm run eval`로 따로 돌린다.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig.json의 "@/*" 경로 별칭과 맞춘다
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "evals/**", "trash-can/**"],
  },
});
