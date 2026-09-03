"use client";

export default function YearCloseConfirmModal({
  gradeLevelLabel,
  termLabel,
  onCancel,
  onConfirm,
  confirming,
}: {
  gradeLevelLabel: string;
  termLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-md bg-white shadow-lg">
        <div className="bg-[#2E4374] py-4 text-center text-lg font-semibold text-white">
          以下の成績を確定します
        </div>

        <div className="space-y-4 p-8 text-center">
          <p className="text-sm font-medium text-red-600 underline">
            ※確定すると以下の成績変更が出来なくなります
          </p>
          <p className="text-base text-gray-900">学年：{gradeLevelLabel}</p>
          <p className="text-base text-gray-900">学期：{termLabel}</p>

          <div className="flex justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-sm border border-[#2E4374] px-5 py-2 text-sm text-[#2E4374] hover:bg-gray-50"
            >
              編集に戻る
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              className="rounded-sm bg-[#4C6B9A] px-5 py-2 text-sm font-medium text-white hover:bg-[#3f5a85] disabled:opacity-60"
            >
              {confirming ? "確定中..." : "成績確定"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
