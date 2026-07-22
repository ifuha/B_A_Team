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
