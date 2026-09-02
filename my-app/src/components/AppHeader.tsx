import type { ReactNode } from "react";

export default function AppHeader({
  title = "SANSUN学園 成績管理",
  left,
  right,
}: {
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="flex w-full items-center justify-between gap-4 bg-[#2E4374] px-6 py-3 text-white shadow">
      <div className="flex min-w-[8rem] items-center gap-2">{left}</div>
      <h1 className="flex-1 text-center text-lg font-semibold">{title}</h1>
      <div className="flex min-w-[8rem] items-center justify-end gap-2">
        {right}
      </div>
    </header>
  );
}
