// src/routes/years.ts
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { yearConfirmation, grade, studentSubject, weight } from "@/src/db/schema";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";

const years = new Hono<AuthEnv>();

years.get("/", requireAuth(), async (c) => {
  const rows = await db.select().from(yearConfirmation);
  return c.json(rows);
});

years.get("/current", requireAuth(), async (c) => {
  const currentYear = new Date().getFullYear();
  const [row] = await db
    .select()
    .from(yearConfirmation)
    .where(eq(yearConfirmation.year, currentYear));
  return c.json(row ?? { year: currentYear, isConfirmed: false });
});

/* POST /years/close: 未入力があれば警告(400)を返し、なければ確定 4.12 */
years.post(
  "/close",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const user = c.get("user");
    const { year } = await c.req.json<{ year: number }>();

    // 既存の成績レコードのうち未入力のもの
    const incompleteGrades = await db
      .select()
      .from(grade)
      .where(and(eq(grade.year, year), eq(grade.isIncomplete, true)));

    // 履修登録はあるが、成績レコード自体が一度も作られていない(学期, 生徒, 科目)の組も未入力扱いにする
    const enrollments = await db
      .select({
        studentId: studentSubject.studentId,
        subjectId: studentSubject.subjectId,
      })
      .from(studentSubject)
      .where(eq(studentSubject.year, year));

    const existingGrades = await db
      .select({
        studentId: grade.studentId,
        subjectId: grade.subjectId,
        term: grade.term,
      })
      .from(grade)
      .where(eq(grade.year, year));
    const existingKeys = new Set(
      existingGrades.map((g) => `${g.studentId}:${g.subjectId}:${g.term}`),
    );

    // 科目ごとに「実際に授業が行われている学期」(重みが設定されている学期)だけを必須とする。
    // 前期のみ開講の科目に後期分の成績まで要求してしまわないようにするため。
    const weightRows = await db
      .select({ subjectId: weight.subjectId, term: weight.term })
      .from(weight)
      .where(eq(weight.year, year));
    const activeTermsBySubject = new Map<number, Set<number>>();
    for (const w of weightRows) {
      if (!activeTermsBySubject.has(w.subjectId)) {
        activeTermsBySubject.set(w.subjectId, new Set());
      }
      activeTermsBySubject.get(w.subjectId)!.add(w.term);
    }

    let missingCount = 0;
    for (const e of enrollments) {
      const activeTerms = activeTermsBySubject.get(e.subjectId);
      if (!activeTerms) continue; // まだ重みが設定されていない科目は対象外
      for (const term of activeTerms) {
        if (!existingKeys.has(`${e.studentId}:${e.subjectId}:${term}`)) {
          missingCount++;
        }
      }
    }

    const incompleteCount = incompleteGrades.length + missingCount;
    if (incompleteCount > 0) {
      return c.json(
        {
          message: "未入力の成績があるため確定できません",
          incompleteCount,
        },
        400,
      );
    }

    await db
      .insert(yearConfirmation)
      .values({ year, confirmedBy: user.id, isConfirmed: true })
      .onDuplicateKeyUpdate({
        set: { confirmedBy: user.id, isConfirmed: true },
      });

    return c.json({ message: `${year}年度を確定しました` });
  },
);

years.patch(
  "/:yearId/lock",
  requireAuth({ allowedRoles: ["full_time_teacher"] }),
  async (c) => {
    const yearId = Number(c.req.param("yearId"));
    await db
      .update(yearConfirmation)
      .set({ isConfirmed: true })
      .where(eq(yearConfirmation.id, yearId));
    return c.json({ message: "ロックしました" });
  },
);

export default years;
