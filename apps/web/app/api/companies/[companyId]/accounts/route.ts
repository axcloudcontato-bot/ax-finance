import type { NextRequest } from "next/server";
import { createFinancialAccount, listFinancialAccounts } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/session";

export async function GET(_request: NextRequest, props: { params: Promise<{ companyId: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUser();
    const accounts = await listFinancialAccounts(user.id, params.companyId);
    return json(accounts);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ companyId: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUser();
    const body = await request.json();
    const account = await createFinancialAccount(user.id, params.companyId, body);
    return json(account, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
