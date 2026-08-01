// src/routes/reports.ts
import { Hono } from "hono";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/src/db";
import { grade, student } from "@/src/db/schema";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";

const reports = new Hono<AuthEnv>();

reports.get("/subject/:subjectId", requireAuth(), async (c) => {
  const subjectId = Number(c.req.param("subjectId"));
  const rows = await db
    .select({
      studentId: student.id,
      studentName: student.name,
      studentNumber: student.studentNumber,
      majorId: student.majorId,
      attendanceRate: grade.attendanceRate,
      attitudeClass: grade.attitudeClass,
      homeworkEvaluation: grade.homeworkEvaluation,
      finalRank: grade.finalRank,
    })
    .from(grade)
    .innerJoin(student, eq(grade.studentId, student.id))
    .where(eq(grade.subjectId, subjectId));

  return c.json(rows);
});

reports.get("/student/:studentId", requireAuth(), async (c) => {
  const studentId = Number(c.req.param("studentId"));
  const from = c.req.query("from"); // year
  const to = c.req.query("to");

  const conditions = [eq(grade.studentId, studentId)];
  if (from) conditions.push(gte(grade.year, Number(from)));
  if (to) conditions.push(lte(grade.year, Number(to)));

  const rows = await db
    .select()
    .from(grade)
    .where(and(...conditions));
  return c.json(rows);
});

/* PDF系は未実装。ライブラリ選定待ち */
reports.get("/student/:studentId/pdf", requireAuth(), async (c) => {
  return c.json({ message: "PDF出力は未実装です" }, 501);
});

reports.get("/subject/:subjectId/pdf", requireAuth(), async (c) => {
  return c.json({ message: "PDF出力は未実装です" }, 501);
});

export default reports;
