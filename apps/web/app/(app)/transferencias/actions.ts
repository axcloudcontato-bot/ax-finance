"use server";

import { redirect } from "next/navigation";
import { createTransfer, reverseTransfer } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { parseAmountToCents } from "@/lib/currency";
import { actionErrorMessage } from "@/lib/action-errors";

export async function createTransferAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const fromAccountId = String(formData.get("fromAccountId") ?? "");
  const toAccountId = String(formData.get("toAccountId") ?? "");
  const amount = String(formData.get("amount") ?? "0");
  const fee = String(formData.get("fee") ?? "0");
  const transferDate = String(formData.get("transferDate") ?? "");
  const description = String(formData.get("description") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;

  try {
    await createTransfer(user.id, company.id, {
      fromAccountId,
      toAccountId,
      amountCents: parseAmountToCents(amount),
      feeCents: parseAmountToCents(fee),
      transferDate,
      description: description || undefined,
      idempotencyKey,
    });
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível criar a transferência.");
    redirect(`/transferencias/novo?erro=${encodeURIComponent(message)}`);
  }

  redirect("/transferencias");
}

export async function reverseTransferAction(transferId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const reason = String(formData.get("reason") ?? "").trim() || "Estornado pelo usuário";

  try {
    await reverseTransfer(user.id, company.id, transferId, { reason });
  } catch (error) {
    const message = actionErrorMessage(error, "Não foi possível estornar.");
    redirect(`/transferencias?erro=${encodeURIComponent(message)}`);
  }

  redirect("/transferencias");
}
