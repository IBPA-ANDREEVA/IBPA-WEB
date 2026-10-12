import { AppClerkProvider } from "@/lib/clerk-provider";

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
