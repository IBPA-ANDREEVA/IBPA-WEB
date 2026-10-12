import { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type AppClerkProviderProps = {
  children: React.ReactNode;
  localization?: ComponentProps<typeof ClerkProvider>["localization"];
};

/**
 * Shared Clerk provider used by the route groups that need clerk-js on the
 * client (dashboard, sign-in, checkout success, admin). Keeping it out of the
 * root layout keeps clerk-js off the public landing pages. The admin area
 * must load it: clerk-js is what keeps the short-lived session cookie fresh,
 * and admin API mutations start failing with 401 without it.
 */
export function AppClerkProvider({
  children,
  localization,
}: AppClerkProviderProps) {
  return (
    <ClerkProvider
      localization={localization}
      signInUrl="/sign-in"
      signInForceRedirectUrl="/dashboard"
      signInFallbackRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {children}
    </ClerkProvider>
  );
}
