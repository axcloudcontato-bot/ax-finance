import type { NextRequest } from "next/server";
import { suggestCategory } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { errorResponse, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Sugestão de categoria para a descrição digitada no formulário. Só lê: nada é gravado, e quem
 * decide é o usuário. Ver `suggestCategory` no domínio para o que é consultado e o que sai do sistema.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const company = await requirePrimaryCompany(user.id);
    const body = await request.json().catch(() => null);
    const result = await suggestCategory(user.id, company.id, body);
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
