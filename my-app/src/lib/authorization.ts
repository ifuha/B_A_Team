// src/lib/authorization.ts
import { and, eq, or, type SQL } from "drizzle-orm";
import { db } from "@/src/db";
import { grade, teacherSubject } from "@/src/db/schema";

// 指定科目について、その講師が担当している年度の一覧(6.7: 教員は担当外の科目は見れない)
export async function getOwnedYearsForSubject(
  teacherId: number,
  subjectId: number,
): Promise<number[]> {
  const rows = await db
    .select({ year: teacherSubject.year })
    .from(teacherSubject)
    .where(
      and(
        eq(teacherSubject.teacherId, teacherId),
        eq(teacherSubject.subjectId, subjectId),
      ),
    );
  return rows.map((r) => r.year);
}

// その講師が担当している(科目, 年度)の組み合わせ一覧
export async function getOwnedSubjectYearPairs(
  teacherId: number,
): Promise<{ subjectId: number; year: number }[]> {
  return db
    .select({ subjectId: teacherSubject.subjectId, year: teacherSubject.year })
    .from(teacherSubject)
    .where(eq(teacherSubject.teacherId, teacherId));
}

// 講師が閲覧できる grade 行を絞り込むSQL条件(担当科目×過去3年分のみ 6.7/4.13)。
// 担当科目が無ければ null を返す(呼び出し側は空配列を返すこと)。
export async function getTeacherGradeVisibilityCondition(
  teacherId: number,
): Promise<SQL | null> {
  const pairs = await getOwnedSubjectYearPairs(teacherId);
  const cutoffYear = new Date().getFullYear() - 3;
  const relevant = pairs.filter((p) => p.year >= cutoffYear);
  if (relevant.length === 0) return null;

  return or(
    ...relevant.map((p) =>
      and(eq(grade.subjectId, p.subjectId), eq(grade.year, p.year)),
    ),
  )!;
}
