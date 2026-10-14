import { notFound } from "next/navigation";
import { PublicContentDetail } from "@/components/content/PublicContentDetail";
import { getPublicContentItem } from "@/lib/public-content-server";
import { contentMetadata } from "@/lib/seo/content";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const item = await getPublicContentItem("events", (await params).id);
  if (!item) notFound();
  return contentMetadata(item);
}
export default async function EventDetail({ params }: Props) {
  return <PublicContentDetail type="events" id={(await params).id} />;
}
