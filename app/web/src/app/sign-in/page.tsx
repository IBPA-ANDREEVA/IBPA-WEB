import { SignIn } from "@clerk/nextjs";
import { headers } from "next/headers";
import Link from "next/link";
import { BadgeCheck, ChevronRight, LockKeyhole } from "lucide-react";
import { getLandingOrigin } from "@/lib/public-urls";
import { resolveSignInRedirect } from "@/lib/sign-in-redirect";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const landingUrl = getLandingOrigin();
  const { redirect_url } = await searchParams;
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  // Return to the page that required sign-in (e.g. /admin); default to the dashboard.
  const dashboardUrl = resolveSignInRedirect(redirect_url, host);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F1F3F5] px-4 py-8 md:px-8 md:py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5 lg:grid-cols-[minmax(0,1.02fr)_460px] lg:rounded-[40px]">
        <section className="relative order-2 flex flex-col justify-between gap-10 overflow-hidden bg-[#10203B] p-8 text-white md:p-12 lg:order-1">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#4C7D9D]/30 blur-3xl"
          />
          <div className="relative">
            <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <LockKeyhole size={24} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#B9D9EB]">
              Member Access
            </p>
            <h1 className="mt-4 text-3xl uppercase leading-[1.05] md:text-5xl">
              Sign in to your IBPA dashboard
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/70 md:text-base">
              Open your certificates, notifications and membership details with
              the email that received your approval and payment instructions.
            </p>
          </div>

          <div className="relative space-y-3">
            <div className="flex items-start gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#B9D9EB]" />
              <p className="text-sm leading-relaxed text-white/80">
                <span className="font-semibold text-white">
                  Already approved?
                </span>{" "}
                Sign in with the same email your approval was sent to. Not
                approved yet? Submit your application first.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Link
                href={`${landingUrl}/apply`}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#10203B] transition-transform hover:scale-[1.02]"
              >
                Apply now <ChevronRight size={16} />
              </Link>
              <Link
                href={landingUrl}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/25 px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-white/50 hover:text-white"
              >
                Back to landing
              </Link>
            </div>
          </div>
        </section>

        <section className="order-1 flex items-center justify-center bg-white p-4 py-8 sm:p-8 lg:order-2">
          <div className="w-full max-w-sm">
            <SignIn
              routing="hash"
              fallbackRedirectUrl={dashboardUrl}
              forceRedirectUrl={dashboardUrl}
              signUpFallbackRedirectUrl={dashboardUrl}
              signUpUrl={`${landingUrl}/membership`}
              appearance={{
                options: {
                  unsafe_disableDevelopmentModeWarnings: true,
                },
                // Clerk's own styles outrank utility classes, so use its style objects.
                elements: {
                  rootBox: { width: "100%" },
                  cardBox: {
                    width: "100%",
                    maxWidth: "none",
                    boxShadow: "none",
                    border: "none",
                  },
                  card: {
                    width: "100%",
                    boxShadow: "none",
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    gap: "1.5rem",
                  },
                  footer: { background: "transparent" },
                },
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
