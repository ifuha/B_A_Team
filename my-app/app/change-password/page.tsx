"use client";
import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getJson, postJson } from "@/src/lib/api-client";

export default function ChangePassword() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await postJson<{ message: string }>("/auth/change-password", {
      currentPassword,
      newPassword,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const me = await getJson<{ role: "teacher" | "full_time_teacher" }>(
      "/auth/me",
    );
    router.push(
      me.ok && me.data.role === "full_time_teacher" ? "/staff" : "/teacher",
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
      <AppHeader />

      <main className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md px-6">
          <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
            パスワード変更
          </h1>
          <p className="mb-8 text-center text-sm text-gray-600">
            初回ログインのため、パスワードの再設定が必要です
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-4">
              <label
                htmlFor="currentPassword"
                className="w-32 shrink-0 text-sm text-gray-800"
              >
                現在のパスワード
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-9 flex-1 rounded-sm border border-gray-400 bg-gray-200 px-3 text-sm focus:border-[#2E4374] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-4">
              <label
                htmlFor="newPassword"
                className="w-32 shrink-0 text-sm text-gray-800"
              >
                新しいパスワード
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-9 flex-1 rounded-sm border border-gray-400 bg-gray-200 px-3 text-sm focus:border-[#2E4374] focus:bg-white focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-sm bg-[#4C6B9A] px-10 py-2 text-sm font-medium text-white transition hover:bg-[#3f5a85] disabled:opacity-60"
              >
                {submitting ? "変更中..." : "パスワードを変更"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
