import { notFound, redirect } from "next/navigation";
import { PublicContentDetail } from "@/components/content/PublicContentDetail";
import { getPublicContentItem } from "@/lib/public-content-server";
import { contentMetadata } from "@/lib/seo/content";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const item = await getPublicContentItem("news", (await params).id);
  if (!item) notFound();
  if (item.canonicalPath) redirect(item.canonicalPath);
  return contentMetadata(item);
}
export default async function NewsDetail({ params }: Props) {
  return <PublicContentDetail type="news" id={(await params).id} />;
}
