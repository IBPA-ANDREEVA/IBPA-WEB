import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServerBackendUrl } from "@/lib/backend-url";
import { readBackendResponse } from "@/lib/read-backend-response";
import { getSafeBackendErrorMessage } from "@/lib/safe-backend-error";

/** Forwards a signed-in member's membership-change request to the backend. */
export async function proxyMembershipChange(params: {
  method: "GET" | "POST";
  path?: string;
  search?: string;
  request?: Request;
}) {
  const { getToken, userId } = await auth();
  const token = userId ? await getToken() : null;
  const apiUrl = getServerBackendUrl();
  if (!userId || !token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiUrl) return NextResponse.json({ error: "Backend URL is not configured." }, { status: 500 });

  try {
    const body = params.method === "POST" && params.request ? await params.request.text() : undefined;
    const response = await fetch(
      `${apiUrl}/api/dashboard/membership-change${params.path ?? ""}${params.search ?? ""}`,
      {
        method: params.method,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body } : {}),
      },
    );
    const { data, text } = await readBackendResponse(response);
    if (response.ok) return NextResponse.json(data, { status: response.status });

    return NextResponse.json(
      {
        error: getSafeBackendErrorMessage(data, text, "Unable to process the membership change right now."),
        ...(response.status === 409 && data && typeof data === "object" && "request" in data
          ? { request: (data as { request: unknown }).request }
          : {}),
      },
      { status: response.status },
    );
  } catch (error) {
    console.error(`[Proxy membership-change ${params.method}]`, error);
    return NextResponse.json({ error: "Unable to reach the membership service." }, { status: 500 });
  }
}
