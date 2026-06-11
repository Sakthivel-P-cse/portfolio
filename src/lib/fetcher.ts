// Thin typed fetch wrapper. Unwraps the { data } / { error } envelope from our API.
export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const isJson = res.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(
      payload?.error ?? res.statusText,
      res.status,
      payload?.details,
    );
  }

  return (payload?.data ?? payload) as T;
}
