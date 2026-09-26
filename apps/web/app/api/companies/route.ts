import type { NextRequest } from "next/server";
import { createCompany, listCompaniesForUser } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireUser();
    const companies = await listCompaniesForUser(user.id);
    return json(companies);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const company = await createCompany(user.id, body);
    return json(company, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
