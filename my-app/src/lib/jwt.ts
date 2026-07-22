// src/lib/jwt.ts
import { sign, verify } from "hono/jwt";

const JWT_SECRET = process.env.JWT_SECRET!;
const SESSION_TTL_SECONDS = 10 * 60; // 10分（4.2.2 無操作ログアウト）
const JWT_ALGORITHM = "HS256"; // 追加

export type Role = "teacher" | "full_time_teacher";

export type SessionPayload = {
  sub: number;
  role: Role;
  mustChangePassword: boolean;
  exp: number;
};

export const createSessionToken = (payload: Omit<SessionPayload, "exp">) => {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return sign({ ...payload, exp }, JWT_SECRET, JWT_ALGORITHM); // 第3引数追加
};

export const verifySessionToken = (token: string) =>
  verify(token, JWT_SECRET, JWT_ALGORITHM) as Promise<SessionPayload>; // 第3引数追加

export { SESSION_TTL_SECONDS };
