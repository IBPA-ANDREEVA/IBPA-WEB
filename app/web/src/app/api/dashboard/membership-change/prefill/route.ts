import { proxyMembershipChange } from "@/lib/membership-change-proxy";

export async function GET(request: Request) {
  return proxyMembershipChange({ method: "GET", path: "/prefill", search: new URL(request.url).search });
}
