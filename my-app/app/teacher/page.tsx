"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getJson, postJson } from "@/src/lib/api-client";

type Me = {
  id: number;
  role: "teacher" | "full_time_teacher";
  mustChangePassword: boolean;
  name: string;
};

export default function TeacherHome() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      const result = await getJson<Me>("/auth/me");
      if (!result.ok) {
        router.replace("/");
        return;
      }
      if (result.data.role !== "teacher") {
        router.replace("/staff");
        return;
      }
      setMe(result.data);
    })();
  }, [router]);

  async function handleLogout() {
    await postJson("/auth/logout", {});
    router.replace("/");
  }

  if (!me) {
    return (
      <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
        <AppHeader />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
      <AppHeader
        title={`${me.name} 講師`}
        left={
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-sm bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20"
          >
            ログアウト
          </button>
        }
      />

      <main className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-lg text-gray-800">ログインしました(講師)</p>
        <p className="text-sm text-gray-500">
          講師向け画面は準備中です(デザイン待ち)
        </p>
      </main>
    </div>
  );
}
