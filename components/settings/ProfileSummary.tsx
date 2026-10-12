// Design Ref: §4.5 — 설정의 "내 등록 정보": 요약과 [변경] 버튼 (/setup/change)
// Plan: 작업 19 — 등록 완료와 [변경]
"use client";

import Link from "next/link";
import { profileRows } from "@/components/setup/profileRows";
import { profileOn } from "@/lib/storage/store";
import { useAppData } from "@/lib/storage/useAppData";
import { todayInKst } from "@/lib/time";

export default function ProfileSummary() {
  const app = useAppData();

  if (app.status === "loading") return <p className="text-zinc-600 dark:text-zinc-400">불러오는 중…</p>;

  if (app.status === "unavailable") {
    return <p role="alert" className="text-base">이 브라우저에서는 정보를 저장할 수 없어요.</p>;
  }
  if (app.status === "corrupt") {
    return (
      <p role="alert" className="text-base">
        저장된 정보를 읽을 수 없어요. 새로 등록하면 이전 정보는 지워져요.{" "}
        <Link href="/setup" className="font-bold text-blue-700 underline dark:text-blue-400">
          새로 등록하기
        </Link>
      </p>
    );
  }

  const profile = app.status === "ok" ? profileOn(app.data, todayInKst(new Date())) ?? app.data.profiles.at(-1) : null;
  if (!profile) {
    return (
      <div>
        <p className="text-base">아직 등록한 근무 정보가 없어요.</p>
        <Link
          href="/setup"
          className="mt-3 flex h-12 items-center justify-center rounded-lg bg-blue-700 text-base font-bold text-white dark:bg-blue-500"
        >
          근무 등록하기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-300 dark:divide-zinc-700 dark:border-zinc-600">
        {profileRows(profile).map(([label, value]) => (
          <div key={label} className="flex gap-3 px-3 py-2 text-base">
            <dt className="w-24 shrink-0 text-zinc-600 dark:text-zinc-400">{label}</dt>
            <dd className="min-w-0 flex-1 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href="/setup/change"
        className="mt-3 flex h-12 items-center justify-center rounded-lg border border-blue-700 text-base font-bold text-blue-700 dark:border-blue-400 dark:text-blue-400"
      >
        변경
      </Link>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        인사발령 등으로 소속이나 근무 형태가 바뀌면 [변경]을 눌러 주세요. 적용일 이전은 지금 정보로 그대로 계산돼요.
      </p>
    </div>
  );
}
