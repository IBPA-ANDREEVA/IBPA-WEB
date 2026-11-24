import { NextResponse } from "next/server";
import { loadCatalog } from "@/features/beauty-gives-back/load-catalog";

export async function GET() {
  try {
    return NextResponse.json(await loadCatalog(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "catalog_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
