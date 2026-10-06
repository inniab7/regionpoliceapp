// 없는 주소로 들어왔을 때 보여 주는 한국어 안내 화면 (CLAUDE.md: 화면 문구는 한국어)
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "찾을 수 없는 화면",
};

export default function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-bold">화면을 찾을 수 없어요</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        주소가 잘못되었거나 없는 화면입니다.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-lg bg-blue-700 px-5 text-base font-bold text-white dark:bg-blue-500"
      >
        초과근무 화면으로 가기
      </Link>
    </section>
  );
}
