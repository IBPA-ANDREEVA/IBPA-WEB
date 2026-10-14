import { proxyMembershipChange } from "@/lib/membership-change-proxy";

export async function GET() {
  return proxyMembershipChange({ method: "GET" });
}

export async function POST(request: Request) {
  return proxyMembershipChange({ method: "POST", request });
}
