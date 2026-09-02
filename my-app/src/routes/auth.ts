import { Hono } from "hono";
import { randomBytes } from "crypto";
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
  type Role,
} from "@/src/lib/jwt";

const auth = new Hono<AuthEnv>();

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30分

// メール一意制約があるため、teacher/full_time_teacher どちらか一方にのみ存在する前提
async function findAccountByEmail(email: string) {
  const [teacherAccount] = await db
    .select()
    .from(teacher)
    .where(eq(teacher.email, email));
  if (teacherAccount) {
    return { table: teacher, account: teacherAccount, role: "teacher" as Role };
  }
  const [fullTimeAccount] = await db
    .select()
    .from(fullTimeTeacher)
    .where(eq(fullTimeTeacher.email, email));
  if (fullTimeAccount) {
    return {
      table: fullTimeTeacher,
      account: fullTimeAccount,
      role: "full_time_teacher" as Role,
    };
  }
  return null;
}

async function findAccountByResetToken(token: string) {
  const [teacherAccount] = await db
    .select()
    .from(teacher)
    .where(eq(teacher.resetToken, token));
  if (teacherAccount) {
    return { table: teacher, account: teacherAccount };
  }
  const [fullTimeAccount] = await db
    .select()
    .from(fullTimeTeacher)
    .where(eq(fullTimeTeacher.resetToken, token));
  if (fullTimeAccount) {
    return { table: fullTimeTeacher, account: fullTimeAccount };
  }
  return null;
}

auth.post("/login", async (c) => {
  const { email, password } = await c.req.json<{
    email?: string;
    password?: string;
  }>();

  if (!email || !password) {
    return c.json(
      { message: "メールアドレスとパスワードは必須です" },
      400,
    );
  }

  const found = await findAccountByEmail(email);
  if (!found) {
    return c.json(
      { message: "メールアドレスまたはパスワードが正しくありません" },
      401,
    );
  }

  const ok = await verifyPassword(password, found.account.password);
  if (!ok) {
    return c.json(
      { message: "メールアドレスまたはパスワードが正しくありません" },
      401,
    );
  }

  const token = await createSessionToken({
    sub: found.account.id,
    role: found.role,
    mustChangePassword: found.account.mustChangePassword,
  });
  setCookie(c, "session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return c.json({
    id: found.account.id,
    role: found.role,
    mustChangePassword: found.account.mustChangePassword,
  });
});

auth.post("/logout", async (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.json({ message: "ログアウトしました" });
});

auth.post("/forgot-password", async (c) => {
  const { email } = await c.req.json<{ email?: string }>();
  if (!email) {
    return c.json({ message: "メールアドレスは必須です" }, 400);
  }

  const found = await findAccountByEmail(email);
  // メールアドレスの存在有無を漏らさないよう、見つからない場合も同じレスポンスを返す
  if (found) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await db
      .update(found.table)
      .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
      .where(eq(found.table.id, found.account.id));

    // 送信基盤(SMTP等)が未接続のため、開発用にリンクをログ出力する
    console.log(
      `[password-reset] ${email} へのリセットリンク: /reset-password?token=${token}`,
    );
  }

  return c.json({
    message: "該当するアカウントが存在する場合、再設定用のメールを送信しました",
  });
});

auth.post("/reset-password", async (c) => {
  const { token, newPassword } = await c.req.json<{
    token?: string;
    newPassword?: string;
  }>();

  if (!token || !newPassword) {
    return c.json({ message: "トークンと新しいパスワードは必須です" }, 400);
  }

  const found = await findAccountByResetToken(token);
  if (
    !found ||
    !found.account.resetTokenExpiresAt ||
    found.account.resetTokenExpiresAt < new Date()
  ) {
    return c.json({ message: "トークンが無効または期限切れです" }, 400);
  }

  const hashed = await hashPassword(newPassword);
  await db
    .update(found.table)
    .set({
      password: hashed,
      mustChangePassword: false,
      resetToken: null,
      resetTokenExpiresAt: null,
    })
    .where(eq(found.table.id, found.account.id));

  return c.json({ message: "パスワードを再設定しました" });
});

auth.get("/me", requireAuth(), async (c) => {
  const user = c.get("user");
  const table = user.role === "teacher" ? teacher : fullTimeTeacher;
  const [account] = await db
    .select({ name: table.name })
    .from(table)
    .where(eq(table.id, user.id));

  return c.json({ ...user, name: account?.name ?? "" });
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
