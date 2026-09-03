// src/lib/csv.ts
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export type CsvRowError = {
  row: number; // 1始まり(ヘッダーを除いた行番号)
  field: string;
  message: string;
};

export function parseCsv(content: string): Record<string, string>[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

export function toCsv(rows: Record<string, unknown>[]): string {
  return stringify(rows, { header: true });
}

// 必須項目チェックの共通処理
export function validateRequiredFields(
  rows: Record<string, string>[],
  requiredFields: string[],
): CsvRowError[] {
  const errors: CsvRowError[] = [];
  rows.forEach((row, i) => {
    for (const field of requiredFields) {
      if (!row[field] || row[field].trim() === "") {
        errors.push({ row: i + 1, field, message: "必須項目が空です" });
      }
    }
  });
  return errors;
}

// CSV上の名前(専攻名・科目名・講師名など)を内部IDに解決する共通処理。
// 数値IDをCSVに書かせずに済むようにするための仕組み。
// lookup: 候補名の一覧を渡すと {id, name} の一覧を返す関数(呼び出し側でDBを引く)
export async function resolveNamesToIds(
  rows: Record<string, string>[],
  field: string,
  lookup: (names: string[]) => Promise<{ id: number; name: string }[]>,
): Promise<{ idsByName: Map<string, number[]>; errors: CsvRowError[] }> {
  const names = [...new Set(rows.map((r) => r[field]).filter(Boolean))];
  const found = names.length > 0 ? await lookup(names) : [];

  const idsByName = new Map<string, number[]>();
  for (const f of found) {
    if (!idsByName.has(f.name)) idsByName.set(f.name, []);
    idsByName.get(f.name)!.push(f.id);
  }

  const errors: CsvRowError[] = [];
  rows.forEach((row, i) => {
    if (!row[field]) return; // 空欄は必須チェック側の責務
    const matches = idsByName.get(row[field]) ?? [];
    if (matches.length === 0) {
      errors.push({ row: i + 1, field, message: "該当するデータが見つかりません" });
    } else if (matches.length > 1) {
      errors.push({
        row: i + 1,
        field,
        message: "同名のデータが複数存在するため特定できません",
      });
    }
  });

  return { idsByName, errors };
}
