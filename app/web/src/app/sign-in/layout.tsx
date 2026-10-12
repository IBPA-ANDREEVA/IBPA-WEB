import { AppClerkProvider } from "@/lib/clerk-provider";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";

export const metadata = NOINDEX_METADATA;

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppClerkProvider
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            titleCombined: "Welcome back",
            subtitle: "Sign in to open your IBPA dashboard",
            subtitleCombined: "Sign in to open your IBPA dashboard",
          },
        },
      }}
    >
      {children}
    </AppClerkProvider>
  );
}
