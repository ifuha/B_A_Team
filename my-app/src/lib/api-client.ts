// src/lib/api-client.ts
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; message: string; data: unknown };

async function parseResponse<T>(res: Response): Promise<ApiResult<T>> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message:
        (data && typeof data === "object" && "message" in data
          ? String((data as { message?: unknown }).message)
          : undefined) ?? "エラーが発生しました",
      data,
    };
  }
  return { ok: true, status: res.status, data: data as T };
}

export async function postJson<T = unknown>(
  path: string,
  body: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function getJson<T = unknown>(path: string): Promise<ApiResult<T>> {
  const res = await fetch(`/api${path}`);
  return parseResponse<T>(res);
}
