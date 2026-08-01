// src/routes/weights.ts
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { weight, teacherSubject } from "@/src/db/schema";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";

const weights = new Hono<AuthEnv>();

async function assertOwnsSubject(
  userId: number,
  subjectId: number,
  year: number,
) {
  const [assignment] = await db
    .select()
    .from(teacherSubject)
    .where(
      and(
        eq(teacherSubject.teacherId, userId),
        eq(teacherSubject.subjectId, subjectId),
        eq(teacherSubject.year, year),
      ),
    );
  return !!assignment;
}

weights.get("/", requireAuth(), async (c) => {
  const subjectId = c.req.query("subjectId");
  const year = c.req.query("year");

  const conditions = [];
  if (subjectId) conditions.push(eq(weight.subjectId, Number(subjectId)));
  if (year) conditions.push(eq(weight.year, Number(year)));

  const rows = conditions.length
    ? await db
        .select()
        .from(weight)
        .where(and(...conditions))
    : await db.select().from(weight);

  return c.json(rows);
});

weights.get("/current", requireAuth(), async (c) => {
  const subjectId = Number(c.req.query("subjectId"));
  const year = Number(c.req.query("year"));
  const term = Number(c.req.query("term"));

  if (!subjectId || !year || !term) {
    return c.json({ message: "subjectId, year, termは必須です" }, 400);
  }

  const [row] = await db
    .select()
    .from(weight)
    .where(
      and(
        eq(weight.subjectId, subjectId),
        eq(weight.year, year),
        eq(weight.term, term),
      ),
    );

  if (!row) return c.json({ message: "設定された重みがありません" }, 404);
  return c.json(row);
});

weights.post("/", requireAuth({ allowedRoles: ["teacher"] }), async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    subjectId: number;
    year: number;
    term: number;
    attendanceRateWeight: number;
    attitudeClassWeight: number;
    homeworkEvaluationWeight: number;
  }>();

  const total =
    body.attendanceRateWeight +
    body.attitudeClassWeight +
    body.homeworkEvaluationWeight;
  if (total !== 10) {
    return c.json({ message: "重みの合計は10である必要があります" }, 400);
  }

  const owns = await assertOwnsSubject(user.id, body.subjectId, body.year);
  if (!owns) return c.json({ message: "担当外の科目です" }, 403);

  try {
    const [inserted] = await db.insert(weight).values(body).$returningId();
    return c.json({ id: inserted.id }, 201);
  } catch {
    return c.json({ message: "この学期の重みは既に設定されています" }, 422);
  }
});

weights.patch("/:id", requireAuth({ allowedRoles: ["teacher"] }), async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const body = await c.req.json<Partial<typeof weight.$inferInsert>>();

  const [existing] = await db.select().from(weight).where(eq(weight.id, id));
  if (!existing) return c.json({ message: "見つかりません" }, 404);

  const owns = await assertOwnsSubject(
    user.id,
    existing.subjectId,
    existing.year,
  );
  if (!owns) return c.json({ message: "担当外の科目です" }, 403);

  const merged = { ...existing, ...body };
  const total =
    merged.attendanceRateWeight +
    merged.attitudeClassWeight +
    merged.homeworkEvaluationWeight;
  if (total !== 10) {
    return c.json({ message: "重みの合計は10である必要があります" }, 400);
  }

  await db.update(weight).set(body).where(eq(weight.id, id));
  return c.json({ message: "更新しました" });
});

export default weights;
