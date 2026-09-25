"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// The admin session in the browser. The access token is kept only in memory (never in localStorage, where any
// injected script could read it). The refresh token is an httpOnly cookie set by the API, which scripts cannot read
// at all. On load, and whenever the access token expires, the page quietly asks the API for a new one.

export type Role = "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "VOLUNTEER";
export type SessionAdmin = { name: string; email: string; role: Role; mustChangePassword: boolean };

const RANK: Record<Role, number> = { VOLUNTEER: 1, MODERATOR: 2, ADMIN: 3, SUPER_ADMIN: 4 };
export const atLeast = (role: Role | undefined, minimum: Role) => (role ? RANK[role] >= RANK[minimum] : false);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
    public code?: string
  ) {
    super(message);
  }
}

type Session = {
  status: "loading" | "signed-in" | "signed-out";
  admin: SessionAdmin | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Calls the admin API with the current token, renewing it once if it has expired. */
  api: <T = unknown>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
  /** After a password change the API returns a fresh session. */
  adopt: (result: { accessToken: string; admin: SessionAdmin }) => void;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession must be used inside <SessionProvider>");
  return s;
}

async function parse(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Something went wrong.", body.fieldErrors ?? {}, body.code);
  return body;
}

export function SessionProvider({ apiBase, children }: { apiBase: string; children: React.ReactNode }) {
  const token = useRef<string | null>(null);
  const [admin, setAdmin] = useState<SessionAdmin | null>(null);
  const [status, setStatus] = useState<Session["status"]>("loading");
  const renewing = useRef<Promise<boolean> | null>(null);

  const adopt = useCallback((r: { accessToken: string; admin: SessionAdmin }) => {
    token.current = r.accessToken;
    setAdmin(r.admin);
    setStatus("signed-in");
  }, []);

  const endLocally = useCallback(() => {
    token.current = null;
    setAdmin(null);
    setStatus("signed-out");
  }, []);

  // One renewal at a time, shared by every call that hit an expired token.
  const renew = useCallback(() => {
    renewing.current ??= fetch(`${apiBase}/admin/refresh`, { method: "POST", credentials: "include" })
      .then(parse)
      .then((r) => {
        adopt(r);
        return true;
      })
      .catch(() => {
        endLocally();
        return false;
      })
      .finally(() => {
        renewing.current = null;
      });
    return renewing.current;
  }, [apiBase, adopt, endLocally]);

  useEffect(() => {
    void renew();
  }, [renew]);

  const api = useCallback(
    async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
      const send = () =>
        fetch(`${apiBase}/admin${path}`, {
          method: init.method ?? "GET",
          // Needed so a new refresh cookie (after a password change) is actually stored by the browser.
          credentials: "include",
          headers: {
            ...(token.current ? { authorization: `Bearer ${token.current}` } : {}),
            ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
          },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
      let res = await send();
      if (res.status === 401 && (await renew())) res = await send();
      if (res.status === 401) endLocally();
      return parse(res) as Promise<T>;
    },
    [apiBase, renew, endLocally]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${apiBase}/admin/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      adopt(await parse(res));
    },
    [apiBase, adopt]
  );

  const signOut = useCallback(async () => {
    await fetch(`${apiBase}/admin/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
    endLocally();
  }, [apiBase, endLocally]);

  const value = useMemo<Session>(() => ({ status, admin, signIn, signOut, api, adopt }), [status, admin, signIn, signOut, api, adopt]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
