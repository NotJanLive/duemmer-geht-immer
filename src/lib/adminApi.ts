// Small client for the admin JSON API in server/admin.ts.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: string[] = [],
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Fehler ${res.status}`, res.status, data.details);
  return data as T;
}
