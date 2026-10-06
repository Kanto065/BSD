import { ApiError } from "@/lib/admin-session";

// Calls to the shared member login in the API. The session is an httpOnly cookie, so every call sends credentials.

export type Member = { id: string; name: string; email: string; postcode: string; modules: string[]; badges: string[] };

export async function memberCall(apiBase: string, path: string, body?: unknown): Promise<{ user?: Member }> {
  const res = await fetch(`${apiBase}/auth/${path}`, {
    method: body === undefined && path === "me" ? "GET" : "POST",
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong.", data.fieldErrors ?? {});
  return data;
}

export const joinModule = (apiBase: string, module: "DIRECTORY" | "CARD" | "MARKETPLACE") =>
  memberCall(apiBase, "modules", { module });
