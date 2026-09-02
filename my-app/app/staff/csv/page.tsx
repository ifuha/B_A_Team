"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getJson, postJson } from "@/src/lib/api-client";

type Me = {
  id: number;
  role: "teacher" | "full_time_teacher";
  mustChangePassword: boolean;
  name: string;
};

type CsvRowError = { row: number; field: string; message: string };

type EntityConfig = {
  key: string;
  label: string;
  importPath: string;
  exportPath?: string;
};

const ENTITIES: EntityConfig[] = [
  {
    key: "majors",
    label: "専攻一覧",
    importPath: "/masters/majors/import",
    exportPath: "/csv/export/majors",
  },
  {
    key: "subjects",
    label: "科目一覧",
    importPath: "/masters/subjects/import",
    exportPath: "/csv/export/subjects",
  },
  {
    key: "students",
    label: "生徒一覧",
    importPath: "/masters/students/import",
    exportPath: "/csv/export/students",
  },
  {
    key: "teachers",
    label: "講師一覧",
    importPath: "/masters/teachers/import",
    exportPath: "/csv/export/teachers",
  },
  {
    key: "full-time-teachers",
    label: "専任職員名簿",
    importPath: "/masters/full-time-teachers/import",
    exportPath: "/csv/export/full-time-teachers",
  },
  {
    key: "subjects-with-teacher",
    label: "科目・講師紐づけ(科目名+担当講師名)",
    importPath: "/masters/subjects/import-with-teacher",
  },
  {
    key: "teacher-subject",
    label: "講師・科目紐づけ(ID指定)",
    importPath: "/relations/teacher-subject/import",
  },
  {
    key: "student-subject",
    label: "学生・科目紐づけ",
    importPath: "/relations/student-subject/import",
  },
];

const EXPORTABLE_ENTITIES = ENTITIES.filter((e) => e.exportPath);

export default function StaffCsv() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<"import" | "export">("import");

  const [importEntityKey, setImportEntityKey] = useState(ENTITIES[0].key);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<CsvRowError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportEntityKey, setExportEntityKey] = useState(
    EXPORTABLE_ENTITIES[0].key,
  );

  useEffect(() => {
    (async () => {
      const result = await getJson<Me>("/auth/me");
      if (!result.ok) {
        router.replace("/");
        return;
      }
      if (result.data.role !== "full_time_teacher") {
        router.replace("/teacher");
        return;
      }
      setMe(result.data);
    })();
  }, [router]);

  if (!me) {
    return (
      <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
        <AppHeader />
      </div>
    );
  }

  async function handleImport() {
    if (!file) return;
    const entity = ENTITIES.find((e) => e.key === importEntityKey)!;

    setImporting(true);
    setImportMessage(null);
    setImportErrors([]);

    const csv = await file.text();
    const result = await postJson<{ message: string; count?: number }>(
      entity.importPath,
      { csv },
    );

    setImporting(false);
    if (!result.ok) {
      setImportMessage(result.message);
      const body = result.data as { errors?: CsvRowError[] } | null;
      if (Array.isArray(body?.errors)) setImportErrors(body.errors);
      return;
    }
    setImportMessage(
      result.data.count !== undefined
        ? `${result.data.message}(${result.data.count}件)`
        : result.data.message,
    );
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleExport() {
    const entity = EXPORTABLE_ENTITIES.find((e) => e.key === exportEntityKey)!;
    window.location.href = `/api${entity.exportPath}`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#EFF2F7]">
      <AppHeader
        title="CSV"
        left={
          <button
            type="button"
            onClick={() => router.push("/staff")}
            className="rounded-sm bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
            aria-label="戻る"
          >
            ←
          </button>
        }
      />

      <div className="flex w-full">
        <button
          type="button"
          onClick={() => setTab("import")}
          className={`flex-1 py-3 text-sm font-medium border-2 border-[#B0C0D7] ${
            tab === "import" ? "bg-[#2E4374] text-white" : "bg-white text-black"
          }`}
        >
          入力
        </button>
        <button
          type="button"
          onClick={() => setTab("export")}
          className={`flex-1 py-3 text-sm font-medium border-2 border-[#B0C0D7] ${
            tab === "export" ? "bg-[#2E4374] text-white" : "bg-white text-black"
          }`}
        >
          出力
        </button>
      </div>

      <main className="flex-1 p-10">
        {tab === "import" ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-6">
            <div className="flex w-full items-center gap-4">
              <label className="w-24 shrink-0 text-sm text-black">
                CSVファイル
              </label>
              <div className="h-9 flex-1 truncate rounded-sm border border-gray-400 bg-gray-200 px-3 text-sm leading-9 text-black">
                {file?.name ?? ""}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="whitespace-nowrap rounded-sm bg-[#4C6B9A] px-3 py-2 text-sm text-white hover:bg-[#3f5a85]"
              >
                ファイルを選択
              </button>
            </div>

            <div className="flex w-full items-center justify-center gap-4">
              <label className="text-sm text-black">入力項目</label>
              <select
                value={importEntityKey}
                onChange={(e) => setImportEntityKey(e.target.value)}
                className="h-9 rounded-sm border border-gray-400 px-2 text-sm text-black"
              >
                {ENTITIES.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={!file || importing}
              onClick={handleImport}
              className="rounded-sm bg-[#4C6B9A] px-10 py-2 text-sm font-medium text-white hover:bg-[#3f5a85] disabled:opacity-40"
            >
              {importing ? "入力中..." : "入力"}
            </button>

            {importMessage && (
              <p className="text-sm text-black" role="status">
                {importMessage}
              </p>
            )}

            {importErrors.length > 0 && (
              <table className="w-full text-xs text-red-700">
                <thead>
                  <tr className="text-left">
                    <th className="pr-4">行</th>
                    <th className="pr-4">項目</th>
                    <th>内容</th>
                  </tr>
                </thead>
                <tbody>
                  {importErrors.map((err, i) => (
                    <tr key={i}>
                      <td className="pr-4">{err.row}</td>
                      <td className="pr-4">{err.field}</td>
                      <td>{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-6">
            <div className="flex w-full items-center justify-center gap-4">
              <label className="text-sm text-black">出力項目</label>
              <select
                value={exportEntityKey}
                onChange={(e) => setExportEntityKey(e.target.value)}
                className="h-9 rounded-sm border border-gray-400 px-2 text-sm text-black"
              >
                {EXPORTABLE_ENTITIES.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleExport}
              className="rounded-sm bg-[#4C6B9A] px-10 py-2 text-sm font-medium text-white hover:bg-[#3f5a85]"
            >
              出力
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
