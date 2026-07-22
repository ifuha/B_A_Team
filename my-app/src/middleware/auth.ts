// src/middleware/auth.ts
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_TTL_SECONDS,
  type Role,
} from "@/src/lib/jwt";

export type AuthUser = {
  id: number;
  role: Role;
  mustChangePassword: boolean; // 追加: ルート側でも参照できるように
};

export type AuthEnv = {
  Variables: {
    user: AuthUser;
  };
};

type RequireAuthOptions = {
  allowedRoles?: Role[];
  allowMustChangePassword?: boolean; // 追加: /auth/change-password 専用
};

export const requireAuth = (options: RequireAuthOptions = {}) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const token = getCookie(c, "session");
    if (!token) {
      return c.json({ message: "認証が必要です" }, 401);
    }

    try {
      const payload = await verifySessionToken(token);

      if (payload.mustChangePassword && !options.allowMustChangePassword) {
        return c.json({ message: "パスワードの再設定が必要です" }, 403);
      }

      if (
        options.allowedRoles &&
        !options.allowedRoles.includes(payload.role)
      ) {
        return c.json({ message: "権限がありません" }, 403);
      }

      c.set("user", {
        id: payload.sub,
        role: payload.role,
        mustChangePassword: payload.mustChangePassword,
      });

      const refreshed = await createSessionToken({
        sub: payload.sub,
        role: payload.role,
        mustChangePassword: payload.mustChangePassword,
      });
      setCookie(c, "session", refreshed, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: SESSION_TTL_SECONDS,
        path: "/",
      });

      await next();
    } catch {
      deleteCookie(c, "session");
      return c.json({ message: "セッションが無効です" }, 401);
    }
  });
