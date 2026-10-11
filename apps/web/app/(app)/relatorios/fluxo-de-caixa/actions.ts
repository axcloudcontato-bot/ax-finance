"use server";
import { redirect } from "next/navigation";
import { setMinimumCashReserve } from "@ax-finance/domain";
import { requireUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";
import { actionErrorMessage } from "@/lib/action-errors";

export async function saveCashReserveAction(formData: FormData) {
  const user = await requireUser();
  const company = await requirePrimaryCompany(user.id);
  try { await setMinimumCashReserve(user.id, company.id, { minimumCashReserveCents: parseAmountToCents(String(formData.get("minimumReserve") ?? "")) }); }
  catch (error) { redirect(`/relatorios/fluxo-de-caixa?erroReserva=${encodeURIComponent(actionErrorMessage(error, "Não foi possível salvar a reserva."))}#cash-projection-heading`); }
  redirect("/relatorios/fluxo-de-caixa?reservaSalva=1#cash-projection-heading");
}
