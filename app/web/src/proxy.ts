import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { isPublicSearchPage } from "@/lib/seo/routes";
import {
  adminAuthErrorResponse,
  classifyProxyPath,
  getRequestId,
  logAdminAuthFailure,
  unauthenticatedAdminPageAction,
} from "@/lib/admin-api-auth";

/**
 * Middleware only answers the *authentication* question (is anyone signed
 * in?). Admin *authorization* (403 for non-admins) is decided by the shared
 * `requireAdminApi()` helper in route handlers and by the admin layout, so
 * GET pages, GET APIs, and mutations all run through identical role logic.
 *
 * Note: for document navigations with an expired-but-refreshable session,
 * `clerkMiddleware` performs its handshake redirect before this handler runs,
 * so an authenticated admin is transparently refreshed rather than signed out.
 */
const authenticatedProxy = clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;
  const kind = classifyProxyPath(pathname);

  // UploadThing and Stripe webhook callbacks authenticate themselves
  // (UploadThing route middleware / Stripe signatures) and arrive without a
  // Clerk session; gating them here would break uploads and payments.
  if (kind === "bypass" || kind === "public") {
    return;
  }

  const authObject = await auth();
  if (authObject.userId) {
    return;
  }

  logAdminAuthFailure({
    layer: "middleware",
    route: pathname,
    method: req.method,
    category: "unauthenticated",
    requestId: getRequestId(req.headers),
    hasUserId: false,
  });

  // API requests always get JSON — never a redirect to an HTML login page.
  if (kind === "protected-api") {
    return adminAuthErrorResponse("unauthenticated");
  }

  // Admin and dashboard pages: only top-level document navigations may be
  // redirected to sign-in. RSC/prefetch requests get a 401 instead, which makes
  // the Next.js router retry as a full navigation (where the Clerk handshake
  // can refresh an expired session) instead of yanking the user to sign-in.
  if (unauthenticatedAdminPageAction(req.headers) === "redirect-to-sign-in") {
    return authObject.redirectToSignIn({ returnBackUrl: req.url });
  }

  return adminAuthErrorResponse("unauthenticated");
}, { signInUrl: "/sign-in" });

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Marketing pages have no session-dependent content. Avoid Clerk handshakes
  // and auth-provider latency on their initial HTML. All APIs, account, admin,
  // checkout success and unknown routes still use the existing auth middleware.
  if ((req.method === "GET" || req.method === "HEAD") && isPublicSearchPage(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return authenticatedProxy(req, event);
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
