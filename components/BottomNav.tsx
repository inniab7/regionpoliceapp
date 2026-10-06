// Design Ref: §4.1 — 하단 메뉴(초과근무 / 규정 찾기 / 설정). 첫 등록(/setup)에서만 숨긴다.
// Plan: 작업 2 — 공통 화면 틀
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  // 이 메뉴가 선택된 것으로 볼 주소들 (설정 안에서 들어가는 화면 포함)
  matches: string[];
  icon: React.ReactNode;
};

// 아이콘은 글자색(currentColor)을 따라가게 해서 선택 여부에 따라 색이 함께 바뀐다.
const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "초과근무",
    matches: ["/"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-6 w-6">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
  {
    href: "/ask",
    label: "규정 찾기",
    matches: ["/ask"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-6 w-6">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "설정",
    // [변경](/setup/change)과 메모(/memo)는 설정에서 들어가는 화면이라 "설정"이 선택돼 보이게 한다.
    matches: ["/settings", "/setup", "/memo"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-6 w-6">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    ),
  },
];

// 지금 주소가 메뉴 항목에 해당하는지 확인한다. "/"는 정확히 같을 때만 선택으로 본다.
function isActive(pathname: string, item: NavItem) {
  return item.matches.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  // 첫 등록 화면에서는 메뉴를 숨겨 등록을 끝까지 마치게 한다. ([변경]은 /setup/change라 메뉴가 보인다)
  if (pathname === "/setup") return null;

  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-background pb-[env(safe-area-inset-bottom)] dark:border-white/15"
    >
      <ul className="mx-auto flex max-w-md">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-base ${
                  active
                    ? "font-bold text-blue-700 dark:text-blue-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
