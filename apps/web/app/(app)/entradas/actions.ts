"use server";

import { redirect } from "next/navigation";
import {
  cancelTitle,
  createInstallmentPlan,
  createTitle,
  registerSettlement,
  reverseSettlement,
} from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";

export async function createEntradaAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const description = String(formData.get("description") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const partyId = String(formData.get("partyId") ?? "") || undefined;
  const amount = String(formData.get("amount") ?? "0");
  const competenceDate = String(formData.get("competenceDate") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  const notes = String(formData.get("notes") ?? "");

  let titleId: string;
  try {
    const title = await createTitle(user.id, company.id, {
      type: "RECEIVABLE",
      description,
      categoryId,
      partyId,
      originalAmountCents: parseAmountToCents(amount),
      competenceDate,
      dueDate,
      notes: notes || undefined,
    });
    titleId = title.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o lançamento.";
    redirect(`/entradas/novo?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/entradas/${titleId}`);
}

export async function createEntradaInstallmentPlanAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const description = String(formData.get("description") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const partyId = String(formData.get("partyId") ?? "") || undefined;
  const totalAmount = String(formData.get("totalAmount") ?? "0");
  const installmentCount = Number(formData.get("installmentCount") ?? "0");
  const firstDueDate = String(formData.get("firstDueDate") ?? "");
  const intervalMonths = Number(formData.get("intervalMonths") ?? "1");
  const notes = String(formData.get("notes") ?? "");

  try {
    await createInstallmentPlan(user.id, company.id, {
      type: "RECEIVABLE",
      description,
      categoryId,
      partyId,
      totalAmountCents: parseAmountToCents(totalAmount),
      installmentCount,
      firstDueDate,
      intervalMonths,
      notes: notes || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o parcelamento.";
    redirect(`/entradas/parcelado?erro=${encodeURIComponent(message)}`);
  }

  redirect("/entradas");
}

export async function registerEntradaSettlementAction(titleId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const financialAccountId = String(formData.get("financialAccountId") ?? "");
  const principalAmount = String(formData.get("principalAmount") ?? "0");
  const discountAmount = String(formData.get("discountAmount") ?? "0");
  const interestPenaltyAmount = String(formData.get("interestPenaltyAmount") ?? "0");
  const feesAmount = String(formData.get("feesAmount") ?? "0");
  const effectiveDate = String(formData.get("effectiveDate") ?? "");
  const paymentMethod = String(formData.get("paymentMethod") ?? "");

  try {
    await registerSettlement(user.id, company.id, titleId, {
      financialAccountId,
      principalAmountCents: parseAmountToCents(principalAmount),
      discountCents: parseAmountToCents(discountAmount),
      interestPenaltyCents: parseAmountToCents(interestPenaltyAmount),
      feesCents: parseAmountToCents(feesAmount),
      effectiveDate,
      paymentMethod: paymentMethod || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a baixa.";
    redirect(`/entradas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/entradas/${titleId}`);
}

export async function reverseEntradaSettlementAction(
  titleId: string,
  settlementId: string,
  formData: FormData
) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim() || "Estornado pelo usuário";

  try {
    await reverseSettlement(user.id, company.id, settlementId, { reason });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível estornar.";
    redirect(`/entradas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/entradas/${titleId}`);
}

export async function cancelEntradaAction(titleId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim() || "Cancelado pelo usuário";

  try {
    await cancelTitle(user.id, company.id, titleId, { reason });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível cancelar.";
    redirect(`/entradas/${titleId}?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/entradas/${titleId}`);
}
