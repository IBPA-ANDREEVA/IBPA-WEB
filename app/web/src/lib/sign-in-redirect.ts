export const DEFAULT_SIGN_IN_REDIRECT = "/dashboard";

/**
 * Where to send the user after signing in.
 *
 * Clerk's middleware (`redirectToSignIn`) and our own guards pass the page the
 * user originally asked for as `redirect_url`. The sign-in page used to force
 * `/dashboard` and ignore it, so signing in from `/admin` landed on the
 * dashboard. This returns that target as a same-origin path (so it cannot be
 * used as an open redirect) or the dashboard when it is missing or unsafe.
 */
export function resolveSignInRedirect(
  raw: string | string[] | undefined,
  host?: string | null,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return DEFAULT_SIGN_IN_REDIRECT;
  }

  let path: string;
  if (value.startsWith("/")) {
    path = value;
  } else {
    // Clerk sends the absolute URL of the page that required sign-in.
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return DEFAULT_SIGN_IN_REDIRECT;
    }
    if (!host || url.host !== host || !/^https?:$/.test(url.protocol)) {
      return DEFAULT_SIGN_IN_REDIRECT;
    }
    path = `${url.pathname}${url.search}${url.hash}`;
  }

  // Reject protocol-relative ("//evil.com") and backslash tricks ("/\evil.com").
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return DEFAULT_SIGN_IN_REDIRECT;
  }
  // Redirecting back to sign-in would loop.
  if (path === "/sign-in" || path.startsWith("/sign-in/") || path.startsWith("/sign-in?")) {
    return DEFAULT_SIGN_IN_REDIRECT;
  }
  return path;
}
