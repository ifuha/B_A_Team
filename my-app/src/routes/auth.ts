import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "@/src/middleware/auth";
import { db } from "@/src/db";
import { teacher, fullTimeTeacher } from "@/src/db/schema";
import { hashPassword, verifyPassword } from "@/src/lib/password";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_TTL_SECONDS,
} from "@/src/lib/jwt";

const auth = new Hono<AuthEnv>();

auth.get("/me", requireAuth(), async (c) => {
  const user = c.get("user");
  return c.json(user);
});

auth.post(
  "/change-password",
  requireAuth({ allowMustChangePassword: true }),
  async (c) => {
    const user = c.get("user");
    const { currentPassword, newPassword } = await c.req.json<{
      currentPassword?: string;
      newPassword?: string;
    }>();

    if (!currentPassword || !newPassword) {
      return c.json(
        { message: "現在のパスワードと新しいパスワードは必須です" },
        400,
      );
    }

    if (currentPassword === newPassword) {
      return c.json(
        { message: "新しいパスワードは現在のパスワードと異なる必要があります" },
        400,
      );
    }

    const table = user.role === "teacher" ? teacher : fullTimeTeacher;

    const [account] = await db
      .select()
      .from(table)
      .where(eq(table.id, user.id));
    if (!account) {
      return c.json({ message: "アカウントが見つかりません" }, 404);
    }

    const ok = await verifyPassword(currentPassword, account.password);
    if (!ok) {
      return c.json({ message: "現在のパスワードが正しくありません" }, 401);
    }

    const hashed = await hashPassword(newPassword);
    await db
      .update(table)
      .set({
        password: hashed,
        mustChangePassword: false,
        resetToken: null,
        resetTokenExpiresAt: null,
      })
      .where(eq(table.id, user.id));

    const refreshed = await createSessionToken({
      sub: user.id,
      role: user.role,
      mustChangePassword: false,
    });
    setCookie(c, "session", refreshed, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });

    return c.json({ message: "パスワードを変更しました" });
  },
);

export default auth;
