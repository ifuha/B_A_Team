"use client";
import { useState, type SubmitEvent } from "react";
import AppHeader from "@/src/components/AppHeader";
import { postJson } from "@/src/lib/api-client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await postJson<{ message: string }>("/auth/forgot-password", {
      email,
    });
    setSubmitting(false);
    setMessage(
      result.ok
        ? result.data.message
        : result.message,
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
      <AppHeader />

      <main className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md px-6">
          <h1 className="mb-8 text-center text-3xl font-bold text-gray-900">
            パスワード再設定
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-4">
              <label htmlFor="email" className="w-24 shrink-0 text-sm text-gray-800">
                ログインID
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 flex-1 rounded-sm border border-gray-400 bg-gray-200 px-3 text-sm focus:border-[#2E4374] focus:bg-white focus:outline-none"
              />
            </div>

            {message && (
              <p className="text-center text-sm text-gray-700">{message}</p>
            )}

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-sm bg-[#4C6B9A] px-10 py-2 text-sm font-medium text-white transition hover:bg-[#3f5a85] disabled:opacity-60"
              >
                {submitting ? "送信中..." : "再設定メールを送信"}
              </button>
            </div>

            <div className="text-center">
              <a
                href="/"
                className="text-sm text-blue-600 underline hover:text-blue-800"
              >
                ログイン画面に戻る
              </a>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
