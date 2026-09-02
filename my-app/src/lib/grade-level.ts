// src/lib/grade-level.ts

// 入学年度から、指定した年度(または現在)時点の学年(年次)を算出する
export function computeGradeLevel(
  enrollmentYear: number,
  targetYear: number = new Date().getFullYear(),
): number {
  return targetYear - enrollmentYear + 1;
}
