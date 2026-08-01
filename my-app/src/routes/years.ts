// src/routes/years.ts
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { yearConfirmation, grade } from "@/src/db/schema";
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

    const incomplete = await db
      .select()
      .from(grade)
      .where(and(eq(grade.year, year), eq(grade.isIncomplete, true)));

    if (incomplete.length > 0) {
      return c.json(
        {
          message: "未入力の成績があるため確定できません",
          incompleteCount: incomplete.length,
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
