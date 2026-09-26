import type { NextRequest } from "next/server";
import { searchRecords } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { json, errorResponse } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);

    const query = request.nextUrl.searchParams.get("q") ?? "";
    const results = await searchRecords(user.id, company.id, query);

    return json(results);
  } catch (error) {
    return errorResponse(error);
  }
}
