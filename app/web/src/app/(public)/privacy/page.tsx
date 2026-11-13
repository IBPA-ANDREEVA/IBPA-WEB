import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { documentHref } from "@/lib/association-documents";
import { resolveLocale } from "@/lib/locale";

export default async function Page() {
  const locale = resolveLocale((await cookies()).get("ibpa-locale")?.value);
  redirect(documentHref("privacy-policy.pdf", locale));
}
