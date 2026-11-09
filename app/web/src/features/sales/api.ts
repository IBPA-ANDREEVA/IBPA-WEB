export class CommerceApiError extends Error {
  constructor(
    public code: string,
    public field?: string,
  ) {
    super(code);
  }
}
export async function commerceApi<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({ code: "SALES_ERROR" }));
  if (!response.ok)
    throw new CommerceApiError(
      data.code || data.error || "SALES_ERROR",
      data.field,
    );
  return data;
}
